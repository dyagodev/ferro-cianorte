<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\EntregadorController;
use App\Http\Controllers\Api\FornecedorController;
use App\Http\Controllers\Api\FuncionarioController;
use App\Http\Controllers\Api\LojaController;
use App\Http\Controllers\Api\ProdutoController;
use App\Http\Controllers\Api\RelatorioController;
use App\Http\Controllers\Api\VendaController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Acessível a admin e vendedor (tela de PDV).
    Route::get('/produtos', [ProdutoController::class, 'index']);
    Route::get('/produtos/{produto}', [ProdutoController::class, 'show']);
    Route::get('/clientes', [ClienteController::class, 'index']);
    Route::post('/clientes', [ClienteController::class, 'store']);
    Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);

    Route::post('/vendas', [VendaController::class, 'store']);
    Route::post('/vendas/sync', [VendaController::class, 'sync']);
    Route::get('/vendas', [VendaController::class, 'index']);

    // Administração: apenas role admin.
    Route::middleware('role:admin')->group(function () {
        Route::apiResource('lojas', LojaController::class);
        Route::post('/produtos', [ProdutoController::class, 'store']);
        Route::put('/produtos/{produto}', [ProdutoController::class, 'update']);
        Route::delete('/produtos/{produto}', [ProdutoController::class, 'destroy']);
        Route::post('/produtos/{produto}/estoque', [ProdutoController::class, 'definirEstoque']);

        Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
        Route::delete('/clientes/{cliente}', [ClienteController::class, 'destroy']);

        Route::apiResource('fornecedores', FornecedorController::class);
        Route::apiResource('funcionarios', FuncionarioController::class);
        Route::apiResource('entregadores', EntregadorController::class);

        Route::get('/relatorios/vendas', [RelatorioController::class, 'vendas']);
        Route::get('/relatorios/fechamento-caixa', [RelatorioController::class, 'fechamentoCaixa']);
        Route::get('/relatorios/produtos-mais-vendidos', [RelatorioController::class, 'produtosMaisVendidos']);
        Route::get('/relatorios/estoque-baixo', [RelatorioController::class, 'estoqueBaixo']);
    });
});
