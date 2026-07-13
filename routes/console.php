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
