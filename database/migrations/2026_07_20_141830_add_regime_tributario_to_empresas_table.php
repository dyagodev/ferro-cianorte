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
        Schema::table('empresas', function (Blueprint $table) {
            // Define que campo do grupo fiscal importa pra ela: Simples usa
            // csosn, Lucro Presumido/Real usa cst_icms — ver GrupoFiscal.
            $table->string('regime_tributario')->default('simples_nacional')->after('nome');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn('regime_tributario');
        });
    }
};
