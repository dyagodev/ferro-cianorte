<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'sync_conexao_id',
    'iniciado_em',
    'finalizado_em',
    'status',
    'vendas_sincronizadas',
    'estoque_atualizado',
    'avisos',
    'erro',
])]
class SyncExecucao extends Model
{
    protected $table = 'sync_execucoes';

    public function syncConexao(): BelongsTo
    {
        return $this->belongsTo(SyncConexao::class);
    }

    protected function casts(): array
    {
        return [
            'iniciado_em' => 'datetime',
            'finalizado_em' => 'datetime',
            'avisos' => 'array',
        ];
    }
}
