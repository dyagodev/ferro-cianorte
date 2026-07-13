<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

#[Fillable([
    'nome',
    'loja_id',
    'host',
    'porta',
    'database',
    'usuario',
    'senha',
    'ssl',
    'ativo',
    'sync_desde',
    'janelas_funcionamento',
    'mapa_formas_pagamento',
    'ultimo_id_processado',
    'ultima_atualizacao_estoque',
    'ultimo_id_estoque',
    'ultima_sincronizacao_em',
    'ultimo_erro',
])]
#[Hidden(['senha'])]
class SyncConexao extends Model
{
    protected $table = 'sync_conexoes';

    public function loja(): BelongsTo
    {
        return $this->belongsTo(Loja::class);
    }

    public function execucoes(): HasMany
    {
        return $this->hasMany(SyncExecucao::class);
    }

    protected function casts(): array
    {
        return [
            'senha' => 'encrypted',
            'ssl' => 'boolean',
            'ativo' => 'boolean',
            'sync_desde' => 'date',
            'janelas_funcionamento' => 'array',
            'mapa_formas_pagamento' => 'array',
            'ultima_atualizacao_estoque' => 'datetime',
            'ultima_sincronizacao_em' => 'datetime',
        ];
    }

    /**
     * Sem janela configurada, roda o dia todo (comportamento atual). Com
     * janelas, só roda dentro de algum intervalo [inicio, fim) — pra não
     * bater no Postgres da loja fora do horário de funcionamento (ex.: loja
     * abre 7:30, fecha pro almoço às 11:30, reabre 13:30, fecha 17:30).
     */
    public function dentroDoHorarioDeFuncionamento(?Carbon $momento = null): bool
    {
        $janelas = $this->janelas_funcionamento;

        if (empty($janelas)) {
            return true;
        }

        $agora = ($momento ?? Carbon::now())->format('H:i');

        foreach ($janelas as $janela) {
            if (($janela['inicio'] ?? null) === null || ($janela['fim'] ?? null) === null) {
                continue;
            }

            if ($agora >= $janela['inicio'] && $agora <= $janela['fim']) {
                return true;
            }
        }

        return false;
    }
}
