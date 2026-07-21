<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'placa',
    'renavam',
    'tara_kg',
    'capacidade_kg',
    'capacidade_m3',
    'tipo_rodado',
    'tipo_carroceria',
    'uf',
    'tipo',
    'ativo',
])]
class Veiculo extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected function casts(): array
    {
        return ['ativo' => 'boolean'];
    }

    public function ehReboque(): bool
    {
        return $this->tipo === 'reboque';
    }
}
