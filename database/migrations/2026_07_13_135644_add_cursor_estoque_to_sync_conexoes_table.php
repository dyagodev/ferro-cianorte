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
        Schema::table('sync_conexoes', function (Blueprint $table) {
            // Cursor composto (timestamp, id) do histórico de estoque
            // (log_produto_qtd_estoque) — ver estoque.sql pra detalhe do
            // porquê precisa ser composto (evita perder registros que
            // empatam no mesmo timestamp exato, comum em contagem em lote).
            $table->timestamp('ultima_atualizacao_estoque')->nullable()->after('ultimo_id_processado');
            $table->unsignedBigInteger('ultimo_id_estoque')->default(0)->after('ultima_atualizacao_estoque');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sync_conexoes', function (Blueprint $table) {
            $table->dropColumn(['ultima_atualizacao_estoque', 'ultimo_id_estoque']);
        });
    }
};
