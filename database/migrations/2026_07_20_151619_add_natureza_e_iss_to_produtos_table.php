<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            // "tipo" já existe (vem do sync do Link Pro, valores tipo "Normal") —
            // natureza é conceito nosso, produto x serviço, pra saber se o item
            // entra numa NFC-e/NF-e (produto) ou numa NFS-e (serviço).
            $table->string('natureza')->default('produto')->after('tipo');
            $table->string('codigo_servico_municipal')->nullable()->after('natureza');
            $table->decimal('aliquota_iss', 5, 2)->nullable()->after('codigo_servico_municipal');
        });
    }

    public function down(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->dropColumn(['natureza', 'codigo_servico_municipal', 'aliquota_iss']);
        });
    }
};
