<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['manifesto_transporte_id', 'tipo', 'chave'])]
class ManifestoDocumento extends Model
{
    use HasFactory;

    protected $table = 'manifesto_documentos';

    public function manifesto(): BelongsTo
    {
        return $this->belongsTo(ManifestoTransporte::class, 'manifesto_transporte_id');
    }
}
