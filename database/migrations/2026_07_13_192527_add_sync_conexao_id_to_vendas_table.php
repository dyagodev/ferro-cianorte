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
        Schema::table('vendas', function (Blueprint $table) {
            // Nulo = venda nativa (feita direto no caixa do Ferro Cianorte).
            // Preenchido = veio da sincronização com essa conexão Link Pro.
            // Usado na reconciliação completa de estoque pra saber quanto
            // descontar do valor absoluto do Link Pro (que nunca vai saber
            // de venda feita só aqui).
            $table->foreignId('sync_conexao_id')->nullable()->after('loja_id')->constrained('sync_conexoes')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vendas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sync_conexao_id');
        });
    }
};
