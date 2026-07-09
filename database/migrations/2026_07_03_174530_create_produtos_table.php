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
        Schema::create('produtos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_barras')->nullable()->unique();
            $table->string('descricao');
            $table->string('unidade', 10)->default('UN');
            $table->string('tipo')->default('Normal');
            $table->string('grupo')->nullable();
            $table->string('subgrupo')->nullable();
            $table->string('marca')->nullable();
            $table->foreignId('fornecedor_id')->nullable()->constrained('fornecedores')->nullOnDelete();
            $table->decimal('preco_custo', 12, 2)->default(0);
            $table->decimal('margem_percentual', 8, 2)->default(0);
            $table->decimal('preco_venda', 12, 2)->default(0);
            $table->integer('estoque_minimo')->default(0);
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('produtos');
    }
};
