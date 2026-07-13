<?php

namespace App\Console\Commands;

use App\Models\SyncExecucao;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * O incremental roda a cada minuto — sem expurgo, sync_execucoes cresce sem
 * parar (~1440 linhas/dia por conexão) e a tela de "Execuções" fica pesada
 * pra sempre mostrando execução de semanas atrás sem utilidade prática.
 */
#[Signature('sync:limpar-execucoes {--horas=48 : Mantém apenas execuções iniciadas nas últimas N horas}')]
#[Description('Remove registros antigos de sync_execucoes, mantendo só as execuções recentes')]
class LimparExecucoesSync extends Command
{
    public function handle(): int
    {
        $horas = (int) $this->option('horas');
        $corte = now()->subHours($horas);

        $removidas = SyncExecucao::where('iniciado_em', '<', $corte)->delete();

        $this->info("{$removidas} execução(ões) anterior(es) a {$corte->format('d/m/Y H:i')} removida(s).");

        return self::SUCCESS;
    }
}
