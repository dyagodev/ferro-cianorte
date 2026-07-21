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
        Schema::table('grupos_fiscais', function (Blueprint $table) {
            // NT 2025.002 (Reforma Tributária) — Código de Situação Tributária
            // e Classificação Tributária do IBS/CBS por item. Default =
            // tributação integral (caso mais comum de revenda), ver
            // NfceService::montarIbsCbs().
            $table->string('cst_ibscbs', 3)->nullable()->default('000');
            $table->string('cclasstrib_ibscbs', 6)->nullable()->default('000001');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('grupos_fiscais', function (Blueprint $table) {
            $table->dropColumn(['cst_ibscbs', 'cclasstrib_ibscbs']);
        });
    }
};
