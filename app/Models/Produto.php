<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use App\Support\Texto;
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
    'natureza',
    'codigo_servico_municipal',
    'aliquota_iss',
    'grupo',
    'subgrupo',
    'marca',
    'fornecedor_id',
    'grupo_fiscal_id',
    'preco_custo',
    'margem_percentual',
    'preco_venda',
    'estoque_minimo',
    'ativo',
])]
class Produto extends Model
{
    use BelongsToEmpresa, HasFactory;

    /**
     * "descricao_normalizada" (sem acento, minúscula) é o que a busca do
     * PDV/F3/NF-e realmente consulta (ver ProdutoController::index) — sem
     * sincronizar aqui, "Água Mineral" nunca apareceria buscando "agua".
     */
    protected static function booted(): void
    {
        static::saving(function (Produto $produto) {
            if ($produto->isDirty('descricao')) {
                $produto->descricao_normalizada = Texto::normalizar($produto->descricao);
            }
        });
    }

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'preco_custo' => 'decimal:2',
            'margem_percentual' => 'decimal:2',
            'preco_venda' => 'decimal:2',
            'aliquota_iss' => 'decimal:2',
        ];
    }

    public function fornecedor(): BelongsTo
    {
        return $this->belongsTo(Fornecedor::class);
    }

    public function grupoFiscal(): BelongsTo
    {
        return $this->belongsTo(GrupoFiscal::class);
    }

    public function ehServico(): bool
    {
        return $this->natureza === 'servico';
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
