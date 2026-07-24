<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['produto_id', 'loja_id', 'quantidade', 'ativo', 'ultima_qtd_estoque_linkpro'])]
class ProdutoEstoque extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'quantidade' => 'decimal:3',
            'ativo' => 'boolean',
            'ultima_qtd_estoque_linkpro' => 'decimal:3',
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
}
