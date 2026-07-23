<?php

namespace App\Console\Commands;

use App\Models\Venda;
use App\Services\EstoqueService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Reverte cancelamentos de venda feitos numa data — pro caso de alguém
 * cancelar em massa por engano (ou um script/lote errado). Volta o status
 * pra "concluida" e desfaz o estorno de estoque que VendaController::cancelar
 * tinha feito (decrementa de novo).
 *
 * Usa updated_at como data do cancelamento — é o único carimbo que muda
 * quando o status vira "cancelada" (não existe uma coluna cancelado_em
 * separada), então não reverte venda que foi cancelada e depois alterada
 * por outro motivo (não há esse fluxo hoje).
 */
#[Signature('vendas:reverter-cancelamentos {data : Data no formato Y-m-d, em horário de Brasília} {--force : Não pede confirmação}')]
#[Description('Reverte vendas canceladas numa data específica, devolvendo o status e desfazendo o estorno de estoque')]
class ReverterCancelamentosVenda extends Command
{
    public function handle(EstoqueService $estoque): int
    {
        try {
            $dia = Carbon::createFromFormat('Y-m-d', $this->argument('data'), 'America/Sao_Paulo');
        } catch (\Throwable) {
            $this->error('Data inválida — use o formato Y-m-d (ex.: 2026-07-14).');

            return self::FAILURE;
        }

        $vendas = Venda::with('itens.produto')
            ->where('status', 'cancelada')
            ->whereBetween('updated_at', [$dia->copy()->startOfDay(), $dia->copy()->endOfDay()])
            ->get();

        if ($vendas->isEmpty()) {
            $this->info("Nenhuma venda cancelada em {$dia->format('d/m/Y')}.");

            return self::SUCCESS;
        }

        $this->table(
            ['id', 'loja_id', 'total', 'cancelada em (Brasília)'],
            $vendas->map(fn (Venda $v) => [
                $v->id, $v->loja_id, "R$ {$v->total}", $v->updated_at->timezone('America/Sao_Paulo')->format('d/m/Y H:i:s'),
            ])->all(),
        );

        if (! $this->option('force') && ! $this->confirm("Reverter o cancelamento dessas {$vendas->count()} venda(s)?")) {
            $this->comment('Nada foi alterado.');

            return self::SUCCESS;
        }

        foreach ($vendas as $venda) {
            DB::transaction(function () use ($venda, $estoque) {
                foreach ($venda->itens as $item) {
                    if ($item->produto && ! $item->ehServico()) {
                        $estoque->ajustarDelta(
                            $item->produto,
                            $venda->loja_id,
                            -$item->quantidade,
                            'venda',
                            origemTipo: 'venda',
                            origemId: $venda->id,
                            observacao: 'Reversão de cancelamento via vendas:reverter-cancelamentos',
                        );
                    }
                }

                $venda->update(['status' => 'concluida']);
            });

            $this->line("Venda #{$venda->id} revertida pra \"concluida\".");
        }

        $this->info("{$vendas->count()} venda(s) revertida(s).");

        return self::SUCCESS;
    }
}
