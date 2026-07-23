<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'loja_id',
    'cliente_id',
    'ativo_id',
    'user_id',
    'profissional_id',
    'status',
    'descricao_problema',
    'observacoes',
    'data_previsao',
    'data_conclusao',
    'venda_id',
    'subtotal',
    'desconto',
    'total',
])]
class OrdemServico extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected $table = 'ordens_servico';

    protected function casts(): array
    {
        return [
            'data_abertura' => 'datetime',
            'data_previsao' => 'datetime',
            'data_conclusao' => 'datetime',
            'subtotal' => 'decimal:2',
            'desconto' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function loja(): BelongsTo
    {
        return $this->belongsTo(Loja::class);
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function ativo(): BelongsTo
    {
        return $this->belongsTo(Ativo::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function profissional(): BelongsTo
    {
        return $this->belongsTo(User::class, 'profissional_id');
    }

    public function venda(): BelongsTo
    {
        return $this->belongsTo(Venda::class);
    }

    public function itens(): HasMany
    {
        return $this->hasMany(OrdemServicoItem::class);
    }

    public function editavel(): bool
    {
        return in_array($this->status, ['aberta', 'em_execucao'], true);
    }

    public function podeFaturar(): bool
    {
        return $this->status === 'concluida' && $this->itens()->exists();
    }

    public function podeCancelar(): bool
    {
        return in_array($this->status, ['aberta', 'em_execucao'], true);
    }
}
