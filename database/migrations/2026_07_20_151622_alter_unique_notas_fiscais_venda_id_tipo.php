<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            // Antes era 1 nota por venda. Agora uma venda pode gerar mais de
            // uma nota (ex.: carrinho com produto + serviço = NFC-e/NF-e +
            // NFS-e) — o que precisa ser único é (venda, tipo), não a venda sozinha.
            $table->dropUnique('notas_fiscais_venda_id_unique');
            $table->unique(['venda_id', 'tipo']);
        });
    }

    public function down(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropUnique(['venda_id', 'tipo']);
            $table->unique('venda_id');
        });
    }
};
