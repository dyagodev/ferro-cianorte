<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ID da empresa/CNPJ dentro do painel da Spedy — necessário pra
        // apontar o upload de certificado (POST /v1/companies/{id}/certificates),
        // diferente da API key (que autentica, mas não identifica QUAL
        // empresa cadastrada lá dentro da conta Spedy).
        Schema::table('empresas', function (Blueprint $table) {
            $table->string('spedy_company_id')->nullable()->after('spedy_ambiente');
        });

        Schema::table('lojas', function (Blueprint $table) {
            $table->string('spedy_company_id')->nullable()->after('spedy_ambiente');
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn('spedy_company_id');
        });

        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn('spedy_company_id');
        });
    }
};
