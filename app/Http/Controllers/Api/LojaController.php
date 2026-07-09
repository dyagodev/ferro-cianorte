<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use Illuminate\Http\Request;

class LojaController extends Controller
{
    public function index()
    {
        return Loja::orderBy('nome')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cnpj' => ['nullable', 'string', 'max:18'],
            'endereco' => ['nullable', 'string', 'max:255'],
            'ativo' => ['boolean'],
        ]);

        return response()->json(Loja::create($data), 201);
    }

    public function show(Loja $loja)
    {
        return $loja;
    }

    public function update(Request $request, Loja $loja)
    {
        $data = $request->validate([
            'nome' => ['sometimes', 'required', 'string', 'max:255'],
            'cnpj' => ['nullable', 'string', 'max:18'],
            'endereco' => ['nullable', 'string', 'max:255'],
            'ativo' => ['boolean'],
        ]);

        $loja->update($data);

        return $loja;
    }

    public function destroy(Loja $loja)
    {
        $loja->delete();

        return response()->json(null, 204);
    }
}
