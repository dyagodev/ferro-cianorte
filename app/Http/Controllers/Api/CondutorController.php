<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Condutor;
use Illuminate\Http\Request;

class CondutorController extends Controller
{
    public function index()
    {
        return Condutor::where('ativo', true)->orderBy('nome')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Condutor::create($data), 201);
    }

    public function show(Condutor $condutor)
    {
        return $condutor;
    }

    public function update(Request $request, Condutor $condutor)
    {
        $data = $this->validated($request, sometimes: true);
        $condutor->update($data);

        return $condutor;
    }

    public function destroy(Condutor $condutor)
    {
        $condutor->update(['ativo' => false]);

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $sometimes = false): array
    {
        $regra = $sometimes ? ['sometimes', 'required'] : ['required'];

        return $request->validate([
            'nome' => [...$regra, 'string', 'max:255'],
            'cpf' => [...$regra, 'string', 'max:14'],
            'ativo' => ['boolean'],
        ]);
    }
}
