<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use App\Models\NotaFiscalTerceiro;
use App\Models\Produto;
use App\Services\DistribuicaoDfeService;
use App\Services\EstoqueService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class NotaFiscalTerceiroController extends Controller
{
    public function __construct(
        private DistribuicaoDfeService $distribuicaoDfe,
        private EstoqueService $estoque,
    ) {
    }

    public function index(Request $request)
    {
        $query = NotaFiscalTerceiro::with('loja:id,nome')
            ->withCount('itens')
            ->orderByDesc('data_emissao');

        if ($lojaId = $request->integer('loja_id')) {
            $query->where('loja_id', $lojaId);
        }

        if ($situacao = $request->string('situacao')->toString()) {
            $query->where('situacao', $situacao);
        }

        if ($request->filled('data_inicio')) {
            $query->where('data_emissao', '>=', $request->string('data_inicio'));
        }

        if ($request->filled('data_fim')) {
            $query->where('data_emissao', '<=', $request->string('data_fim'));
        }

        return $query->paginate($request->integer('per_page') ?: 20);
    }

    public function show(NotaFiscalTerceiro $notaFiscalTerceiro)
    {
        return $notaFiscalTerceiro->load(['itens.produto', 'loja:id,nome', 'entradaEstoqueUsuario:id,name']);
    }

    public function sincronizar(Request $request)
    {
        $data = $request->validate([
            'loja_id' => ['required', 'exists:lojas,id'],
        ]);

        $loja = Loja::findOrFail($data['loja_id']);

        try {
            $resumo = $this->distribuicaoDfe->sincronizar($loja);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Falha ao consultar a SEFAZ: '.$e->getMessage()], 422);
        }

        return response()->json($resumo);
    }

    /**
     * Confirma a entrada de estoque a partir dos itens já casados com
     * Produto — itens sem produto_id ficam de fora (permite confirmar
     * parcial, o resto pode ser dado entrada depois numa nova chamada).
     */
    public function darEntrada(Request $request, NotaFiscalTerceiro $notaFiscalTerceiro)
    {
        if ($notaFiscalTerceiro->possuiEntradaEstoque()) {
            return response()->json(['message' => 'Essa nota já teve entrada de estoque confirmada.'], 422);
        }

        if (! $notaFiscalTerceiro->completa()) {
            return response()->json(['message' => 'XML completo da nota ainda não foi baixado.'], 422);
        }

        $data = $request->validate([
            'itens' => ['required', 'array', 'min:1'],
            'itens.*.id' => ['required', 'exists:notas_fiscais_terceiros_itens,id'],
            'itens.*.produto_id' => ['nullable', 'exists:produtos,id'],
        ]);

        $usuario = $request->user();

        DB::transaction(function () use ($notaFiscalTerceiro, $data, $usuario) {
            foreach ($data['itens'] as $itemData) {
                if (blank($itemData['produto_id'] ?? null)) {
                    continue;
                }

                $item = $notaFiscalTerceiro->itens()->findOrFail($itemData['id']);
                $item->update(['produto_id' => $itemData['produto_id']]);

                $produto = Produto::findOrFail($itemData['produto_id']);

                $this->estoque->ajustarDelta(
                    $produto,
                    $notaFiscalTerceiro->loja_id,
                    (float) $item->quantidade,
                    'entrada_nf_terceiro',
                    usuario: $usuario,
                    origemTipo: 'nota_fiscal_terceiro',
                    origemId: $notaFiscalTerceiro->id,
                );
            }

            $notaFiscalTerceiro->update([
                'entrada_estoque_em' => now(),
                'entrada_estoque_user_id' => $usuario->id,
            ]);
        });

        return $notaFiscalTerceiro->fresh(['itens.produto']);
    }
}
