<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->string('cnpj', 18)->nullable()->unique()->after('nome');
            $table->string('razao_social')->nullable()->after('cnpj');
            $table->string('endereco')->nullable()->after('razao_social');
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn(['cnpj', 'razao_social', 'endereco']);
        });
    }
};
