<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['nome', 'cpf', 'ativo'])]
class Condutor extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected $table = 'condutores';

    protected function casts(): array
    {
        return ['ativo' => 'boolean'];
    }
}
