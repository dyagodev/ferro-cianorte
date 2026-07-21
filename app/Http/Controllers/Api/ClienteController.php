<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use Illuminate\Http\Request;

class ClienteController extends Controller
{
    public function index(Request $request)
    {
        $query = Cliente::query();

        if ($busca = $request->string('q')->toString()) {
            $query->where(function ($q) use ($busca) {
                $q->where('nome', 'like', "%{$busca}%")
                    ->orWhere('cpf_cnpj', 'like', "%{$busca}%");
            });
        }

        return $query->orderBy('nome')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Cliente::create($data), 201);
    }

    public function show(Cliente $cliente)
    {
        return $cliente;
    }

    public function update(Request $request, Cliente $cliente)
    {
        $data = $this->validated($request);
        $cliente->update($data);

        return $cliente;
    }

    public function destroy(Cliente $cliente)
    {
        $cliente->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cpf_cnpj' => ['nullable', 'string', 'max:18'],
            'inscricao_estadual' => ['nullable', 'string', 'max:20'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'endereco' => ['nullable', 'string', 'max:255'],
            // Endereço estruturado — só é obrigatório na prática pra emitir
            // NF-e (ver Cliente::possuiEnderecoCompletoParaNfe), aqui fica
            // tudo opcional pra não travar o cadastro rápido do PDV.
            'cep' => ['nullable', 'string', 'max:9'],
            'logradouro' => ['nullable', 'string', 'max:255'],
            'numero' => ['nullable', 'string', 'max:20'],
            'complemento' => ['nullable', 'string', 'max:255'],
            'bairro' => ['nullable', 'string', 'max:255'],
            'cidade' => ['nullable', 'string', 'max:255'],
            'uf' => ['nullable', 'string', 'size:2'],
            'codigo_municipio' => ['nullable', 'string', 'max:7'],
        ]);
    }
}
