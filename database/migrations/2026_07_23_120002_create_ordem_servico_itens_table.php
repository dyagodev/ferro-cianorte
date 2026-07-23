<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Espelha VendaItem de propósito — na hora de faturar, esses itens
     * viram itens de Venda 1:1 (ver OrdemServicoService::faturar()).
     * Reaproveita Produto como catálogo: produto vs serviço já é resolvido
     * por Produto::ehServico() (natureza), não cria uma entidade "Serviço"
     * separada.
     */
    public function up(): void
    {
        Schema::create('ordem_servico_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ordem_servico_id')->constrained('ordens_servico')->cascadeOnDelete();
            $table->foreignId('produto_id')->constrained('produtos');
            $table->decimal('quantidade', 12, 3);
            $table->decimal('preco_unitario', 12, 2);
            $table->decimal('total', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ordem_servico_itens');
    }
};
