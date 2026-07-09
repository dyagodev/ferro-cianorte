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
        Schema::table('venda_itens', function (Blueprint $table) {
            // Preço de tabela do produto no momento da venda, para auditoria de
            // alterações manuais de preço feitas no caixa (preco_unitario = valor cobrado).
            $table->decimal('preco_original', 12, 2)->default(0)->after('produto_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('venda_itens', function (Blueprint $table) {
            $table->dropColumn('preco_original');
        });
    }
};
