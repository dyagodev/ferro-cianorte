<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('municipios', function (Blueprint $table) {
            // Sem acento e minúsculo — o operador digita "campo mourao" sem
            // acento na busca, e "nome" tem "Campo Mourão" com acento;
            // LIKE puro não casa os dois (ver MunicipioController).
            $table->string('nome_normalizado')->nullable()->after('nome');
            $table->index(['uf', 'nome_normalizado']);
        });
    }

    public function down(): void
    {
        Schema::table('municipios', function (Blueprint $table) {
            $table->dropColumn('nome_normalizado');
        });
    }
};
