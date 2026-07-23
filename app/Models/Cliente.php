<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'nome',
    'cpf_cnpj',
    'inscricao_estadual',
    'telefone',
    'endereco',
    'cep',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'cidade',
    'uf',
    'codigo_municipio',
])]
class Cliente extends Model
{
    use BelongsToEmpresa, HasFactory;

    public function vendas(): HasMany
    {
        return $this->hasMany(Venda::class);
    }

    public function ativos(): HasMany
    {
        return $this->hasMany(Ativo::class);
    }

    /**
     * NF-e exige endereço completo do destinatário (Spedy não aceita texto
     * livre) — sem isso preenchido não dá pra emitir, então checamos antes
     * de tentar (ver NfeController).
     */
    public function possuiEnderecoCompletoParaNfe(): bool
    {
        return filled($this->cpf_cnpj)
            && filled($this->cep)
            && filled($this->logradouro)
            && filled($this->numero)
            && filled($this->bairro)
            && filled($this->cidade)
            && filled($this->uf)
            && filled($this->codigo_municipio);
    }
}
