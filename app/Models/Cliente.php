<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nome', 'cpf_cnpj', 'telefone', 'endereco'])]
class Cliente extends Model
{
    use BelongsToEmpresa, HasFactory;

    public function vendas(): HasMany
    {
        return $this->hasMany(Venda::class);
    }
}
