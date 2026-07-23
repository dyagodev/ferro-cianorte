<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mesmo padrão do dual-FK nullable já usado em notas_fiscais
     * (venda_id/transferencia_estoque_id) — uma Venda pode ter nascido do
     * PDV normal (null) ou de faturar uma Ordem de Serviço.
     */
    public function up(): void
    {
        Schema::table('vendas', function (Blueprint $table) {
            $table->foreignId('ordem_servico_id')->nullable()->after('cliente_id')->constrained('ordens_servico');
        });
    }

    public function down(): void
    {
        Schema::table('vendas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ordem_servico_id');
        });
    }
};
