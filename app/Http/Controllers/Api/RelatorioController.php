<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Produto;
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

        $query = Venda::with(['itens', 'pagamentos', 'cliente', 'vendedor', 'loja'])
            ->whereBetween('created_at', [$inicio, $fim])
            ->orderByDesc('created_at');

        if ($lojaId = $request->integer('loja_id')) {
            $query->where('loja_id', $lojaId);
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

        $query = VendaPagamento::query()
            ->join('vendas', 'vendas.id', '=', 'venda_pagamentos.venda_id')
            ->whereBetween('vendas.created_at', [$inicio, $fim])
            ->where('vendas.status', '!=', 'cancelada');

        if ($lojaId = $request->integer('loja_id')) {
            $query->where('vendas.loja_id', $lojaId);
        }

        $porFormaPagamento = (clone $query)
            ->selectRaw('venda_pagamentos.forma_pagamento, sum(venda_pagamentos.valor) as total')
            ->groupBy('venda_pagamentos.forma_pagamento')
            ->get();

        $porVendedor = (clone $query)
            ->join('users', 'users.id', '=', 'vendas.user_id')
            ->selectRaw('users.id as vendedor_id, users.name as vendedor_nome, sum(venda_pagamentos.valor) as total')
            ->groupBy('users.id', 'users.name')
            ->get();

        return response()->json([
            'por_forma_pagamento' => $porFormaPagamento,
            'por_vendedor' => $porVendedor,
            'total_geral' => (float) $porFormaPagamento->sum('total'),
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
            ->where('vendas.status', '!=', 'cancelada');

        if ($lojaId = $request->integer('loja_id')) {
            $query->where('vendas.loja_id', $lojaId);
        }

        $ranking = $query
            ->selectRaw('produtos.id as produto_id, produtos.descricao, sum(venda_itens.quantidade) as quantidade_total, sum(venda_itens.total) as valor_total')
            ->groupBy('produtos.id', 'produtos.descricao')
            ->orderByDesc('valor_total')
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
