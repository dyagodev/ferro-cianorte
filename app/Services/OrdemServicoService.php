<?php

namespace App\Services;

use App\Models\OrdemServico;
use App\Models\OrdemServicoItem;
use App\Models\User;
use App\Models\Venda;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Ordem de Serviço é só a camada de acompanhamento (diagnóstico, itens
 * usados, execução) ANTES da venda acontecer. Ao faturar (ver faturar()),
 * ela vira uma Venda de verdade via VendaService::registrar() — herda de
 * graça baixa de estoque (produto vs serviço, ver VendaItem::ehServico()),
 * emissão fiscal e relatórios já existentes. Não duplica nada disso aqui.
 */
class OrdemServicoService
{
    private const TRANSICOES_PERMITIDAS = [
        'aberta' => ['em_execucao', 'cancelada'],
        'em_execucao' => ['concluida', 'cancelada'],
        'concluida' => [],
    ];

    public function __construct(private VendaService $vendas)
    {
    }

    public function criar(array $dados, User $user): OrdemServico
    {
        return DB::transaction(function () use ($dados, $user) {
            $os = OrdemServico::create([
                'loja_id' => $dados['loja_id'],
                'cliente_id' => $dados['cliente_id'],
                'ativo_id' => $dados['ativo_id'] ?? null,
                'user_id' => $user->id,
                'profissional_id' => $dados['profissional_id'] ?? null,
                'descricao_problema' => $dados['descricao_problema'] ?? null,
                'observacoes' => $dados['observacoes'] ?? null,
                'data_previsao' => $dados['data_previsao'] ?? null,
            ]);

            foreach ($dados['itens'] ?? [] as $item) {
                $os->itens()->create([
                    'produto_id' => $item['produto_id'] ?? null,
                    'servico_id' => $item['servico_id'] ?? null,
                    'quantidade' => $item['quantidade'],
                    'preco_unitario' => $item['preco_unitario'],
                    'total' => $item['quantidade'] * $item['preco_unitario'],
                ]);
            }

            $this->recalcularTotais($os);

            return $os->fresh(['itens.produto', 'itens.servico', 'cliente', 'ativo']);
        });
    }

    public function adicionarItem(OrdemServico $os, array $item): OrdemServico
    {
        if (! $os->editavel()) {
            throw new RuntimeException('Só é possível adicionar item numa Ordem de Serviço aberta ou em execução.');
        }

        DB::transaction(function () use ($os, $item) {
            $os->itens()->create([
                'produto_id' => $item['produto_id'] ?? null,
                'servico_id' => $item['servico_id'] ?? null,
                'quantidade' => $item['quantidade'],
                'preco_unitario' => $item['preco_unitario'],
                'total' => $item['quantidade'] * $item['preco_unitario'],
            ]);

            $this->recalcularTotais($os);
        });

        return $os->fresh(['itens.produto', 'itens.servico']);
    }

    public function removerItem(OrdemServico $os, OrdemServicoItem $item): OrdemServico
    {
        if (! $os->editavel()) {
            throw new RuntimeException('Só é possível remover item numa Ordem de Serviço aberta ou em execução.');
        }

        DB::transaction(function () use ($os, $item) {
            $item->delete();
            $this->recalcularTotais($os);
        });

        return $os->fresh(['itens.produto', 'itens.servico']);
    }

    public function mudarStatus(OrdemServico $os, string $novoStatus): OrdemServico
    {
        $permitidas = self::TRANSICOES_PERMITIDAS[$os->status] ?? [];

        if (! in_array($novoStatus, $permitidas, true)) {
            throw new RuntimeException("Não é possível mudar de \"{$os->status}\" pra \"{$novoStatus}\".");
        }

        $os->update([
            'status' => $novoStatus,
            'data_conclusao' => $novoStatus === 'concluida' ? now() : $os->data_conclusao,
        ]);

        return $os->fresh();
    }

    public function cancelar(OrdemServico $os): OrdemServico
    {
        return $this->mudarStatus($os, 'cancelada');
    }

    /**
     * Converte a Ordem de Serviço numa Venda de verdade — mesmo caminho do
     * checkout do PDV (VendaService::registrar()), então baixa de estoque
     * e disponibilidade pra emissão fiscal já vêm de graça. A OS guarda o
     * venda_id resultante, a Venda guarda o ordem_servico_id de volta
     * (mesmo padrão dual-FK já usado em NotaFiscal).
     */
    public function faturar(OrdemServico $os, array $pagamentos, User $user): Venda
    {
        if (! $os->podeFaturar()) {
            throw new RuntimeException('Essa Ordem de Serviço não pode ser faturada (precisa estar concluída e ter ao menos um item).');
        }

        return DB::transaction(function () use ($os, $pagamentos, $user) {
            $venda = $this->vendas->registrar([
                'uuid' => (string) Str::uuid(),
                'loja_id' => $os->loja_id,
                'cliente_id' => $os->cliente_id,
                'desconto' => $os->desconto,
                'itens' => $os->itens->map(fn (OrdemServicoItem $item) => [
                    'produto_id' => $item->produto_id,
                    'servico_id' => $item->servico_id,
                    'quantidade' => $item->quantidade,
                    'preco_unitario' => $item->preco_unitario,
                ])->all(),
                'pagamentos' => $pagamentos,
            ], $user);

            $venda->update(['ordem_servico_id' => $os->id]);
            $os->update(['venda_id' => $venda->id, 'status' => 'faturada']);

            return $venda->fresh(['itens', 'pagamentos']);
        });
    }

    private function recalcularTotais(OrdemServico $os): void
    {
        $subtotal = (float) $os->itens()->sum('total');
        $desconto = min((float) $os->desconto, $subtotal);

        $os->update([
            'subtotal' => $subtotal,
            'desconto' => $desconto,
            'total' => $subtotal - $desconto,
        ]);
    }
}
