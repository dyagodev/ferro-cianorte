<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nome', 'cpf_cnpj', 'telefone', 'endereco'])]
class Cliente extends Model
{
    use HasFactory;

    public function vendas(): HasMany
    {
        return $this->hasMany(Venda::class);
    }
}
