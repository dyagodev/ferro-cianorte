<?php

use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\SyncConexaoController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('admin')->name('admin.')->group(function () {
    Route::get('/login', [AuthController::class, 'showLoginForm'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.attempt');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::middleware(['auth', 'role:admin'])->group(function () {
        Route::post('/sync-conexoes/testar', [SyncConexaoController::class, 'testar'])->name('sync-conexoes.testar');
        Route::post('/sync-conexoes/{syncConexao}/sincronizar', [SyncConexaoController::class, 'sincronizar'])->name('sync-conexoes.sincronizar');
        Route::get('/sync-conexoes/{syncConexao}/execucoes', [SyncConexaoController::class, 'execucoes'])->name('sync-conexoes.execucoes');
        Route::resource('sync-conexoes', SyncConexaoController::class)
            ->except(['show'])
            ->parameters(['sync-conexoes' => 'syncConexao']);
    });
});
