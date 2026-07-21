<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Services\NfeService;
use App\Services\SpedyService;
use App\Services\VendaService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Tela separada de emissão de NF-e (venda de atacado/revenda pra outro
 * CNPJ) — não passa pelo carrinho do PDV. Diferente da NFC-e do checkout,
 * aqui a emissão é síncrona e o erro volta pra tela na hora (é uma ação
 * explícita do operador, não o fechamento de uma venda de balcão).
 */
class NfeController extends Controller
{
    public function __construct(
        private VendaService $vendas,
        private SpedyService $spedy,
        private NfeService $nfeDireto,
    ) {
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'loja_id' => ['required', 'exists:lojas,id'],
            'cliente_id' => ['required', 'exists:clientes,id'],
            'desconto' => ['nullable', 'numeric', 'min:0'],
            'itens' => ['required', 'array', 'min:1'],
            'itens.*.produto_id' => ['required', 'exists:produtos,id'],
            'itens.*.quantidade' => ['required', 'numeric', 'min:0.001'],
            'itens.*.preco_unitario' => ['required', 'numeric', 'min:0'],
            'pagamentos' => ['required', 'array', 'min:1'],
            'pagamentos.*.forma_pagamento' => ['required', 'in:dinheiro,cartao,cartao_debito,pix,boleto,cheque,crediario,a_prazo,outros'],
            'pagamentos.*.valor' => ['required', 'numeric', 'min:0'],
        ]);

        $cliente = Cliente::findOrFail($data['cliente_id']);
        if (! $cliente->possuiEnderecoCompletoParaNfe()) {
            return response()->json([
                'message' => 'Cliente sem CNPJ/endereço completo cadastrado — complete o cadastro antes de emitir NF-e.',
            ], 422);
        }

        $data['uuid'] = (string) Str::uuid();

        $venda = $this->vendas->registrar($data, $request->user());

        $loja = $venda->loja;
        $emiteDireto = $loja->emiteNfceDireto() && $loja->possuiNfeConfigurado();

        try {
            $nota = $emiteDireto ? $this->nfeDireto->emitir($venda) : $this->spedy->emitirNfe($venda);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'venda_id' => $venda->id,
            ], 422);
        }

        return response()->json([
            'venda_id' => $venda->id,
            'nota_fiscal' => $nota,
        ], 201);
    }
}
