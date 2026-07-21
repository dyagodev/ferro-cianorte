<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * CST 20/70/90 (redução de base de cálculo) exige a tag pRedBC no XML
     * — sem essa coluna, o grupo fiscal não tem de onde tirar esse valor
     * e a nota sai com <pRedBC/> vazio, rejeitada pelo XSD da SEFAZ (visto
     * na prática ao emitir NFC-e de produto com CST 20 sem esse dado).
     */
    public function up(): void
    {
        Schema::table('grupos_fiscais', function (Blueprint $table) {
            $table->decimal('percentual_reducao_bc', 5, 2)->nullable()->after('cst_icms');
        });
    }

    public function down(): void
    {
        Schema::table('grupos_fiscais', function (Blueprint $table) {
            $table->dropColumn('percentual_reducao_bc');
        });
    }
};
