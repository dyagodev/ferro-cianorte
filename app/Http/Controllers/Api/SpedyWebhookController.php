<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SpedyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Recebe os callbacks de invoice.status_changed / invoice.authorized /
 * invoice.rejected / invoice.canceled da Spedy. Rota FORA de auth:sanctum
 * (é a Spedy chamando, não um usuário logado) — por isso não passa por
 * TenantContext/EmpresaScope; SpedyService::processarWebhook() busca a
 * nota com withoutGlobalScopes() e casa pelo spedy_invoice_id.
 */
class SpedyWebhookController extends Controller
{
    public function __invoke(Request $request, SpedyService $spedy): JsonResponse
    {
        $spedy->processarWebhook($request->all());

        return response()->json(['ok' => true]);
    }
}
