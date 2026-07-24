<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cursor de paginação incremental exigido pela SEFAZ na consulta de
     * Distribuição DFe (ver DistribuicaoDfeService) — cada chamada parte
     * do último NSU já processado, senão a SEFAZ manda tudo de novo desde
     * o início. String (não inteiro) porque a SEFAZ trata NSU como um
     * campo de até 15 dígitos com zeros à esquerda, sem necessidade de
     * aritmética em cima dele por aqui.
     */
    public function up(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->string('nfe_dist_ult_nsu')->nullable()->after('nfe_proximo_numero');
        });
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn('nfe_dist_ult_nsu');
        });
    }
};
