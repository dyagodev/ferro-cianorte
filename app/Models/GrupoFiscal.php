<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'nome',
    'ncm',
    'cfop_dentro_estado',
    'cfop_fora_estado',
    'csosn',
    'cst_icms',
    'percentual_reducao_bc',
    'aliquota_icms',
    'cst_pis',
    'aliquota_pis',
    'cst_cofins',
    'aliquota_cofins',
    'cst_ibscbs',
    'cclasstrib_ibscbs',
])]
class GrupoFiscal extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected $table = 'grupos_fiscais';

    protected function casts(): array
    {
        return [
            'percentual_reducao_bc' => 'decimal:2',
            'aliquota_icms' => 'decimal:2',
            'aliquota_pis' => 'decimal:2',
            'aliquota_cofins' => 'decimal:2',
        ];
    }

    public function produtos(): HasMany
    {
        return $this->hasMany(Produto::class);
    }
}
