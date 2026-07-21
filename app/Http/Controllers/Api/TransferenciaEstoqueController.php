<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TransferenciaEstoque;
use App\Services\TransferenciaEstoqueService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class TransferenciaEstoqueController extends Controller
{
    public function __construct(private TransferenciaEstoqueService $service)
    {
    }

    public function index(Request $request)
    {
        $query = TransferenciaEstoque::with(['lojaOrigem:id,nome', 'lojaDestino:id,nome', 'notaFiscal', 'usuario:id,name'])
            ->withCount('itens')
            ->orderByDesc('created_at');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($lojaId = $request->integer('loja_id')) {
            $query->where(fn ($q) => $q->where('loja_origem_id', $lojaId)->orWhere('loja_destino_id', $lojaId));
        }

        return $query->paginate($request->integer('per_page') ?: 20);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        try {
            $transferencia = $this->service->criar($data, $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($transferencia->load('itens.produto'), 201);
    }

    public function show(TransferenciaEstoque $transferencia)
    {
        return $transferencia->load(['itens.produto', 'lojaOrigem', 'lojaDestino', 'notaFiscal', 'manifestoTransporte', 'usuario:id,name', 'recebidoPor:id,name']);
    }

    public function update(Request $request, TransferenciaEstoque $transferencia)
    {
        $data = $this->validated($request, sometimes: true);

        try {
            $transferencia = $this->service->atualizar($transferencia, $data);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $transferencia->load('itens.produto');
    }

    public function destroy(TransferenciaEstoque $transferencia)
    {
        if (! $transferencia->editavel()) {
            return response()->json(['message' => 'Só é possível excluir transferência em rascunho.'], 422);
        }

        $transferencia->delete();

        return response()->json(null, 204);
    }

    /**
     * Emite a NF-e de transferência — síncrono, o operador espera a
     * resposta na hora (mesmo padrão do MDF-e e da NF-e de atacado).
     */
    public function emitir(TransferenciaEstoque $transferencia, Request $request)
    {
        try {
            $transferencia = $this->service->emitir($transferencia, $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage(), 'transferencia' => $transferencia->fresh(['itens', 'notaFiscal'])], 422);
        }

        return $transferencia->load(['itens.produto', 'notaFiscal']);
    }

    /**
     * Confirma a transferência sem passar pela SEFAZ — pra quando não
     * precisa de NF-e (ex.: ajuste informal entre lojas vizinhas). Mesmo
     * efeito no estoque de emitir(), sem nota nenhuma envolvida.
     */
    public function confirmarSemNota(TransferenciaEstoque $transferencia, Request $request)
    {
        try {
            $transferencia = $this->service->confirmarSemNotaFiscal($transferencia, $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $transferencia->load(['itens.produto']);
    }

    public function receber(TransferenciaEstoque $transferencia, Request $request)
    {
        try {
            $transferencia = $this->service->receber($transferencia, $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $transferencia->load(['itens.produto', 'notaFiscal']);
    }

    public function cancelar(TransferenciaEstoque $transferencia, Request $request)
    {
        $data = $request->validate([
            'justificativa' => ['nullable', 'string', 'min:15', 'max:255'],
        ]);

        try {
            $transferencia = $this->service->cancelar($transferencia, $data['justificativa'] ?? null, $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $transferencia->load(['itens.produto', 'notaFiscal']);
    }

    private function validated(Request $request, bool $sometimes = false): array
    {
        $regra = $sometimes ? ['sometimes', 'required'] : ['required'];

        // exists:tabela,id sozinho ignora o EmpresaScope — aceitaria loja/
        // produto de OUTRA empresa. Escopado pelo tenant atual, mesmo
        // raciocínio de VendaController::validatedVendaArray.
        $lojaDoTenant = Rule::exists('lojas', 'id')->where('empresa_id', TenantContext::id());
        $produtoDoTenant = Rule::exists('produtos', 'id')->where('empresa_id', TenantContext::id());

        return $request->validate([
            'loja_origem_id' => [...$regra, $lojaDoTenant],
            'loja_destino_id' => [...$regra, $lojaDoTenant, Rule::notIn([$request->input('loja_origem_id')])],
            'observacao' => ['nullable', 'string', 'max:1000'],
            'itens' => [...$regra, 'array', 'min:1'],
            'itens.*.produto_id' => ['required', $produtoDoTenant],
            'itens.*.quantidade' => ['required', 'numeric', 'min:0.001'],
            'itens.*.preco_unitario' => ['required', 'numeric', 'min:0'],
        ]);
    }
}
