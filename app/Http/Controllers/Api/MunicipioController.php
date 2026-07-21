<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Municipio;
use Illuminate\Http\Request;

/**
 * Busca local (não chama o IBGE em tempo real) — a lista inteira já foi
 * importada uma vez pra base (ver App\Console\Commands\ImportarMunicipios).
 */
class MunicipioController extends Controller
{
    public function index(Request $request)
    {
        $termo = $request->string('q')->toString();
        if (mb_strlen(trim($termo)) < 2) {
            return [];
        }

        $query = Municipio::query()
            ->where('nome_normalizado', 'like', '%'.Municipio::normalizar($termo).'%');

        if ($uf = $request->string('uf')->toString()) {
            $query->where('uf', strtoupper($uf));
        }

        return $query->orderBy('nome')->limit(20)->get(['id', 'codigo_ibge', 'nome', 'uf']);
    }
}
