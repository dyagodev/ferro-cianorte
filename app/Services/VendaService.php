<?php

namespace App\Services;

use App\Models\Produto;
use App\Models\Servico;
use App\Models\User;
use App\Models\Venda;
use Illuminate\Support\Facades\DB;

/**
 * Registro de venda extraído do VendaController pra ser reaproveitado tanto
 * pelo checkout normal do PDV quanto pela tela separada de emissão de NF-e
 * (venda de atacado, ver NfeController) — a lógica de baixar estoque, gravar
 * itens/pagamentos e calcular totais é a mesma nos dois casos.
 */
class VendaService
{
    public function __construct(private EstoqueService $estoque)
    {
    }

    public function registrar(array $data, User $user, bool $feitaOffline = false): Venda
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

            // O preço original vem do cadastro (fonte da verdade), não do que
            // o cliente mandar, pra auditar corretamente alteração de preço
            // no caixa. Cada item chega com produto_id OU servico_id — nunca
            // os dois — por isso duas buscas separadas em vez de uma só.
            $produtoIds = collect($data['itens'])->pluck('produto_id')->filter();
            $servicoIds = collect($data['itens'])->pluck('servico_id')->filter();
            $produtos = Produto::whereIn('id', $produtoIds)->get()->keyBy('id');
            $servicos = Servico::whereIn('id', $servicoIds)->get()->keyBy('id');

            foreach ($data['itens'] as $item) {
                $ehServico = ! empty($item['servico_id']);
                $catalogo = $ehServico ? $servicos[$item['servico_id']] : $produtos[$item['produto_id']];

                $venda->itens()->create([
                    'produto_id' => $ehServico ? null : $item['produto_id'],
                    'servico_id' => $ehServico ? $item['servico_id'] : null,
                    'quantidade' => $item['quantidade'],
                    'preco_original' => $catalogo->preco_venda,
                    'preco_unitario' => $item['preco_unitario'],
                    'total' => $item['quantidade'] * $item['preco_unitario'],
                ]);

                // Serviço não tem estoque físico pra baixar.
                if (! $ehServico) {
                    $this->estoque->ajustarDelta(
                        $catalogo,
                        $lojaId,
                        -$item['quantidade'],
                        'venda',
                        usuario: $user,
                        origemTipo: 'venda',
                        origemId: $venda->id,
                    );
                }
            }

            foreach ($data['pagamentos'] as $pagamento) {
                $venda->pagamentos()->create($pagamento);
            }

            return $venda;
        });
    }
}
