<?php

namespace App\Models;

use App\Support\Texto;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Referência global (não por empresa) — não usa BelongsToEmpresa de
 * propósito, é a mesma lista de municípios do Brasil pra todo mundo.
 */
#[Fillable(['codigo_ibge', 'nome', 'nome_normalizado', 'uf'])]
class Municipio extends Model
{
    /**
     * Sem acento e minúsculo, pra buscar "campo mourao" e achar "Campo
     * Mourão" — usado tanto na importação (grava normalizado) quanto na
     * busca (normaliza o termo digitado do mesmo jeito antes do LIKE). Ver
     * App\Support\Texto::normalizar (mesma normalização usada em Produto).
     */
    public static function normalizar(string $texto): string
    {
        return Texto::normalizar($texto);
    }
}
