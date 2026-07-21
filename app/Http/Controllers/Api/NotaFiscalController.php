<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use App\Models\NotaFiscal;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Consulta consolidada de notas fiscais (NFC-e/NF-e/NFS-e), pra não
 * precisar caçar venda por venda em Relatórios > Vendas — mesmo dado, só
 * que filtrável por status/tipo direto.
 */
class NotaFiscalController extends Controller
{
    public function index(Request $request)
    {
        $query = NotaFiscal::with([
            'venda:id,loja_id,cliente_id,total,status',
            'venda.loja:id,nome',
            'venda.cliente:id,nome',
        ])->orderByDesc('created_at');

        if ($tipo = $request->string('tipo')->toString()) {
            $query->where('tipo', $tipo);
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($lojaId = $request->integer('loja_id')) {
            // Loja::query() já sai filtrada pelo EmpresaScope — mesmo
            // raciocínio do RelatorioController::lojaIdsPermitidas, evita
            // um loja_id de outro tenant vazar pelo filtro.
            $lojaValida = Loja::query()->whereKey($lojaId)->exists();
            $query->whereHas('venda', fn ($q) => $q->where('loja_id', $lojaValida ? $lojaId : 0));
        }

        if ($request->filled('data_inicio') || $request->filled('data_fim')) {
            [$inicio, $fim] = $this->periodo($request);
            $query->whereBetween('created_at', [$inicio, $fim]);
        }

        return $query->paginate($request->integer('per_page') ?: 30);
    }

    /**
     * Mesmo raciocínio do RelatorioController::periodo — datas do filtro
     * são sempre dia civil de Brasília.
     */
    private function periodo(Request $request): array
    {
        $inicio = $request->filled('data_inicio')
            ? Carbon::parse($request->string('data_inicio'), 'America/Sao_Paulo')->startOfDay()
            : Carbon::now('America/Sao_Paulo')->subDays(30)->startOfDay();

        $fim = $request->filled('data_fim')
            ? Carbon::parse($request->string('data_fim'), 'America/Sao_Paulo')->endOfDay()
            : Carbon::now('America/Sao_Paulo')->endOfDay();

        return [$inicio, $fim];
    }
}
