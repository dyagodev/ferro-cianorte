<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Referência global (não por empresa/tenant) — lista fixa dos ~5.570
        // municípios do Brasil, importada do IBGE (ver
        // App\Console\Commands\ImportarMunicipios). Usada pra preencher
        // código IBGE + nome sem o operador precisar digitar/saber de cor
        // (Cliente, Loja, ManifestoTransporte — tudo que precisa de
        // cMun/cMunCarrega/cMunDescarga pro MDF-e e NF-e).
        Schema::create('municipios', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_ibge', 7)->unique();
            $table->string('nome');
            $table->string('uf', 2);
            $table->timestamps();

            $table->index(['uf', 'nome']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('municipios');
    }
};
