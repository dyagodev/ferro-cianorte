<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['uuid', 'loja_id', 'sync_conexao_id', 'user_id', 'vendedor_externo_nome', 'cliente_id', 'ordem_servico_id', 'subtotal', 'desconto', 'total', 'status', 'feita_offline'])]
class Venda extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'desconto' => 'decimal:2',
            'total' => 'decimal:2',
            'feita_offline' => 'boolean',
        ];
    }

    public function loja(): BelongsTo
    {
        return $this->belongsTo(Loja::class);
    }

    public function syncConexao(): BelongsTo
    {
        return $this->belongsTo(SyncConexao::class);
    }

    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function ordemServico(): BelongsTo
    {
        return $this->belongsTo(OrdemServico::class);
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function itens(): HasMany
    {
        return $this->hasMany(VendaItem::class);
    }

    public function pagamentos(): HasMany
    {
        return $this->hasMany(VendaPagamento::class);
    }

    /**
     * Uma venda pode ter mais de uma nota (carrinho misto produto+serviço
     * vira NFC-e + NFS-e, ver VendaController::emitirNotaSeConfigurado) —
     * hasOne pegaria uma qualquer das duas. Use notasFiscais() pra listar
     * todas; isso aqui fica só pelo caso comum (só NFC-e).
     */
    public function notaFiscal(): HasOne
    {
        return $this->hasOne(NotaFiscal::class)->where('tipo', 'nfce');
    }

    public function notasFiscais(): HasMany
    {
        return $this->hasMany(NotaFiscal::class);
    }
}
