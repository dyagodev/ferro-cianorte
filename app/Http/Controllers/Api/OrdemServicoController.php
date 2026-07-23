<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrdemServico;
use App\Models\OrdemServicoItem;
use App\Services\OrdemServicoService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class OrdemServicoController extends Controller
{
    public function __construct(private OrdemServicoService $service)
    {
    }

    public function index(Request $request)
    {
        $query = OrdemServico::with(['cliente:id,nome', 'ativo:id,nome,tipo', 'loja:id,nome'])
            ->withCount('itens')
            ->orderByDesc('created_at');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($clienteId = $request->integer('cliente_id')) {
            $query->where('cliente_id', $clienteId);
        }

        if ($lojaId = $request->integer('loja_id')) {
            $query->where('loja_id', $lojaId);
        }

        return $query->paginate($request->integer('per_page') ?: 20);
    }

    public function store(Request $request)
    {
        $os = $this->service->criar($this->validated($request), $request->user());

        return response()->json($os, 201);
    }

    public function show(OrdemServico $os)
    {
        return $os->load(['itens.produto', 'cliente', 'ativo', 'loja', 'usuario:id,name', 'profissional:id,name', 'venda']);
    }

    public function update(Request $request, OrdemServico $os)
    {
        if (! $os->editavel()) {
            return response()->json(['message' => 'Só é possível editar uma Ordem de Serviço aberta ou em execução.'], 422);
        }

        $data = $request->validate([
            'ativo_id' => ['nullable', Rule::exists('ativos', 'id')->where('empresa_id', TenantContext::id())],
            'profissional_id' => ['nullable', Rule::exists('users', 'id')->where('empresa_id', TenantContext::id())],
            'descricao_problema' => ['nullable', 'string', 'max:2000'],
            'observacoes' => ['nullable', 'string', 'max:2000'],
            'data_previsao' => ['nullable', 'date'],
        ]);

        $os->update($data);

        return $os->fresh(['itens.produto']);
    }

    public function adicionarItem(Request $request, OrdemServico $os)
    {
        $data = $request->validate([
            'produto_id' => ['required', Rule::exists('produtos', 'id')->where('empresa_id', TenantContext::id())],
            'quantidade' => ['required', 'numeric', 'min:0.001'],
            'preco_unitario' => ['required', 'numeric', 'min:0'],
        ]);

        try {
            $os = $this->service->adicionarItem($os, $data);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $os;
    }

    public function removerItem(OrdemServico $os, OrdemServicoItem $item)
    {
        try {
            $os = $this->service->removerItem($os, $item);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $os;
    }

    public function mudarStatus(Request $request, OrdemServico $os)
    {
        $data = $request->validate([
            'status' => ['required', 'in:em_execucao,concluida,cancelada'],
        ]);

        try {
            $os = $this->service->mudarStatus($os, $data['status']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $os;
    }

    public function faturar(Request $request, OrdemServico $os)
    {
        $data = $request->validate([
            'pagamentos' => ['required', 'array', 'min:1'],
            'pagamentos.*.forma_pagamento' => ['required', 'in:dinheiro,cartao,cartao_debito,pix,boleto,cheque,crediario,a_prazo,outros'],
            'pagamentos.*.valor' => ['required', 'numeric', 'min:0'],
        ]);

        try {
            $venda = $this->service->faturar($os, $data['pagamentos'], $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['venda' => $venda, 'ordem_servico' => $os->fresh()], 201);
    }

    public function cancelar(OrdemServico $os)
    {
        try {
            $os = $this->service->cancelar($os);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return $os;
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'loja_id' => ['required', Rule::exists('lojas', 'id')->where('empresa_id', TenantContext::id())],
            'cliente_id' => ['required', Rule::exists('clientes', 'id')->where('empresa_id', TenantContext::id())],
            'ativo_id' => ['nullable', Rule::exists('ativos', 'id')->where('empresa_id', TenantContext::id())],
            'profissional_id' => ['nullable', Rule::exists('users', 'id')->where('empresa_id', TenantContext::id())],
            'descricao_problema' => ['nullable', 'string', 'max:2000'],
            'observacoes' => ['nullable', 'string', 'max:2000'],
            'data_previsao' => ['nullable', 'date'],
            'itens' => ['nullable', 'array'],
            'itens.*.produto_id' => ['required', Rule::exists('produtos', 'id')->where('empresa_id', TenantContext::id())],
            'itens.*.quantidade' => ['required', 'numeric', 'min:0.001'],
            'itens.*.preco_unitario' => ['required', 'numeric', 'min:0'],
        ]);
    }
}
