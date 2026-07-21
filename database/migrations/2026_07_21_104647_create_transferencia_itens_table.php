<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transferencia_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transferencia_estoque_id')->constrained('transferencias_estoque')->cascadeOnDelete();
            $table->foreignId('produto_id')->constrained('produtos');
            $table->decimal('quantidade', 12, 3);
            // Valor unitário usado na NF-e de transferência — sugerido a
            // partir do preco_custo do produto na hora de adicionar (mesmo
            // titular nos dois lados, não tem "venda" de verdade, só precisa
            // de um valor pra compor a nota).
            $table->decimal('preco_unitario', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transferencia_itens');
    }
};
