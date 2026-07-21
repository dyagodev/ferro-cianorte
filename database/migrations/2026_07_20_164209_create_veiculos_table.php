<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('veiculos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->string('placa', 8);
            $table->string('renavam', 20)->nullable();
            // Tara/capacidade em KG e M3 — exigidos pelo schema do MDF-e
            // (veicTracao/veicReboque), não usados em mais nada no sistema.
            $table->unsignedInteger('tara_kg')->default(0);
            $table->unsignedInteger('capacidade_kg')->nullable();
            $table->unsignedInteger('capacidade_m3')->nullable();
            // tpRod: 01 Truck, 02 Toco, 03 Cavalo Mecânico, 04 VAN, 05 Utilitário, 06 Outros
            $table->string('tipo_rodado', 2)->nullable();
            // tpCar: 00 Não aplicável, 01 Aberta, 02 Fechada/Baú, 03 Granelera, 04 Porta Container, 05 Sider
            $table->string('tipo_carroceria', 2)->nullable();
            $table->string('uf', 2)->nullable();
            // tracao = veículo que puxa (obrigatório no manifesto), reboque = carreta/semirreboque (opcional, pode ter mais de um).
            $table->string('tipo', 10)->default('tracao');
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('veiculos');
    }
};
