<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Entidade própria, separada de Produto de propósito (era Produto com
     * natureza=servico — confuso misturar no mesmo cadastro/formulário
     * campos de estoque/custo que não fazem sentido pra serviço). Bem mais
     * enxuta: sem estoque, sem preco_custo/margem/grupo_fiscal_id.
     */
    public function up(): void
    {
        Schema::create('servicos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->string('descricao');
            // ISS — mesmos dois campos que existiam em Produto.
            $table->string('codigo_servico_municipal')->nullable();
            $table->decimal('aliquota_iss', 5, 2)->nullable();
            $table->decimal('preco_venda', 12, 2)->default(0);
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('servicos');
    }
};
