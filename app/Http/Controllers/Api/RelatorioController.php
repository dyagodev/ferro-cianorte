<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use App\Models\MovimentacaoCaixa;
use App\Models\MovimentacaoEstoque;
use App\Models\Produto;
use App\Models\ProdutoEstoque;
use App\Models\SyncConexao;
use App\Models\Venda;
use App\Models\VendaItem;
use App\Models\VendaPagamento;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class RelatorioController extends Controller
{
    /**
     * Lista de vendas num período, filtrável por loja.
     */
    public function vendas(Request $request)
    {
        [$inicio, $fim] = $this->periodo($request);

        $query = Venda::with(['itens.produto', 'itens.servico', 'pagamentos', 'cliente', 'vendedor', 'loja', 'notasFiscais'])
            ->whereBetween('created_at', [$inicio, $fim])
            ->whereIn('loja_id', $this->lojaIdsPermitidas($request))
            ->orderByDesc('created_at');

        if ($formaPagamento = $request->string('forma_pagamento')->toString()) {
            $query->whereHas('pagamentos', fn ($q) => $q->where('forma_pagamento', $formaPagamento));
        }

        // sync_conexao_id só é preenchido em venda importada do Link Pro
        // (ver LinkProSyncService) — nula é venda feita no próprio caixa.
        if ($origem = $request->string('origem')->toString()) {
            if ($origem === 'sistema') {
                $query->whereNull('sync_conexao_id');
            } elseif ($origem === 'linkpro') {
                $query->whereNotNull('sync_conexao_id');
            }
        }

        $vendas = $query->get();
        // Venda cancelada continua listada (auditoria/histórico), mas não
        // deve contar nos totais — é justamente pra corrigir o total que ela
        // foi cancelada.
        $vendasValidas = $vendas->where('status', '!=', 'cancelada');

        return response()->json([
            'vendas' => $vendas,
            'totais' => [
                'quantidade_vendas' => $vendasValidas->count(),
                'subtotal' => (float) $vendasValidas->sum('subtotal'),
                'desconto' => (float) $vendasValidas->sum('desconto'),
                'total' => (float) $vendasValidas->sum('total'),
            ],
        ]);
    }

    /**
     * Fechamento de caixa: total recebido por forma de pagamento, loja e vendedor.
     */
    public function fechamentoCaixa(Request $request)
    {
        [$inicio, $fim] = $this->periodo($request);
        $lojaIds = $this->lojaIdsPermitidas($request);

        $query = VendaPagamento::query()
            ->join('vendas', 'vendas.id', '=', 'venda_pagamentos.venda_id')
            ->whereBetween('vendas.created_at', [$inicio, $fim])
            ->where('vendas.status', '!=', 'cancelada')
            ->whereIn('vendas.loja_id', $lojaIds);

        $porFormaPagamento = (clone $query)
            ->selectRaw('venda_pagamentos.forma_pagamento, sum(venda_pagamentos.valor) as total')
            ->groupBy('venda_pagamentos.forma_pagamento')
            ->get();

        $porVendedor = (clone $query)
            ->join('users', 'users.id', '=', 'vendas.user_id')
            ->selectRaw('users.id as vendedor_id, users.name as vendedor_nome, sum(venda_pagamentos.valor) as total')
            ->groupBy('users.id', 'users.name')
            ->get();

        $quantidadeVendas = Venda::query()
            ->whereBetween('created_at', [$inicio, $fim])
            ->where('status', '!=', 'cancelada')
            ->whereIn('loja_id', $lojaIds)
            ->count();

        // Histórico de abertura/sangria/fechamento do período — é o que
        // efetivamente mostra se o caixa bateu: cada "fechamento" carrega na
        // observação o valor esperado e a diferença apurada na contagem.
        $movimentacoes = MovimentacaoCaixa::query()
            ->with(['loja:id,nome', 'usuario:id,name'])
            ->whereBetween('created_at', [$inicio, $fim])
            ->whereIn('loja_id', $lojaIds)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'quantidade_vendas' => $quantidadeVendas,
            'por_forma_pagamento' => $porFormaPagamento,
            'por_vendedor' => $porVendedor,
            'total_geral' => (float) $porFormaPagamento->sum('total'),
            'movimentacoes' => $movimentacoes,
            'total_sangrias' => (float) $movimentacoes->where('tipo', 'sangria')->sum('valor'),
        ]);
    }

    /**
     * Ranking de produtos por quantidade e valor vendido no período.
     */
    public function produtosMaisVendidos(Request $request)
    {
        [$inicio, $fim] = $this->periodo($request);

        $query = VendaItem::query()
            ->join('vendas', 'vendas.id', '=', 'venda_itens.venda_id')
            ->join('produtos', 'produtos.id', '=', 'venda_itens.produto_id')
            ->whereBetween('vendas.created_at', [$inicio, $fim])
            ->where('vendas.status', '!=', 'cancelada')
            ->whereIn('vendas.loja_id', $this->lojaIdsPermitidas($request));

        $colunasOrdenacao = [
            'quantidade_total' => 'quantidade_total',
            'valor_total' => 'valor_total',
            'descricao' => 'produtos.descricao',
        ];
        $sort = $colunasOrdenacao[$request->string('sort')->toString()] ?? 'quantidade_total';
        $direction = strtolower($request->string('direction')->toString()) === 'asc' ? 'asc' : 'desc';

        $ranking = $query
            ->selectRaw('produtos.id as produto_id, produtos.descricao, sum(venda_itens.quantidade) as quantidade_total, sum(venda_itens.total) as valor_total')
            ->groupBy('produtos.id', 'produtos.descricao')
            ->orderBy($sort, $direction)
            ->limit($request->integer('limit') ?: 20)
            ->get();

        return response()->json(['produtos' => $ranking]);
    }

    /**
     * Produtos com estoque abaixo do mínimo cadastrado, por loja.
     */
    public function estoqueBaixo(Request $request)
    {
        $query = Produto::query()
            ->where('ativo', true)
            ->with(['estoques' => function ($q) use ($request) {
                if ($lojaId = $request->integer('loja_id')) {
                    $q->where('loja_id', $lojaId);
                }
                $q->with('loja');
            }]);

        if ($lojaId = $request->integer('loja_id')) {
            $query->whereHas('estoques', fn ($q) => $q->where('loja_id', $lojaId));
        }

        $itens = [];

        foreach ($query->get() as $produto) {
            foreach ($produto->estoques as $estoque) {
                if ($estoque->quantidade < $produto->estoque_minimo) {
                    $itens[] = [
                        'produto_id' => $produto->id,
                        'descricao' => $produto->descricao,
                        'loja_id' => $estoque->loja_id,
                        'loja_nome' => $estoque->loja?->nome,
                        'quantidade_atual' => $estoque->quantidade,
                        'estoque_minimo' => $produto->estoque_minimo,
                    ];
                }
            }
        }

        return response()->json(['itens' => $itens]);
    }

    /**
     * Histórico de movimentação de estoque (venda, cancelamento,
     * transferência, sincronização do Link Pro, ajuste manual) — estilo o
     * histórico que já existe no Link Pro (log_produto_qtd_estoque), ver
     * EstoqueService pra quem grava cada linha.
     */
    public function historicoEstoque(Request $request)
    {
        $query = MovimentacaoEstoque::with(['produto:id,descricao,codigo_interno', 'loja:id,nome', 'usuario:id,name'])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($produtoId = $request->integer('produto_id')) {
            $query->where('produto_id', $produtoId);
        }

        if ($lojaId = $request->integer('loja_id')) {
            $query->where('loja_id', $lojaId);
        }

        if ($tipo = $request->string('tipo')->toString()) {
            $query->where('tipo', $tipo);
        }

        if ($request->filled('data_inicio') || $request->filled('data_fim')) {
            [$inicio, $fim] = $this->periodo($request);
            $query->whereBetween('created_at', [$inicio, $fim]);
        }

        $pagina = $query->paginate($request->integer('per_page') ?: 30);

        // "Estoque real" é o valor ATUAL de produto_estoques, não o
        // quantidade_depois gravado naquela linha (que só reflete o estado
        // logo após aquele movimento específico — pode já ter mudado desde
        // então). Busca em lote pra não fazer 1 query por linha da página.
        $pares = $pagina->getCollection()
            ->map(fn (MovimentacaoEstoque $mov) => ['produto_id' => $mov->produto_id, 'loja_id' => $mov->loja_id])
            ->unique(fn ($par) => "{$par['produto_id']}:{$par['loja_id']}");

        $estoquesAtuais = $pares->isEmpty()
            ? collect()
            : ProdutoEstoque::query()
                ->where(function ($query) use ($pares) {
                    foreach ($pares as $par) {
                        $query->orWhere(function ($q) use ($par) {
                            $q->where('produto_id', $par['produto_id'])->where('loja_id', $par['loja_id']);
                        });
                    }
                })
                ->get()
                ->keyBy(fn (ProdutoEstoque $estoque) => "{$estoque->produto_id}:{$estoque->loja_id}");

        $pagina->getCollection()->each(function (MovimentacaoEstoque $mov) use ($estoquesAtuais) {
            $mov->estoque_atual = $estoquesAtuais->get("{$mov->produto_id}:{$mov->loja_id}")?->quantidade;
        });

        return $pagina;
    }

    /**
     * O filtro "Origem" (nosso sistema x Link Pro) só faz sentido mostrar
     * na tela se a empresa realmente tem alguma conexão Link Pro
     * cadastrada — senão é uma opção que nunca muda nada.
     */
    public function possuiIntegracaoLinkPro(Request $request)
    {
        return response()->json([
            'possui_integracao_linkpro' => SyncConexao::whereIn('loja_id', $this->lojaIdsPermitidas($request))->exists(),
        ]);
    }

    /**
     * IDs de loja que o relatório pode enxergar. Venda já tem empresa_id
     * (ver Venda::class), mas VendaPagamento/VendaItem/MovimentacaoCaixa
     * não — e as queries desse controller usam join/query builder cru
     * nelas, que não respeita EmpresaScope nenhum. Loja::query() já sai
     * filtrada pelo tenant atual, então usar ela como base garante o
     * isolamento mesmo se loja_id vier de outra empresa (pluck() dá vazio,
     * whereIn([]) não bate com nada).
     */
    private function lojaIdsPermitidas(Request $request): array
    {
        $query = Loja::query();

        if ($lojaId = $request->integer('loja_id')) {
            $query->where('id', $lojaId);
        }

        return $query->pluck('id')->all();
    }

    /**
     * As datas do filtro ("De"/"Até" na tela) são sempre dia civil de
     * Brasília — sem informar o timezone de origem aqui, Carbon::parse
     * assume o timezone padrão da aplicação (UTC), fazendo o início/fim do
     * dia ficar 3h adiantado (perde/ganha venda perto da meia-noite).
     */
    private function periodo(Request $request): array
    {
        $inicio = $request->filled('data_inicio')
            ? Carbon::parse($request->string('data_inicio'), 'America/Sao_Paulo')->startOfDay()
            : Carbon::now('America/Sao_Paulo')->startOfDay();

        $fim = $request->filled('data_fim')
            ? Carbon::parse($request->string('data_fim'), 'America/Sao_Paulo')->endOfDay()
            : Carbon::now('America/Sao_Paulo')->endOfDay();

        return [$inicio, $fim];
    }
}
