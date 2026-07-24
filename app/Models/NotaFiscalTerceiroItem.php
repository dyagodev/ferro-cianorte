<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'nota_fiscal_terceiro_id',
    'produto_id',
    'codigo_produto_fornecedor',
    'ean',
    'descricao',
    'ncm',
    'cfop',
    'unidade',
    'quantidade',
    'valor_unitario',
    'valor_total',
])]
class NotaFiscalTerceiroItem extends Model
{
    protected $table = 'notas_fiscais_terceiros_itens';

    protected function casts(): array
    {
        return [
            'quantidade' => 'decimal:3',
            'valor_unitario' => 'decimal:4',
            'valor_total' => 'decimal:2',
        ];
    }

    public function notaFiscalTerceiro(): BelongsTo
    {
        return $this->belongsTo(NotaFiscalTerceiro::class);
    }

    public function produto(): BelongsTo
    {
        return $this->belongsTo(Produto::class);
    }
}
