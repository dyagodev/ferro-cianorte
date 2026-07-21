<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * codigo_barras e codigo_interno eram únicos GLOBALMENTE (toda empresa
     * cliente compartilhando o mesmo índice) — bug real de multi-tenant,
     * descoberto ao importar catálogo de uma segunda empresa (REAL PET) e
     * colidir com código interno pré-existente da primeira (Ferro
     * Cianorte): duas empresas diferentes usando "453" como código interno
     * é normal (cada uma numera do zero), não devia colidir.
     */
    public function up(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->dropUnique(['codigo_barras']);
            $table->dropUnique(['codigo_interno']);
        });

        Schema::table('produtos', function (Blueprint $table) {
            $table->unique(['empresa_id', 'codigo_barras']);
            $table->unique(['empresa_id', 'codigo_interno']);
        });
    }

    public function down(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->dropUnique(['empresa_id', 'codigo_barras']);
            $table->dropUnique(['empresa_id', 'codigo_interno']);
        });

        Schema::table('produtos', function (Blueprint $table) {
            $table->unique(['codigo_barras']);
            $table->unique(['codigo_interno']);
        });
    }
};
