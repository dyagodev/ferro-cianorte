<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['venda_id', 'produto_id', 'servico_id', 'quantidade', 'preco_original', 'preco_unitario', 'total'])]
class VendaItem extends Model
{
    use HasFactory;

    protected $table = 'venda_itens';

    protected function casts(): array
    {
        return [
            'quantidade' => 'decimal:3',
            'preco_original' => 'decimal:2',
            'preco_unitario' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function venda(): BelongsTo
    {
        return $this->belongsTo(Venda::class);
    }

    public function produto(): BelongsTo
    {
        return $this->belongsTo(Produto::class);
    }

    public function servico(): BelongsTo
    {
        return $this->belongsTo(Servico::class);
    }

    public function ehServico(): bool
    {
        return $this->servico_id !== null;
    }
}
