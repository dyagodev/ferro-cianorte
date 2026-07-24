<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Linhas de item parseadas do XML completo (nó <det>, ver
     * DistribuicaoDfeService) — só existem depois que a nota vira
     * situacao=completa. produto_id fica nulo até o usuário casar o item
     * com um Produto do cadastro (ver NotaFiscalTerceiroController::
     * darEntrada) — sem FK obrigatória de propósito, mercadoria de
     * fornecedor não tem por que já bater com o catálogo interno.
     */
    public function up(): void
    {
        Schema::create('notas_fiscais_terceiros_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('nota_fiscal_terceiro_id')->constrained('notas_fiscais_terceiros')->cascadeOnDelete();
            $table->foreignId('produto_id')->nullable()->constrained('produtos')->nullOnDelete();

            $table->string('codigo_produto_fornecedor')->nullable();
            $table->string('ean')->nullable();
            $table->string('descricao');
            $table->string('ncm')->nullable();
            $table->string('cfop')->nullable();
            $table->string('unidade')->nullable();
            $table->decimal('quantidade', 12, 3);
            $table->decimal('valor_unitario', 12, 4);
            $table->decimal('valor_total', 12, 2);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notas_fiscais_terceiros_itens');
    }
};
