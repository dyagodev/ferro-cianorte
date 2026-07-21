<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'produto_id',
    'loja_id',
    'quantidade_antes',
    'quantidade_depois',
    'tipo',
    'origem_tipo',
    'origem_id',
    'user_id',
    'observacao',
])]
class MovimentacaoEstoque extends Model
{
    use BelongsToEmpresa;

    protected $table = 'movimentacoes_estoque';

    // Log imutável — não existe "atualizado em", só quando aconteceu.
    const UPDATED_AT = null;

    protected $appends = ['delta'];

    protected function casts(): array
    {
        return [
            'quantidade_antes' => 'decimal:3',
            'quantidade_depois' => 'decimal:3',
        ];
    }

    public function produto(): BelongsTo
    {
        return $this->belongsTo(Produto::class);
    }

    public function loja(): BelongsTo
    {
        return $this->belongsTo(Loja::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function getDeltaAttribute(): float
    {
        return (float) $this->quantidade_depois - (float) $this->quantidade_antes;
    }
}
