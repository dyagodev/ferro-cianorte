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
        Schema::create('sync_execucoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sync_conexao_id')->constrained('sync_conexoes')->cascadeOnDelete();
            $table->timestamp('iniciado_em');
            $table->timestamp('finalizado_em')->nullable();
            $table->string('status')->default('em_andamento'); // em_andamento | sucesso | erro
            $table->unsignedInteger('vendas_sincronizadas')->default(0);
            $table->unsignedInteger('estoque_atualizado')->default(0);
            $table->json('avisos')->nullable();
            $table->text('erro')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_execucoes');
    }
};
