<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Entidade genérica (não "Pet"/"Veiculo"/"Paciente" hardcoded) que uma
     * Ordem de Serviço pode referenciar — a tela usa o rótulo certo pro
     * ramo do cliente (ex.: "Pet" pra pet shop), mas o backend fica
     * agnóstico de propósito (ver docs/modules/service/README.md).
     */
    public function up(): void
    {
        Schema::create('ativos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('cliente_id')->constrained('clientes');

            // Texto livre de propósito (ex.: "pet", "veiculo") — sem enum
            // fixo no v1, cada ramo usa o que fizer sentido.
            $table->string('tipo')->nullable();
            $table->string('nome');
            // Microchip, placa, número de série — o que fizer sentido pro tipo.
            $table->string('identificador')->nullable();
            $table->text('observacoes')->nullable();
            $table->boolean('ativo')->default(true);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ativos');
    }
};
