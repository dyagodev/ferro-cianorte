<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['loja_id', 'nome', 'telefone', 'veiculo', 'ativo'])]
class Entregador extends Model
{
    use HasFactory;

    protected $table = 'entregadores';

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
        ];
    }

    public function loja(): BelongsTo
    {
        return $this->belongsTo(Loja::class);
    }
}
