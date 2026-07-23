<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * produto_id vira nullable + servico_id nullable novo — exatamente um
     * dos dois preenchido por item (ver VendaService::registrar()). Mesmo
     * padrão dual-FK já usado em notas_fiscais (venda_id/
     * transferencia_estoque_id) e vendas.ordem_servico_id.
     */
    public function up(): void
    {
        Schema::table('venda_itens', function (Blueprint $table) {
            $table->foreignId('produto_id')->nullable()->change();
            $table->foreignId('servico_id')->nullable()->after('produto_id')->constrained('servicos');
        });

        Schema::table('ordem_servico_itens', function (Blueprint $table) {
            $table->foreignId('produto_id')->nullable()->change();
            $table->foreignId('servico_id')->nullable()->after('produto_id')->constrained('servicos');
        });
    }

    public function down(): void
    {
        Schema::table('venda_itens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('servico_id');
            $table->foreignId('produto_id')->nullable(false)->change();
        });

        Schema::table('ordem_servico_itens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('servico_id');
            $table->foreignId('produto_id')->nullable(false)->change();
        });
    }
};
