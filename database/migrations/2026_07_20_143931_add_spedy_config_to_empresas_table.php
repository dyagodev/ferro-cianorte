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
            // Sem cast "encrypted" aqui só por causa da coluna — quem lê/
            // escreve é o model NotaFiscal::spedyApiKey (cast encrypted:array
            // ou encrypted string), mais fácil de trocar de algoritmo depois
            // sem migration nova.
            $table->string('spedy_ambiente')->default('sandbox')->after('regime_tributario');
            $table->text('spedy_api_key')->nullable()->after('spedy_ambiente');
            $table->string('spedy_token_id')->nullable()->after('spedy_api_key');
            $table->string('spedy_csc')->nullable()->after('spedy_token_id');
            $table->string('spedy_serie_nfce')->nullable()->after('spedy_csc');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn(['spedy_ambiente', 'spedy_api_key', 'spedy_token_id', 'spedy_csc', 'spedy_serie_nfce']);
        });
    }
};
