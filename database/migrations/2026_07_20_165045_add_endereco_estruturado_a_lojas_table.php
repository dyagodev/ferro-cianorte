<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            // "endereco" (texto livre) continua existindo pra exibição —
            // esses campos estruturados são exigidos pelo MDF-e
            // (emit/enderEmit, ver MdfeService) e pela NF-e no futuro.
            $table->string('cep', 9)->nullable()->after('endereco');
            $table->string('logradouro')->nullable()->after('cep');
            $table->string('numero', 20)->nullable()->after('logradouro');
            $table->string('complemento')->nullable()->after('numero');
            $table->string('bairro')->nullable()->after('complemento');
            $table->string('cidade')->nullable()->after('bairro');
            $table->string('codigo_municipio', 7)->nullable()->after('cidade');
        });
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn(['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'codigo_municipio']);
        });
    }
};
