<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ativo;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AtivoController extends Controller
{
    public function index(Request $request)
    {
        $query = Ativo::with('cliente:id,nome')->orderBy('nome');

        if ($clienteId = $request->integer('cliente_id')) {
            $query->where('cliente_id', $clienteId);
        }

        if ($busca = $request->string('q')->toString()) {
            $query->where(function ($q) use ($busca) {
                $q->where('nome', 'like', "%{$busca}%")
                    ->orWhere('identificador', 'like', "%{$busca}%");
            });
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        return response()->json(Ativo::create($this->validated($request)), 201);
    }

    public function show(Ativo $ativo)
    {
        return $ativo->load('cliente:id,nome');
    }

    public function update(Request $request, Ativo $ativo)
    {
        $ativo->update($this->validated($request));

        return $ativo;
    }

    public function destroy(Ativo $ativo)
    {
        $ativo->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'cliente_id' => ['required', Rule::exists('clientes', 'id')->where('empresa_id', TenantContext::id())],
            'tipo' => ['nullable', 'string', 'max:255'],
            'nome' => ['required', 'string', 'max:255'],
            'identificador' => ['nullable', 'string', 'max:255'],
            'observacoes' => ['nullable', 'string', 'max:1000'],
            'ativo' => ['boolean'],
        ]);
    }
}
