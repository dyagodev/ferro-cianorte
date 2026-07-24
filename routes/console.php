<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// withoutOverlapping evita rodar duas sincronizações ao mesmo tempo se uma
// demorar mais que 1 minuto (rede lenta até alguma das 3 lojas, por
// exemplo) — sem isso o cron empilharia execuções concorrentes na mesma
// conexão. O próprio command já pula conexões fora do horário de
// funcionamento configurado em cada uma.
Schedule::command('sync:lojas')->everyMinute()->withoutOverlapping(10);

// sync:lojas já roda a mesma reconciliação completa a cada minuto (ver
// LinkProSyncService::aplicarReconciliacaoEstoque) — essa aqui de madrugada
// é redundante de propósito, uma segunda rede de segurança fora do horário
// de funcionamento de qualquer loja, sem custo real por rodar só 1x/dia.
// ->timezone() é necessário porque o servidor roda em UTC (config('app.timezone'))
// — sem isso, "03:00" dispararia às 3h UTC = meia-noite em Brasília.
Schedule::command('sync:reconciliar-estoque')
    ->dailyAt('03:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(30);

// sync:lojas roda a cada minuto — sem expurgo, sync_execucoes cresce sem
// parar (~1440 linhas/dia por conexão). Mantém só as últimas 48h.
Schedule::command('sync:limpar-execucoes')
    ->dailyAt('04:00')
    ->timezone('America/Sao_Paulo');

// Distribuição DFe (notas de fornecedor emitidas contra o CNPJ da loja) —
// de madrugada, fora do horário de funcionamento, sem custo de rodar 1x/dia
// (o usuário também pode sincronizar na hora pela tela, ver
// NotaFiscalTerceiroController::sincronizar()).
Schedule::command('sync:notas-entrada')
    ->dailyAt('05:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(30);
