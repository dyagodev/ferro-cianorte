<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CaixaController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\CondutorController;
use App\Http\Controllers\Api\EntregadorController;
use App\Http\Controllers\Api\FornecedorController;
use App\Http\Controllers\Api\FuncionarioController;
use App\Http\Controllers\Api\GrupoFiscalController;
use App\Http\Controllers\Api\LojaController;
use App\Http\Controllers\Api\ManifestoTransporteController;
use App\Http\Controllers\Api\MunicipioController;
use App\Http\Controllers\Api\NfeController;
use App\Http\Controllers\Api\NotaFiscalController;
use App\Http\Controllers\Api\NotaFiscalTerceiroController;
use App\Http\Controllers\Api\ProdutoController;
use App\Http\Controllers\Api\RelatorioController;
use App\Http\Controllers\Api\SpedyWebhookController;
use App\Http\Controllers\Api\AtivoController;
use App\Http\Controllers\Api\OrdemServicoController;
use App\Http\Controllers\Api\ServicoController;
use App\Http\Controllers\Api\TransferenciaEstoqueController;
use App\Http\Controllers\Api\VeiculoController;
use App\Http\Controllers\Api\VendaController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

// Chamado pela Spedy (não por um usuário logado) — fora de auth:sanctum.
Route::post('/webhooks/spedy', SpedyWebhookController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Acessível a admin e vendedor (tela de PDV).
    Route::get('/produtos', [ProdutoController::class, 'index']);
    Route::get('/produtos/{produto}', [ProdutoController::class, 'show']);
    Route::get('/clientes', [ClienteController::class, 'index']);
    Route::post('/clientes', [ClienteController::class, 'store']);
    Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);

    // Referência global (não por empresa) — busca local, ver ImportarMunicipios.
    Route::get('/municipios', [MunicipioController::class, 'index']);

    Route::post('/vendas', [VendaController::class, 'store']);
    Route::post('/vendas/sync', [VendaController::class, 'sync']);
    Route::get('/vendas', [VendaController::class, 'index']);
    // Cancelar é ação de qualquer usuário (não só admin) — vendedor só
    // pode cancelar venda da própria loja, checado dentro do controller
    // (ver VendaController::cancelar).
    Route::post('/vendas/{venda}/cancelar', [VendaController::class, 'cancelar']);

    // Abertura, sangria e fechamento de caixa: acessível a admin e
    // vendedor, escopado à loja de cada um (admin informa a loja, vendedor
    // usa a própria).
    Route::get('/caixa/situacao', [CaixaController::class, 'situacao']);
    Route::post('/caixa/abertura', [CaixaController::class, 'abrir']);
    Route::post('/caixa/sangrias', [CaixaController::class, 'sangria']);
    Route::get('/caixa/fechamento', [CaixaController::class, 'fechamento']);
    Route::post('/caixa/fechamento', [CaixaController::class, 'fechar']);

    // Administração: apenas role admin.
    Route::middleware('role:admin')->group(function () {
        Route::get('/lojas/consulta-cnpj/{cnpj}', [LojaController::class, 'consultarCnpj']);
        Route::apiResource('lojas', LojaController::class);
        Route::post('/lojas/{loja}/spedy-certificado', [LojaController::class, 'enviarCertificado']);
        Route::post('/lojas/{loja}/certificado-fiscal', [LojaController::class, 'enviarCertificadoFiscal']);
        Route::post('/produtos', [ProdutoController::class, 'store']);
        Route::put('/produtos/{produto}', [ProdutoController::class, 'update']);
        Route::delete('/produtos/{produto}', [ProdutoController::class, 'destroy']);
        Route::post('/produtos/{produto}/estoque', [ProdutoController::class, 'definirEstoque']);
        Route::post('/produtos/{produto}/estoque/ativo', [ProdutoController::class, 'alternarAtivoNaLoja']);

        Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
        Route::delete('/clientes/{cliente}', [ClienteController::class, 'destroy']);

        Route::apiResource('fornecedores', FornecedorController::class);
        Route::apiResource('grupos-fiscais', GrupoFiscalController::class)->parameters(['grupos-fiscais' => 'grupoFiscal']);
        Route::apiResource('funcionarios', FuncionarioController::class);
        Route::apiResource('entregadores', EntregadorController::class);

        Route::post('/vendas/{venda}/emitir-nota', [VendaController::class, 'emitirNota']);

        // Consulta consolidada — todas as notas emitidas, filtrável por
        // status/tipo/loja/período (ver NotaFiscalController).
        Route::get('/notas-fiscais', [NotaFiscalController::class, 'index']);

        // Tela separada de venda de atacado/revenda — emite NF-e (não passa pelo carrinho do PDV).
        Route::post('/notas-fiscais/nfe', [NfeController::class, 'store']);
        Route::get('/notas-fiscais/{notaFiscal}/danfe', [VendaController::class, 'baixarDanfe']);
        Route::get('/notas-fiscais/{notaFiscal}/xml', [VendaController::class, 'baixarXml']);
        Route::post('/notas-fiscais/{notaFiscal}/cancelar', [VendaController::class, 'cancelarNota']);

        // Notas de fornecedor emitidas contra o CNPJ da loja (compra),
        // descobertas via Distribuição DFe na SEFAZ — ver
        // DistribuicaoDfeService. Diferente de notas-fiscais acima (que
        // são as que NÓS emitimos).
        Route::get('/notas-entrada', [NotaFiscalTerceiroController::class, 'index']);
        Route::get('/notas-entrada/{notaFiscalTerceiro}', [NotaFiscalTerceiroController::class, 'show']);
        Route::post('/notas-entrada/sincronizar', [NotaFiscalTerceiroController::class, 'sincronizar']);
        Route::post('/notas-entrada/{notaFiscalTerceiro}/dar-entrada', [NotaFiscalTerceiroController::class, 'darEntrada']);

        // MDF-e — direto na SEFAZ, sem gateway (ver MdfeService).
        Route::apiResource('veiculos', VeiculoController::class);
        Route::apiResource('condutores', CondutorController::class)->parameters(['condutores' => 'condutor']);
        Route::apiResource('manifestos-transporte', ManifestoTransporteController::class)
            ->parameters(['manifestos-transporte' => 'manifesto']);
        Route::post('/manifestos-transporte/{manifesto}/emitir', [ManifestoTransporteController::class, 'emitir']);

        // Logística: transferência de estoque entre lojas da mesma
        // empresa — NF-e de transferência (e MDF-e opcional, reaproveita
        // manifestos-transporte acima) ver TransferenciaEstoqueService.
        Route::apiResource('transferencias-estoque', TransferenciaEstoqueController::class)
            ->parameters(['transferencias-estoque' => 'transferencia']);
        Route::post('/transferencias-estoque/{transferencia}/emitir', [TransferenciaEstoqueController::class, 'emitir']);
        Route::post('/transferencias-estoque/{transferencia}/confirmar-sem-nota', [TransferenciaEstoqueController::class, 'confirmarSemNota']);
        Route::post('/transferencias-estoque/{transferencia}/receber', [TransferenciaEstoqueController::class, 'receber']);
        Route::post('/transferencias-estoque/{transferencia}/cancelar', [TransferenciaEstoqueController::class, 'cancelar']);

        // Módulo de Serviços: Ativo (Pet/Veículo/o que fizer sentido) e
        // Ordem de Serviço, que vira Venda de verdade ao faturar (ver
        // OrdemServicoService::faturar()).
        Route::apiResource('ativos', AtivoController::class);
        Route::apiResource('servicos', ServicoController::class);
        // Sem destroy: OS não se exclui, se cancela (ver cancelar() abaixo)
        // — histórico de acompanhamento deve ficar registrado.
        Route::apiResource('ordens-servico', OrdemServicoController::class)
            ->parameters(['ordens-servico' => 'os'])
            ->except(['destroy']);
        Route::post('/ordens-servico/{os}/itens', [OrdemServicoController::class, 'adicionarItem']);
        Route::delete('/ordens-servico/{os}/itens/{item}', [OrdemServicoController::class, 'removerItem']);
        Route::post('/ordens-servico/{os}/status', [OrdemServicoController::class, 'mudarStatus']);
        Route::post('/ordens-servico/{os}/faturar', [OrdemServicoController::class, 'faturar']);
        Route::post('/ordens-servico/{os}/cancelar', [OrdemServicoController::class, 'cancelar']);

        Route::get('/relatorios/vendas', [RelatorioController::class, 'vendas']);
        Route::get('/relatorios/possui-integracao-linkpro', [RelatorioController::class, 'possuiIntegracaoLinkPro']);
        Route::get('/relatorios/fechamento-caixa', [RelatorioController::class, 'fechamentoCaixa']);
        Route::get('/relatorios/produtos-mais-vendidos', [RelatorioController::class, 'produtosMaisVendidos']);
        Route::get('/relatorios/estoque-baixo', [RelatorioController::class, 'estoqueBaixo']);
        Route::get('/relatorios/estoque-historico', [RelatorioController::class, 'historicoEstoque']);
    });
});
