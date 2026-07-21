<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            // Opcional no schema do MDF-e, mas SEFAZ costuma rejeitar sem
            // isso na prática pra emitente CNPJ — ver MdfeService::montar.
            $table->string('inscricao_estadual', 20)->nullable()->after('cnpj');
        });
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn('inscricao_estadual');
        });
    }
};
