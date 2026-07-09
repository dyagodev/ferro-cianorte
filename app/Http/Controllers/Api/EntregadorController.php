<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Entregador;
use Illuminate\Http\Request;

class EntregadorController extends Controller
{
    public function index()
    {
        return Entregador::with('loja')->orderBy('nome')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Entregador::create($data), 201);
    }

    public function show(Entregador $entregador)
    {
        return $entregador->load('loja');
    }

    public function update(Request $request, Entregador $entregador)
    {
        $data = $this->validated($request);
        $entregador->update($data);

        return $entregador;
    }

    public function destroy(Entregador $entregador)
    {
        $entregador->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'loja_id' => ['required', 'exists:lojas,id'],
            'nome' => ['required', 'string', 'max:255'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'veiculo' => ['nullable', 'string', 'max:255'],
            'ativo' => ['boolean'],
        ]);
    }
}
