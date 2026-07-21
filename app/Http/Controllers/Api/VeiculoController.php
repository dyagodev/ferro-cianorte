<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Veiculo;
use Illuminate\Http\Request;

class VeiculoController extends Controller
{
    public function index(Request $request)
    {
        $query = Veiculo::query()->where('ativo', true);

        if ($tipo = $request->string('tipo')->toString()) {
            $query->where('tipo', $tipo);
        }

        return $query->orderBy('placa')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Veiculo::create($data), 201);
    }

    public function show(Veiculo $veiculo)
    {
        return $veiculo;
    }

    public function update(Request $request, Veiculo $veiculo)
    {
        $data = $this->validated($request, sometimes: true);
        $veiculo->update($data);

        return $veiculo;
    }

    public function destroy(Veiculo $veiculo)
    {
        $veiculo->update(['ativo' => false]);

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $sometimes = false): array
    {
        $regra = $sometimes ? ['sometimes', 'required'] : ['required'];

        return $request->validate([
            'placa' => [...$regra, 'string', 'max:8'],
            'renavam' => ['nullable', 'string', 'max:20'],
            'tara_kg' => [...$regra, 'integer', 'min:0'],
            'capacidade_kg' => ['nullable', 'integer', 'min:0'],
            'capacidade_m3' => ['nullable', 'integer', 'min:0'],
            'tipo_rodado' => ['nullable', 'string', 'max:2'],
            'tipo_carroceria' => ['nullable', 'string', 'max:2'],
            'uf' => ['nullable', 'string', 'size:2'],
            'tipo' => ['nullable', 'in:tracao,reboque'],
            'ativo' => ['boolean'],
        ]);
    }
}
