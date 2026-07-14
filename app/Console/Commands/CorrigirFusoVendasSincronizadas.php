<?php

namespace App\Console\Commands;

use App\Models\Venda;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Correção ÚNICA (rodar uma vez só): antes do fix do fuso horário em
 * LinkProSyncService::registrarVenda, toda venda sincronizada do Link Pro
 * gravava o timestamp cru (horário de Brasília) como se já fosse UTC, sem
 * converter — ficava 3h atrasada em qualquer listagem. Soma 3h em
 * created_at/updated_at das vendas sincronizadas ANTES do momento
 * informado (a venda sincronizada depois do deploy do fix já está certa —
 * corrigir ela de novo doeria a data errada na direção oposta).
 *
 * Usa DB::table (query builder puro, não Eloquent) de propósito: um
 * ->save() do model dispararia o auto-touch de updated_at de novo,
 * atropelando o valor que a gente está tentando setar.
 */
#[Signature('vendas:corrigir-fuso-sincronizadas {antes : Só corrige vendas sincronizadas antes desse momento (Y-m-d H:i:s, horário de Brasília) — normalmente o momento em que você fez o deploy do fix} {--force : Não pede confirmação}')]
#[Description('Corrige (uma vez só) o fuso horário de vendas sincronizadas do Link Pro gravadas antes do fix')]
class CorrigirFusoVendasSincronizadas extends Command
{
    public function handle(): int
    {
        try {
            $limite = \Illuminate\Support\Carbon::createFromFormat('Y-m-d H:i:s', $this->argument('antes'), 'America/Sao_Paulo');
        } catch (\Throwable) {
            $this->error('Data/hora inválida — use o formato Y-m-d H:i:s (ex.: "2026-07-14 14:00:00").');

            return self::FAILURE;
        }

        $vendas = Venda::whereNotNull('sync_conexao_id')
            ->where('created_at', '<', $limite)
            ->get(['id', 'created_at', 'updated_at']);

        if ($vendas->isEmpty()) {
            $this->info('Nenhuma venda sincronizada antes desse momento.');

            return self::SUCCESS;
        }

        $this->info("{$vendas->count()} venda(s) sincronizada(s) serão corrigidas (+3h em created_at/updated_at).");
        $this->line('Exemplo (5 primeiras):');
        $this->table(
            ['id', 'created_at atual (errado)', 'vira (corrigido)'],
            $vendas->take(5)->map(fn (Venda $v) => [
                $v->id, $v->created_at, $v->created_at->copy()->addHours(3),
            ])->all(),
        );

        if (! $this->option('force') && ! $this->confirm('Confirma a correção? Rode isso só uma vez — corrigir de novo desfaz o certo.')) {
            $this->comment('Nada foi alterado.');

            return self::SUCCESS;
        }

        foreach ($vendas as $venda) {
            DB::table('vendas')->where('id', $venda->id)->update([
                'created_at' => $venda->created_at->copy()->addHours(3),
                'updated_at' => $venda->updated_at->copy()->addHours(3),
            ]);
        }

        $this->info("{$vendas->count()} venda(s) corrigida(s).");

        return self::SUCCESS;
    }
}
