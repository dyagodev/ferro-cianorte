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
        Schema::table('sync_conexoes', function (Blueprint $table) {
            // Lista de intervalos [{"inicio":"07:30","fim":"11:30"}, ...] em
            // que a loja está aberta — o command de sincronização só roda
            // dentro desses horários. Null/vazio = roda o dia todo, sem
            // restrição (comportamento atual).
            $table->json('janelas_funcionamento')->nullable()->after('sync_desde');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sync_conexoes', function (Blueprint $table) {
            $table->dropColumn('janelas_funcionamento');
        });
    }
};
