<?php

use App\Models\Produto;
use App\Support\Texto;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Busca de produto (PDV/F3, tela de emissão de NF-e) usava LIKE direto
     * em cima de "descricao" — sensível a acento no SQLite, então "agua"
     * não achava "Água Mineral" (só achava digitando o acento certo). Mesmo
     * problema que já corrigimos pra município, mesma solução: coluna
     * normalizada (sem acento, minúscula) sincronizada no save do Produto
     * (ver Produto::booted), buscada em vez da coluna crua.
     */
    public function up(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->string('descricao_normalizada')->nullable()->after('descricao');
            $table->index(['empresa_id', 'descricao_normalizada']);
        });

        Produto::withoutGlobalScopes()->select('id', 'descricao')->chunkById(200, function ($produtos) {
            foreach ($produtos as $produto) {
                Produto::withoutGlobalScopes()->whereKey($produto->id)->update([
                    'descricao_normalizada' => Texto::normalizar($produto->descricao),
                ]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->dropIndex(['empresa_id', 'descricao_normalizada']);
            $table->dropColumn('descricao_normalizada');
        });
    }
};
