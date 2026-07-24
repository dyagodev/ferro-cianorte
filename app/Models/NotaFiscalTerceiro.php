<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'loja_id',
    'chave_acesso',
    'nsu',
    'emitente_cnpj',
    'emitente_nome',
    'valor_total',
    'data_emissao',
    'situacao',
    'manifestada',
    'xml',
    'entrada_estoque_em',
    'entrada_estoque_user_id',
])]
class NotaFiscalTerceiro extends Model
{
    use BelongsToEmpresa;

    protected $table = 'notas_fiscais_terceiros';

    protected function casts(): array
    {
        return [
            'valor_total' => 'decimal:2',
            'data_emissao' => 'datetime',
            'manifestada' => 'boolean',
            'entrada_estoque_em' => 'datetime',
        ];
    }

    public function loja(): BelongsTo
    {
        return $this->belongsTo(Loja::class);
    }

    public function itens(): HasMany
    {
        return $this->hasMany(NotaFiscalTerceiroItem::class);
    }

    public function entradaEstoqueUsuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'entrada_estoque_user_id');
    }

    public function completa(): bool
    {
        return $this->situacao === 'completa';
    }

    public function possuiEntradaEstoque(): bool
    {
        return $this->entrada_estoque_em !== null;
    }
}
