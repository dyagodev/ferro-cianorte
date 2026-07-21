<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            // Emissão direta (NfceService) não tem gateway hospedando o XML
            // (url_xml, pensado pra Spedy) — o conteúdo assinado fica aqui.
            $table->longText('xml_gerado')->nullable()->after('resposta_bruta');
        });
    }

    public function down(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropColumn('xml_gerado');
        });
    }
};
