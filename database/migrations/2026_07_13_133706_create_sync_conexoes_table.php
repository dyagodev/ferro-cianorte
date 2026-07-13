<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sync_conexoes', function (Blueprint $table) {
            $table->id();
            $table->string('nome');
            $table->foreignId('loja_id')->constrained('lojas');
            $table->string('host');
            $table->unsignedInteger('porta')->default(5432);
            $table->string('database');
            $table->string('usuario');
            $table->text('senha');
            $table->boolean('ssl')->default(false);
            $table->boolean('ativo')->default(true);
            // Vendas anteriores a esta data nunca são sincronizadas (evita
            // replicar histórico antigo na primeira execução). Ver
            // sync-agent/README.md, mesma lógica do SYNC_DESDE do agente.
            $table->date('sync_desde')->nullable();
            $table->json('mapa_formas_pagamento')->nullable();
            $table->unsignedBigInteger('ultimo_id_processado')->nullable();
            $table->timestamp('ultima_sincronizacao_em')->nullable();
            $table->text('ultimo_erro')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_conexoes');
    }
};
