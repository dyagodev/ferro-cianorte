<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            // "endereco" (texto livre) continua existindo pro cadastro simples do
            // PDV — esses campos estruturados só são obrigatórios pra emitir NF-e
            // (destinatário precisa de endereço completo + código IBGE do
            // município, não dá pra usar texto livre na Spedy).
            $table->string('inscricao_estadual')->nullable()->after('cpf_cnpj');
            $table->string('cep', 9)->nullable()->after('endereco');
            $table->string('logradouro')->nullable()->after('cep');
            $table->string('numero', 20)->nullable()->after('logradouro');
            $table->string('complemento')->nullable()->after('numero');
            $table->string('bairro')->nullable()->after('complemento');
            $table->string('cidade')->nullable()->after('bairro');
            $table->string('uf', 2)->nullable()->after('cidade');
            $table->string('codigo_municipio', 7)->nullable()->after('uf');
        });
    }

    public function down(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            $table->dropColumn([
                'inscricao_estadual', 'cep', 'logradouro', 'numero',
                'complemento', 'bairro', 'cidade', 'uf', 'codigo_municipio',
            ]);
        });
    }
};
