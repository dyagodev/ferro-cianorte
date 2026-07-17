<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nome', 'cnpj', 'contato'])]
class Fornecedor extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected $table = 'fornecedores';

    public function produtos(): HasMany
    {
        return $this->hasMany(Produto::class);
    }
}
