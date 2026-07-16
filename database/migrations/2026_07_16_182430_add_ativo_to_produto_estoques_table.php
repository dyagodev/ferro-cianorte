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
        Schema::table('produto_estoques', function (Blueprint $table) {
            // false quando o produto não existe mais no Link Pro daquela
            // loja específica (ver LinkProSyncService::sincronizarCatalogoLoja)
            // — desliga o produto só ali, sem mexer no cadastro global nem
            // no vínculo dele com outras lojas.
            $table->boolean('ativo')->default(true)->after('quantidade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('produto_estoques', function (Blueprint $table) {
            $table->dropColumn('ativo');
        });
    }
};
