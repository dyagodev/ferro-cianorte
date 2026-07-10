<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MovimentacaoCaixa;
use App\Models\VendaPagamento;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CaixaController extends Controller
{
    /**
     * Registra uma sangria (retirada de dinheiro do caixa) — feita direto na
     * tela de PDV, tanto por admin quanto por vendedor, sempre escopada à
     * loja onde o caixa está sendo operado.
     */
    public function sangria(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'loja_id' => [$user->isAdmin() ? 'required' : 'nullable', 'exists:lojas,id'],
            'valor' => ['required', 'numeric', 'min:0.01'],
            'observacao' => ['nullable', 'string', 'max:255'],
        ]);

        $movimentacao = MovimentacaoCaixa::create([
            'loja_id' => $user->isAdmin() ? $data['loja_id'] : $user->loja_id,
            'user_id' => $user->id,
            'tipo' => 'sangria',
            'valor' => $data['valor'],
            'observacao' => $data['observacao'] ?? null,
        ]);

        return response()->json($movimentacao, 201);
    }

    /**
     * Resumo do fechamento de caixa do dia atual pra uma loja: total recebido
     * por forma de pagamento, total de sangrias e dinheiro esperado em caixa
     * (dinheiro recebido em vendas menos sangrias do dia).
     */
    public function fechamento(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'loja_id' => [$user->isAdmin() ? 'required' : 'nullable', 'exists:lojas,id'],
        ]);

        $lojaId = $user->isAdmin() ? $data['loja_id'] : $user->loja_id;
        $inicio = Carbon::today();
        $fim = Carbon::tomorrow();

        $porFormaPagamento = VendaPagamento::query()
            ->join('vendas', 'vendas.id', '=', 'venda_pagamentos.venda_id')
            ->where('vendas.loja_id', $lojaId)
            ->whereBetween('vendas.created_at', [$inicio, $fim])
            ->selectRaw('venda_pagamentos.forma_pagamento, sum(venda_pagamentos.valor) as total')
            ->groupBy('venda_pagamentos.forma_pagamento')
            ->get();

        $totalDinheiroVendas = (float) $porFormaPagamento
            ->firstWhere('forma_pagamento', 'dinheiro')?->total;

        $sangrias = MovimentacaoCaixa::query()
            ->where('loja_id', $lojaId)
            ->where('tipo', 'sangria')
            ->whereBetween('created_at', [$inicio, $fim])
            ->orderByDesc('created_at')
            ->get();

        $totalSangrias = (float) $sangrias->sum('valor');

        return response()->json([
            'por_forma_pagamento' => $porFormaPagamento,
            'total_geral' => (float) $porFormaPagamento->sum('total'),
            'sangrias' => $sangrias,
            'total_sangrias' => $totalSangrias,
            'dinheiro_esperado_em_caixa' => $totalDinheiroVendas - $totalSangrias,
        ]);
    }
}
