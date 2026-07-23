<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['descricao', 'codigo_servico_municipal', 'aliquota_iss', 'preco_venda', 'ativo'])]
class Servico extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected function casts(): array
    {
        return [
            'aliquota_iss' => 'decimal:2',
            'preco_venda' => 'decimal:2',
            'ativo' => 'boolean',
        ];
    }
}
