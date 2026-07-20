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
        Schema::create('grupos_fiscais', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->string('nome');
            $table->string('ncm', 8)->nullable();

            // CFOP muda conforme a venda é dentro ou fora do estado da
            // empresa — por isso os dois, não um só.
            $table->string('cfop_dentro_estado', 4)->nullable();
            $table->string('cfop_fora_estado', 4)->nullable();

            // ICMS: csosn é de quem é Simples Nacional, cst_icms é de quem é
            // Lucro Presumido/Real — nunca os dois preenchidos pro mesmo
            // grupo (a empresa só tem um regime), mas guarda os dois campos
            // porque o grupo em si não sabe o regime, só a empresa dona dele.
            $table->string('csosn', 3)->nullable();
            $table->string('cst_icms', 2)->nullable();
            $table->decimal('aliquota_icms', 5, 2)->nullable();

            $table->string('cst_pis', 2)->nullable();
            $table->decimal('aliquota_pis', 5, 2)->nullable();
            $table->string('cst_cofins', 2)->nullable();
            $table->decimal('aliquota_cofins', 5, 2)->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('grupos_fiscais');
    }
};
