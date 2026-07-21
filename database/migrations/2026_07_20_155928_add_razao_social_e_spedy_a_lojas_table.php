<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->string('razao_social')->nullable()->after('cnpj');

            // Config Spedy própria da loja — opcional. Uma loja pode emitir
            // nota com CNPJ diferente da empresa mãe (filial com
            // credenciamento fiscal próprio); quando não preenchido, o
            // SpedyService cai pra config da empresa (ver Loja::possuiSpedyConfigurado).
            $table->string('spedy_ambiente')->nullable()->after('uf');
            $table->text('spedy_api_key')->nullable()->after('spedy_ambiente');
            $table->string('spedy_token_id')->nullable()->after('spedy_api_key');
            $table->string('spedy_csc')->nullable()->after('spedy_token_id');
            $table->string('spedy_serie_nfce')->nullable()->after('spedy_csc');
        });
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn([
                'razao_social', 'spedy_ambiente', 'spedy_api_key',
                'spedy_token_id', 'spedy_csc', 'spedy_serie_nfce',
            ]);
        });
    }
};
