<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'codigo_barras',
    'codigo_interno',
    'descricao',
    'unidade',
    'tipo',
    'grupo',
    'subgrupo',
    'marca',
    'fornecedor_id',
    'preco_custo',
    'margem_percentual',
    'preco_venda',
    'estoque_minimo',
    'ativo',
])]
class Produto extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'preco_custo' => 'decimal:2',
            'margem_percentual' => 'decimal:2',
            'preco_venda' => 'decimal:2',
        ];
    }

    public function fornecedor(): BelongsTo
    {
        return $this->belongsTo(Fornecedor::class);
    }

    public function estoques(): HasMany
    {
        return $this->hasMany(ProdutoEstoque::class);
    }

    public function estoqueNaLoja(int $lojaId): int
    {
        return $this->estoques()->where('loja_id', $lojaId)->value('quantidade') ?? 0;
    }
}
