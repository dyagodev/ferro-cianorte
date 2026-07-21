<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MovimentacaoCaixa;
use App\Models\VendaPagamento;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class CaixaController extends Controller
{
    /**
     * Situação do caixa hoje (horário de Brasília): aberto se existe uma
     * movimentação "abertura" hoje sem uma "fechamento" depois dela. Usado
     * pelo PDV pra decidir o que mostrar no menu (abrir vs. sangria/fechar).
     */
    public function situacao(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'loja_id' => [$user->isAdmin() ? 'required' : 'nullable', Rule::exists('lojas', 'id')->where('empresa_id', TenantContext::id())],
        ]);

        $lojaId = $user->isAdmin() ? $data['loja_id'] : $user->loja_id;
        [$inicio, $fim] = $this->diaDeHoje();

        $abertura = MovimentacaoCaixa::where('loja_id', $lojaId)
            ->where('tipo', 'abertura')
            ->whereBetween('created_at', [$inicio, $fim])
            ->latest('created_at')
            ->first();

        $fechado = $abertura && MovimentacaoCaixa::where('loja_id', $lojaId)
            ->where('tipo', 'fechamento')
            ->where('created_at', '>', $abertura->created_at)
            ->whereBetween('created_at', [$inicio, $fim])
            ->exists();

        return response()->json([
            'aberto' => (bool) $abertura && ! $fechado,
            'abertura' => $abertura,
        ]);
    }

    /**
     * Abre o caixa do dia com um valor inicial (fundo de troco). Bloqueia
     * abrir de novo se já tem um caixa aberto hoje sem fechamento.
     */
    public function abrir(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'loja_id' => [$user->isAdmin() ? 'required' : 'nullable', Rule::exists('lojas', 'id')->where('empresa_id', TenantContext::id())],
            'valor' => ['required', 'numeric', 'min:0'],
        ]);

        $lojaId = $user->isAdmin() ? $data['loja_id'] : $user->loja_id;
        [$inicio, $fim] = $this->diaDeHoje();

        $abertura = MovimentacaoCaixa::where('loja_id', $lojaId)
            ->where('tipo', 'abertura')
            ->whereBetween('created_at', [$inicio, $fim])
            ->latest('created_at')
            ->first();

        $jaFechado = $abertura && MovimentacaoCaixa::where('loja_id', $lojaId)
            ->where('tipo', 'fechamento')
            ->where('created_at', '>', $abertura->created_at)
            ->exists();

        if ($abertura && ! $jaFechado) {
            return response()->json(['message' => 'O caixa já está aberto hoje.'], 422);
        }

        $movimentacao = MovimentacaoCaixa::create([
            'loja_id' => $lojaId,
            'user_id' => $user->id,
            'tipo' => 'abertura',
            'valor' => $data['valor'],
            'observacao' => 'Fundo de troco inicial',
        ]);

        return response()->json($movimentacao, 201);
    }

    /**
     * Registra uma sangria (retirada de dinheiro do caixa) — feita direto na
     * tela de PDV, tanto por admin quanto por vendedor, sempre escopada à
     * loja onde o caixa está sendo operado.
     */
    public function sangria(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'loja_id' => [$user->isAdmin() ? 'required' : 'nullable', Rule::exists('lojas', 'id')->where('empresa_id', TenantContext::id())],
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
     * (fundo de troco da abertura + dinheiro recebido em vendas - sangrias
     * do dia). Só leitura — não fecha nada, ver fechar().
     */
    public function fechamento(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'loja_id' => [$user->isAdmin() ? 'required' : 'nullable', Rule::exists('lojas', 'id')->where('empresa_id', TenantContext::id())],
        ]);

        $lojaId = $user->isAdmin() ? $data['loja_id'] : $user->loja_id;
        [$inicio, $fim] = $this->diaDeHoje();

        $porFormaPagamento = VendaPagamento::query()
            ->join('vendas', 'vendas.id', '=', 'venda_pagamentos.venda_id')
            ->where('vendas.loja_id', $lojaId)
            ->where('vendas.status', '!=', 'cancelada')
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

        $abertura = MovimentacaoCaixa::where('loja_id', $lojaId)
            ->where('tipo', 'abertura')
            ->whereBetween('created_at', [$inicio, $fim])
            ->latest('created_at')
            ->first();

        $fundoTroco = (float) ($abertura->valor ?? 0);

        return response()->json([
            'abertura' => $abertura,
            'fundo_troco' => $fundoTroco,
            'por_forma_pagamento' => $porFormaPagamento,
            'total_geral' => (float) $porFormaPagamento->sum('total'),
            'sangrias' => $sangrias,
            'total_sangrias' => $totalSangrias,
            'dinheiro_esperado_em_caixa' => $fundoTroco + $totalDinheiroVendas - $totalSangrias,
        ]);
    }

    /**
     * Fecha o caixa de verdade: registra o valor conferido pelo operador
     * (contagem física) e a diferença em relação ao esperado, como uma
     * movimentação "fechamento" — vira histórico, não dá pra abrir sangria
     * nem fechar de novo até abrir o caixa de novo.
     */
    public function fechar(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'loja_id' => [$user->isAdmin() ? 'required' : 'nullable', Rule::exists('lojas', 'id')->where('empresa_id', TenantContext::id())],
            'valor_conferido' => ['required', 'numeric', 'min:0'],
            'observacao' => ['nullable', 'string', 'max:255'],
        ]);

        $lojaId = $user->isAdmin() ? $data['loja_id'] : $user->loja_id;
        [$inicio, $fim] = $this->diaDeHoje();

        $abertura = MovimentacaoCaixa::where('loja_id', $lojaId)
            ->where('tipo', 'abertura')
            ->whereBetween('created_at', [$inicio, $fim])
            ->latest('created_at')
            ->first();

        if (! $abertura) {
            return response()->json(['message' => 'O caixa não está aberto hoje.'], 422);
        }

        $jaFechado = MovimentacaoCaixa::where('loja_id', $lojaId)
            ->where('tipo', 'fechamento')
            ->where('created_at', '>', $abertura->created_at)
            ->exists();

        if ($jaFechado) {
            return response()->json(['message' => 'O caixa de hoje já foi fechado.'], 422);
        }

        $resumo = $this->fechamento($request)->getData(true);
        $diferenca = $data['valor_conferido'] - $resumo['dinheiro_esperado_em_caixa'];

        $observacao = 'Esperado: R$ '.number_format($resumo['dinheiro_esperado_em_caixa'], 2, ',', '.')
            .' — Diferença: R$ '.number_format($diferenca, 2, ',', '.');
        if (! empty($data['observacao'])) {
            $observacao .= ' — '.$data['observacao'];
        }

        $movimentacao = MovimentacaoCaixa::create([
            'loja_id' => $lojaId,
            'user_id' => $user->id,
            'tipo' => 'fechamento',
            'valor' => $data['valor_conferido'],
            'observacao' => $observacao,
        ]);

        return response()->json([
            'movimentacao' => $movimentacao,
            'diferenca' => $diferenca,
        ], 201);
    }

    /**
     * "Hoje" sempre em horário de Brasília — o servidor roda em UTC
     * (config('app.timezone')), então Carbon::today() sem timezone
     * explícito começaria o dia às 21h da véspera em Brasília (meia-noite
     * UTC), incluindo/perdendo movimentação perto da virada.
     */
    private function diaDeHoje(): array
    {
        $hoje = Carbon::now('America/Sao_Paulo')->startOfDay();

        return [$hoje, $hoje->copy()->addDay()];
    }
}
