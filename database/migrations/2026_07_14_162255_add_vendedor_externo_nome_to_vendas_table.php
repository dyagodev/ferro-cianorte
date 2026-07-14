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
        Schema::table('vendas', function (Blueprint $table) {
            // Nome do vendedor real no Link Pro (usuario.nome, via
            // negociacao.id_usuario) — venda sincronizada usa um admin
            // "de sistema" em user_id (a coluna é obrigatória e aponta pra
            // um User nosso), então guardamos o nome de origem à parte pra
            // exibir o vendedor certo em vez do usuário de integração.
            $table->string('vendedor_externo_nome')->nullable()->after('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vendas', function (Blueprint $table) {
            $table->dropColumn('vendedor_externo_nome');
        });
    }
};
