<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            // Precisa saber o estado da loja emissora pra decidir CFOP
            // dentro/fora do estado na hora de montar NF-e (comparado com o UF
            // do cliente destinatário).
            $table->string('uf', 2)->nullable()->after('endereco');
        });
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn('uf');
        });
    }
};
