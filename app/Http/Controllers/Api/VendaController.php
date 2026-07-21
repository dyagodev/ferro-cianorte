<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use App\Models\NotaFiscal;
use App\Models\Venda;
use App\Services\EstoqueService;
use App\Services\NfceService;
use App\Services\NfeService;
use App\Services\SpedyService;
use App\Services\VendaService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

class VendaController extends Controller
{
    public function __construct(
        private VendaService $vendas,
        private SpedyService $spedy,
        private NfceService $nfceDireto,
        private NfeService $nfeDireto,
        private EstoqueService $estoque,
    ) {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Venda::with(['itens.produto', 'pagamentos', 'cliente', 'vendedor', 'loja', 'notasFiscais'])
            ->orderByDesc('created_at');

        if (! $user->isAdmin()) {
            $query->where('loja_id', $user->loja_id);
        } else {
            // Venda já tem empresa_id/EmpresaScope (ver Venda::class), mas
            // isso aqui garante que um loja_id de outro tenant não vaze via
            // filtro explícito — sem essa validação, whereIn cairia pra "sem
            // filtro" e um admin poderia tentar ver a loja de outra empresa
            // pelo ID.
            $lojasQuery = Loja::query();
            if ($lojaId = $request->integer('loja_id')) {
                $lojasQuery->where('id', $lojaId);
            }
            $query->whereIn('loja_id', $lojasQuery->pluck('id'));
        }

        return $query->paginate(30);
    }

    public function store(Request $request)
    {
        $data = $this->validatedVenda($request);
        $venda = $this->vendas->registrar($data, $request->user());

        if ($data['emitir_nota_fiscal'] ?? false) {
            $this->emitirNotaSeConfigurado($venda);
        }

        return response()->json($venda->load('itens', 'pagamentos'), 201);
    }

    /**
     * Recebe um lote de vendas feitas offline pelo desktop e sincroniza,
     * ignorando (de forma idempotente) as que já foram registradas antes.
     */
    public function sync(Request $request)
    {
        $payload = $request->validate([
            'vendas' => ['required', 'array'],
        ]);

        $user = $request->user();
        $resultados = [];

        foreach ($payload['vendas'] as $vendaData) {
            $data = $this->validatedVendaArray($vendaData, $user);
            $existia = Venda::where('uuid', $data['uuid'])->exists();
            $venda = $this->vendas->registrar($data, $user, feitaOffline: true);

            if (! $existia && ($data['emitir_nota_fiscal'] ?? false)) {
                $this->emitirNotaSeConfigurado($venda);
            }

            $resultados[] = [
                'uuid' => $venda->uuid,
                'id' => $venda->id,
                'status' => $existia ? 'ja_existia' : 'sincronizada',
            ];
        }

        return response()->json(['resultados' => $resultados]);
    }

    /**
     * Cancela uma venda concluída: devolve a quantidade de cada item pro
     * estoque da loja (estorno) e marca o status, sem apagar o registro —
     * mantém histórico/auditoria de que a venda existiu e foi cancelada.
     */
    public function cancelar(Request $request, Venda $venda)
    {
        if ($venda->status === 'cancelada') {
            return response()->json(['message' => 'Esta venda já está cancelada.'], 422);
        }

        $venda->loadMissing('itens.produto');

        DB::transaction(function () use ($venda, $request) {
            foreach ($venda->itens as $item) {
                if (! $item->produto->ehServico()) {
                    $this->estoque->ajustarDelta(
                        $item->produto,
                        $venda->loja_id,
                        $item->quantidade,
                        'cancelamento_venda',
                        usuario: $request->user(),
                        origemTipo: 'venda',
                        origemId: $venda->id,
                    );
                }
            }

            $venda->update(['status' => 'cancelada']);
        });

        return $venda->fresh(['itens', 'pagamentos']);
    }

    /**
     * Emite nota fiscal pra uma venda já concluída (ex.: o operador
     * esqueceu de marcar "emitir nota" no fechamento, ou a emissão
     * automática falhou e precisa tentar de novo). Diferente do fluxo do
     * checkout, aqui é uma ação explícita e síncrona — o erro (se houver)
     * volta pra tela na hora, não fica só no log.
     */
    public function emitirNota(Venda $venda)
    {
        $venda->loadMissing(['loja', 'itens.produto', 'notasFiscais']);
        $loja = $venda->loja;

        if ($venda->status === 'cancelada') {
            return response()->json(['message' => 'Venda cancelada não pode emitir nota fiscal.'], 422);
        }

        $temProduto = $venda->itens->contains(fn ($item) => ! $item->produto->ehServico());
        $temServico = $venda->itens->contains(fn ($item) => $item->produto->ehServico());

        $notaProdutoOk = $venda->notasFiscais->firstWhere('tipo', 'nfce')?->autorizada();
        $notaServicoOk = $venda->notasFiscais->firstWhere('tipo', 'nfse')?->autorizada();

        if (($notaProdutoOk || ! $temProduto) && ($notaServicoOk || ! $temServico)) {
            return response()->json(['message' => 'Essa venda já tem nota fiscal autorizada.'], 422);
        }

        $emiteDireto = $loja->emiteNfceDireto() && $loja->possuiNfceConfigurado();
        if (! $emiteDireto && ! $loja->possuiSpedyConfigurado()) {
            return response()->json(['message' => 'Essa loja não tem emissão fiscal configurada.'], 422);
        }

        $erros = [];

        if ($temProduto && ! $notaProdutoOk) {
            try {
                $emiteDireto ? $this->nfceDireto->emitir($venda) : $this->spedy->emitirNfce($venda);
            } catch (Throwable $e) {
                $erros[] = 'NFC-e: '.$e->getMessage();
            }
        }

        if ($temServico && ! $notaServicoOk) {
            try {
                $this->spedy->emitirNfse($venda);
            } catch (Throwable $e) {
                $erros[] = 'NFS-e: '.$e->getMessage();
            }
        }

        $venda->load('notasFiscais');

        if ($erros) {
            return response()->json([
                'message' => implode(' | ', $erros),
                'notas_fiscais' => $venda->notasFiscais,
            ], 422);
        }

        return response()->json(['notas_fiscais' => $venda->notasFiscais]);
    }

    /**
     * Baixa o DANFE de uma nota autorizada — cupom 80mm pra NFC-e, folha A4
     * pra NF-e (ver NfceService/NfeService). Só funciona pra emissão
     * direta, a Spedy tem o próprio url_danfe hospedado por ela.
     */
    public function baixarDanfe(NotaFiscal $notaFiscal)
    {
        if (! in_array($notaFiscal->tipo, ['nfce', 'nfe'], true) || ! $notaFiscal->autorizada()) {
            return response()->json(['message' => 'Só é possível baixar o DANFE de uma NFC-e/NF-e autorizada.'], 422);
        }

        try {
            $pdf = $notaFiscal->tipo === 'nfce'
                ? $this->nfceDireto->gerarDanfe($notaFiscal)
                : $this->nfeDireto->gerarDanfe($notaFiscal);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Não foi possível gerar o DANFE: '.$e->getMessage()], 422);
        }

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$notaFiscal->tipo.'-'.$notaFiscal->chave_acesso.'.pdf"',
        ]);
    }

    /**
     * Baixa o XML autorizado (nfeProc completo quando emitido direto, ver
     * NfceService) — só existe pra emissão direta, a Spedy hospeda o
     * próprio url_xml.
     */
    public function baixarXml(NotaFiscal $notaFiscal)
    {
        if (blank($notaFiscal->xml_gerado)) {
            return response()->json(['message' => 'Essa nota não tem XML disponível pra download.'], 422);
        }

        return response($notaFiscal->xml_gerado, 200, [
            'Content-Type' => 'application/xml',
            'Content-Disposition' => 'attachment; filename="'.$notaFiscal->tipo.'-'.$notaFiscal->chave_acesso.'.xml"',
        ]);
    }

    /**
     * Cancela uma NFC-e já autorizada — evento de verdade na SEFAZ, não é
     * só apagar o registro daqui. Diferente de VendaController::cancelar
     * (que estorna estoque da venda), isso só muda o status fiscal da
     * nota; a venda em si continua concluída.
     */
    public function cancelarNota(Request $request, NotaFiscal $notaFiscal)
    {
        $data = $request->validate([
            'justificativa' => ['required', 'string', 'min:15', 'max:255'],
        ]);

        if (! in_array($notaFiscal->tipo, ['nfce', 'nfe'], true)) {
            return response()->json(['message' => 'Cancelamento direto só está implementado pra NFC-e/NF-e.'], 422);
        }

        try {
            $nota = $notaFiscal->tipo === 'nfce'
                ? $this->nfceDireto->cancelar($notaFiscal, $data['justificativa'])
                : $this->nfeDireto->cancelar($notaFiscal, $data['justificativa']);
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $nota;
    }

    /**
     * Emissão de nota fiscal é opt-in por venda (o operador escolhe no
     * fechamento) e nunca pode travar o caixa: se a empresa não configurou a
     * Spedy, ou a chamada falhar (rede, API fora, etc.), a venda já está
     * gravada e segue normal — só loga o erro pra investigar depois. Fora da
     * transação da venda de propósito (chamada HTTP externa não deve segurar
     * lock de DB).
     *
     * O carrinho do PDV pode ter produto e serviço misturados — como são
     * documentos fiscais diferentes (NFC-e é estadual, NFS-e é municipal),
     * cada grupo de item vira uma nota separada.
     */
    private function emitirNotaSeConfigurado(Venda $venda): void
    {
        $venda->loadMissing('loja');
        $loja = $venda->loja;

        // Emissão direta (sem Spedy) é opt-in por loja — ver
        // Loja::emissao_fiscal_modo. Fora isso, mesma regra de sempre: sem
        // config nenhuma configurada, não faz nada.
        $emiteDireto = $loja->emiteNfceDireto() && $loja->possuiNfceConfigurado();
        if (! $emiteDireto && ! $loja->possuiSpedyConfigurado()) {
            return;
        }

        $venda->loadMissing('itens.produto');
        $temServico = $venda->itens->contains(fn ($item) => $item->produto->ehServico());
        $temProduto = $venda->itens->contains(fn ($item) => ! $item->produto->ehServico());

        if ($temProduto) {
            try {
                if ($emiteDireto) {
                    $this->nfceDireto->emitir($venda);
                } else {
                    $this->spedy->emitirNfce($venda);
                }
            } catch (Throwable $e) {
                Log::error('Falha ao emitir NFC-e ('.($emiteDireto ? 'direto' : 'Spedy').')', [
                    'venda_id' => $venda->id,
                    'loja_id' => $venda->loja_id,
                    'erro' => $e->getMessage(),
                ]);
            }
        }

        if ($temServico) {
            try {
                $this->spedy->emitirNfse($venda);
            } catch (Throwable $e) {
                Log::error('Falha ao emitir NFS-e via Spedy', [
                    'venda_id' => $venda->id,
                    'loja_id' => $venda->loja_id,
                    'erro' => $e->getMessage(),
                ]);
            }
        }
    }

    private function validatedVenda(Request $request): array
    {
        return $this->validatedVendaArray($request->all(), $request->user());
    }

    private function validatedVendaArray(array $input, $user = null): array
    {
        $validator = validator($input, [
            'uuid' => ['nullable', 'uuid'],
            // 'exists:lojas,id' sozinho bastaria se Loja não fosse
            // multi-tenant — ele ignora o EmpresaScope e aceitaria o
            // loja_id de QUALQUER empresa. Loja::query() já sai filtrada
            // pelo tenant atual, então isso aqui garante que um admin só
            // consegue registrar venda numa loja da própria empresa.
            'loja_id' => [
                $user && ! $user->isAdmin() ? 'nullable' : 'required',
                Rule::exists('lojas', 'id')->where('empresa_id', TenantContext::id()),
            ],
            'cliente_id' => ['nullable', 'exists:clientes,id'],
            'data_hora' => ['nullable', 'date'],
            'desconto' => ['nullable', 'numeric', 'min:0'],
            'itens' => ['required', 'array', 'min:1'],
            'itens.*.produto_id' => ['required', 'exists:produtos,id'],
            'itens.*.quantidade' => ['required', 'numeric', 'min:0.001'],
            'itens.*.preco_unitario' => ['required', 'numeric', 'min:0'],
            'pagamentos' => ['required', 'array', 'min:1'],
            'pagamentos.*.forma_pagamento' => ['required', 'in:dinheiro,cartao,cartao_debito,pix,boleto,cheque,crediario,a_prazo,outros'],
            'pagamentos.*.valor' => ['required', 'numeric', 'min:0'],
            // Nem toda venda é fiscal (ex.: venda pra outro comerciante,
            // amostra, brinde) — quem decide é o operador do caixa na hora,
            // nunca é automático só porque a empresa tem a Spedy configurada.
            'emitir_nota_fiscal' => ['nullable', 'boolean'],
        ]);

        $data = $validator->validate();
        $data['uuid'] = $data['uuid'] ?? (string) Str::uuid();

        return $data;
    }
}
