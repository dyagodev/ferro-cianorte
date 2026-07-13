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
        Schema::table('sync_execucoes', function (Blueprint $table) {
            // incremental (vendas + log de estoque) ou reconciliacao_completa
            // (lê produto.qtd_estoque direto, sem depender do cursor).
            $table->string('tipo')->default('incremental')->after('sync_conexao_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sync_execucoes', function (Blueprint $table) {
            $table->dropColumn('tipo');
        });
    }
};
