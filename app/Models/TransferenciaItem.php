<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['transferencia_estoque_id', 'produto_id', 'quantidade', 'preco_unitario'])]
class TransferenciaItem extends Model
{
    protected $table = 'transferencia_itens';

    protected function casts(): array
    {
        return [
            'quantidade' => 'decimal:3',
            'preco_unitario' => 'decimal:2',
        ];
    }

    public function transferenciaEstoque(): BelongsTo
    {
        return $this->belongsTo(TransferenciaEstoque::class);
    }

    public function produto(): BelongsTo
    {
        return $this->belongsTo(Produto::class);
    }
}
