<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GrupoFiscal;
use Illuminate\Http\Request;

class GrupoFiscalController extends Controller
{
    public function index(Request $request)
    {
        $query = GrupoFiscal::query()->orderBy('nome');

        if ($busca = $request->string('q')->toString()) {
            $query->where('nome', 'like', "%{$busca}%");
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(GrupoFiscal::create($data), 201);
    }

    public function show(GrupoFiscal $grupoFiscal)
    {
        return $grupoFiscal;
    }

    public function update(Request $request, GrupoFiscal $grupoFiscal)
    {
        $data = $this->validated($request);
        $grupoFiscal->update($data);

        return $grupoFiscal;
    }

    public function destroy(GrupoFiscal $grupoFiscal)
    {
        // Produto com grupo_fiscal_id apontando pra ele ficaria "orfão" de
        // verdade (a coluna é nullOnDelete, então nem quebraria) — mas é
        // melhor forçar reclassificar antes do que deixar produto sem grupo
        // fiscal sem o admin perceber.
        if ($grupoFiscal->produtos()->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir um grupo fiscal com produtos vinculados — reclassifique os produtos antes.',
            ], 422);
        }

        $grupoFiscal->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'ncm' => ['nullable', 'string', 'max:8'],
            'cfop_dentro_estado' => ['nullable', 'string', 'max:4'],
            'cfop_fora_estado' => ['nullable', 'string', 'max:4'],
            'csosn' => ['nullable', 'string', 'max:3'],
            'cst_icms' => ['nullable', 'string', 'max:2'],
            'aliquota_icms' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cst_pis' => ['nullable', 'string', 'max:2'],
            'aliquota_pis' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cst_cofins' => ['nullable', 'string', 'max:2'],
            'aliquota_cofins' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);
    }
}
