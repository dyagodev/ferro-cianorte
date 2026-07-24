<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bookkeeping da reconciliação com o Link Pro (ver
     * LinkProSyncService::aplicarReconciliacaoEstoque) — guarda o último
     * produto.qtd_estoque (valor absoluto) já lido de lá pra esse
     * produto/loja, pra cada ciclo aplicar só a DIFERENÇA desde a última
     * vez, em vez de sobrescrever o estoque local (que apagava ajuste
     * manual feito só no DM Nexus). Nullable de propósito: null significa
     * "nunca vimos esse produto por esse mecanismo ainda" — nesse caso o
     * primeiro ciclo só grava o baseline, sem aplicar delta nenhum (evita
     * somar o valor cheio do Link Pro em cima do que já existe local logo
     * após este deploy).
     */
    public function up(): void
    {
        Schema::table('produto_estoques', function (Blueprint $table) {
            $table->decimal('ultima_qtd_estoque_linkpro', 12, 3)->nullable()->after('quantidade');
        });
    }

    public function down(): void
    {
        Schema::table('produto_estoques', function (Blueprint $table) {
            $table->dropColumn('ultima_qtd_estoque_linkpro');
        });
    }
};
