<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'loja_origem_id',
    'loja_destino_id',
    'observacao',
    'user_id',
    'status',
    'nota_fiscal_id',
    'manifesto_transporte_id',
    'recebido_por',
    'recebido_em',
])]
class TransferenciaEstoque extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected $table = 'transferencias_estoque';

    protected function casts(): array
    {
        return [
            'recebido_em' => 'datetime',
        ];
    }

    public function lojaOrigem(): BelongsTo
    {
        return $this->belongsTo(Loja::class, 'loja_origem_id');
    }

    public function lojaDestino(): BelongsTo
    {
        return $this->belongsTo(Loja::class, 'loja_destino_id');
    }

    public function itens(): HasMany
    {
        return $this->hasMany(TransferenciaItem::class);
    }

    public function notaFiscal(): BelongsTo
    {
        return $this->belongsTo(NotaFiscal::class);
    }

    public function manifestoTransporte(): BelongsTo
    {
        return $this->belongsTo(ManifestoTransporte::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function recebidoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recebido_por');
    }

    public function editavel(): bool
    {
        return $this->status === 'rascunho';
    }

    public function podeEmitir(): bool
    {
        return $this->status === 'rascunho' && $this->itens()->exists();
    }

    public function podeReceber(): bool
    {
        return $this->status === 'em_transito';
    }

    public function podeCancelar(): bool
    {
        return in_array($this->status, ['rascunho', 'em_transito'], true);
    }

    public function podeGerarManifesto(): bool
    {
        return $this->status === 'em_transito' && $this->manifesto_transporte_id === null;
    }
}
