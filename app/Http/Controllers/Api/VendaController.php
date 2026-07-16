<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Produto;
use App\Models\ProdutoEstoque;
use App\Models\Venda;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VendaController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Venda::with(['itens.produto', 'pagamentos', 'cliente', 'vendedor', 'loja'])
            ->orderByDesc('created_at');

        if (! $user->isAdmin()) {
            $query->where('loja_id', $user->loja_id);
        } elseif ($lojaId = $request->integer('loja_id')) {
            $query->where('loja_id', $lojaId);
        }

        return $query->paginate(30);
    }

    public function store(Request $request)
    {
        $data = $this->validatedVenda($request);
        $venda = $this->registrarVenda($data, $request->user());

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
            $venda = $this->registrarVenda($data, $user, feitaOffline: true);

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
    public function cancelar(Venda $venda)
    {
        if ($venda->status === 'cancelada') {
            return response()->json(['message' => 'Esta venda já está cancelada.'], 422);
        }

        DB::transaction(function () use ($venda) {
            foreach ($venda->itens as $item) {
                ProdutoEstoque::where('produto_id', $item->produto_id)
                    ->where('loja_id', $venda->loja_id)
                    ->increment('quantidade', $item->quantidade);
            }

            $venda->update(['status' => 'cancelada']);
        });

        return $venda->fresh(['itens', 'pagamentos']);
    }

    private function registrarVenda(array $data, $user, bool $feitaOffline = false): Venda
    {
        return DB::transaction(function () use ($data, $user, $feitaOffline) {
            $vendaExistente = Venda::where('uuid', $data['uuid'])->first();
            if ($vendaExistente) {
                return $vendaExistente;
            }

            $lojaId = $user->isAdmin() ? $data['loja_id'] : $user->loja_id;

            $subtotal = collect($data['itens'])->sum(fn ($item) => $item['quantidade'] * $item['preco_unitario']);
            // O desconto nunca pode ultrapassar o subtotal (evita venda com total negativo).
            $desconto = min($data['desconto'] ?? 0, $subtotal);
            $total = $subtotal - $desconto;

            $venda = Venda::create([
                'uuid' => $data['uuid'],
                'loja_id' => $lojaId,
                'user_id' => $user->id,
                'cliente_id' => $data['cliente_id'] ?? null,
                'subtotal' => $subtotal,
                'desconto' => $desconto,
                'total' => $total,
                'status' => 'concluida',
                'feita_offline' => $feitaOffline,
            ]);

            // Vendas que vêm de fora (sync-agent do Link Pro) informam a data
            // real em que a venda aconteceu — sem isso, o created_at ficaria
            // com o momento da sincronização, não da venda, e quebraria
            // relatório por período/fechamento de caixa.
            if (! empty($data['data_hora'])) {
                $venda->created_at = $data['data_hora'];
                $venda->updated_at = $data['data_hora'];
                $venda->save();
            }

            // O preço original vem do cadastro do produto (fonte da verdade), não do
            // que o cliente mandar, para auditar corretamente alterações de preço no caixa.
            $produtos = Produto::whereIn('id', collect($data['itens'])->pluck('produto_id'))
                ->get()
                ->keyBy('id');

            foreach ($data['itens'] as $item) {
                $venda->itens()->create([
                    'produto_id' => $item['produto_id'],
                    'quantidade' => $item['quantidade'],
                    'preco_original' => $produtos[$item['produto_id']]->preco_venda,
                    'preco_unitario' => $item['preco_unitario'],
                    'total' => $item['quantidade'] * $item['preco_unitario'],
                ]);

                $this->decrementarEstoque($item['produto_id'], $lojaId, $item['quantidade']);
            }

            foreach ($data['pagamentos'] as $pagamento) {
                $venda->pagamentos()->create($pagamento);
            }

            return $venda;
        });
    }

    private function decrementarEstoque(int $produtoId, int $lojaId, float $quantidade): void
    {
        $estoque = ProdutoEstoque::where('produto_id', $produtoId)
            ->where('loja_id', $lojaId)
            ->lockForUpdate()
            ->first();

        if (! $estoque) {
            $estoque = ProdutoEstoque::create([
                'produto_id' => $produtoId,
                'loja_id' => $lojaId,
                'quantidade' => 0,
            ]);
        }

        // Estoque pode ficar negativo propositalmente: o caixa não deve travar
        // por divergência de estoque, isso é sinalizado depois em relatório.
        // Quantidade fracionária de propósito (produto vendido por peso/metro).
        $estoque->decrement('quantidade', $quantidade);
    }

    private function validatedVenda(Request $request): array
    {
        return $this->validatedVendaArray($request->all(), $request->user());
    }

    private function validatedVendaArray(array $input, $user = null): array
    {
        $validator = validator($input, [
            'uuid' => ['nullable', 'uuid'],
            'loja_id' => [$user && ! $user->isAdmin() ? 'nullable' : 'required', 'exists:lojas,id'],
            'cliente_id' => ['nullable', 'exists:clientes,id'],
            'data_hora' => ['nullable', 'date'],
            'desconto' => ['nullable', 'numeric', 'min:0'],
            'itens' => ['required', 'array', 'min:1'],
            'itens.*.produto_id' => ['required', 'exists:produtos,id'],
            'itens.*.quantidade' => ['required', 'numeric', 'min:0.001'],
            'itens.*.preco_unitario' => ['required', 'numeric', 'min:0'],
            'pagamentos' => ['required', 'array', 'min:1'],
            'pagamentos.*.forma_pagamento' => ['required', 'in:dinheiro,cartao,pix,boleto,cheque,crediario,a_prazo,outros'],
            'pagamentos.*.valor' => ['required', 'numeric', 'min:0'],
        ]);

        $data = $validator->validate();
        $data['uuid'] = $data['uuid'] ?? (string) Str::uuid();

        return $data;
    }
}
