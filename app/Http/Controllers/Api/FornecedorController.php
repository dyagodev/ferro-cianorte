<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Fornecedor;
use Illuminate\Http\Request;

class FornecedorController extends Controller
{
    public function index()
    {
        return Fornecedor::orderBy('nome')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Fornecedor::create($data), 201);
    }

    public function show(Fornecedor $fornecedor)
    {
        return $fornecedor;
    }

    public function update(Request $request, Fornecedor $fornecedor)
    {
        $data = $this->validated($request);
        $fornecedor->update($data);

        return $fornecedor;
    }

    public function destroy(Fornecedor $fornecedor)
    {
        $fornecedor->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cnpj' => ['nullable', 'string', 'max:18'],
            'contato' => ['nullable', 'string', 'max:255'],
        ]);
    }
}
