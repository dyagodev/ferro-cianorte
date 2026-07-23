<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Servico;
use Illuminate\Http\Request;

class ServicoController extends Controller
{
    public function index(Request $request)
    {
        $query = Servico::query()->where('ativo', true)->orderBy('descricao');

        if ($busca = $request->string('q')->toString()) {
            $query->where('descricao', 'like', "%{$busca}%");
        }

        if ($request->has('page')) {
            return $query->paginate($request->integer('per_page') ?: 20);
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        return response()->json(Servico::create($this->validated($request)), 201);
    }

    public function show(Servico $servico)
    {
        return $servico;
    }

    public function update(Request $request, Servico $servico)
    {
        $servico->update($this->validated($request));

        return $servico;
    }

    public function destroy(Servico $servico)
    {
        $servico->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'descricao' => ['required', 'string', 'max:255'],
            'codigo_servico_municipal' => ['nullable', 'string', 'max:255'],
            'aliquota_iss' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'preco_venda' => ['nullable', 'numeric', 'min:0'],
            'ativo' => ['boolean'],
        ]);
    }
}
