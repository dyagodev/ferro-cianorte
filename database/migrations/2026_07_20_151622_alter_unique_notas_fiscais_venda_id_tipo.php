<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // venda_id é FK — o MySQL exige que sempre exista algum índice
        // cobrindo a coluna da FK, então precisa criar o índice novo
        // (venda_id, tipo) ANTES de derrubar o antigo (notas_fiscais_
        // venda_id_unique), senão a FK fica sem índice de apoio no meio do
        // caminho e o MySQL rejeita o dropUnique com erro 1553. SQLite não
        // tem essa exigência (por isso rodou liso em dev antes), só MySQL
        // em produção acusa.
        Schema::table('notas_fiscais', function (Blueprint $table) {
            // Antes era 1 nota por venda. Agora uma venda pode gerar mais de
            // uma nota (ex.: carrinho com produto + serviço = NFC-e/NF-e +
            // NFS-e) — o que precisa ser único é (venda, tipo), não a venda sozinha.
            $table->unique(['venda_id', 'tipo']);
        });

        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropUnique('notas_fiscais_venda_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->unique('venda_id');
        });

        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropUnique(['venda_id', 'tipo']);
        });
    }
};
