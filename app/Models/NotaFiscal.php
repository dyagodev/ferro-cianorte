<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'venda_id',
    'transferencia_estoque_id',
    'tipo',
    'spedy_invoice_id',
    'status',
    'chave_acesso',
    'numero',
    'serie',
    'url_danfe',
    'url_xml',
    'codigo_retorno',
    'mensagem_retorno',
    'payload_enviado',
    'resposta_bruta',
    'xml_gerado',
])]
class NotaFiscal extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected $table = 'notas_fiscais';

    protected function casts(): array
    {
        return [
            'payload_enviado' => 'array',
            'resposta_bruta' => 'array',
        ];
    }

    public function venda(): BelongsTo
    {
        return $this->belongsTo(Venda::class);
    }

    public function transferenciaEstoque(): BelongsTo
    {
        return $this->belongsTo(TransferenciaEstoque::class);
    }

    public function autorizada(): bool
    {
        return $this->status === 'authorized';
    }

    public function rejeitada(): bool
    {
        return $this->status === 'rejected';
    }
}
