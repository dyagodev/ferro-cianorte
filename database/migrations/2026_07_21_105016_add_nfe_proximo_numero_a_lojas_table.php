<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * NF-e sempre usou o id da Venda como número (nNF) — funcionava porque
     * só existia um tipo de "documento com id" gerando NF-e. Transferência
     * de estoque não tem Venda por trás; reaproveitar o id dela como nNF
     * colidiria com o id de uma Venda na mesma série/loja (dois documentos
     * diferentes, mesmo número). Contador próprio por loja resolve —
     * mesmo padrão já usado em nfce_proximo_numero/mdfe_proximo_numero.
     */
    public function up(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->unsignedInteger('nfe_proximo_numero')->default(1)->after('nfe_serie');
        });

        // Lojas que já emitiram NF-e de venda-atacado usaram id de Venda
        // como número — começar o contador do maior id de Venda já visto
        // (com folga) evita colidir com número já usado por uma dessas.
        DB::table('lojas')->update([
            'nfe_proximo_numero' => DB::raw('(select coalesce(max(id), 0) + 1 from vendas)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn('nfe_proximo_numero');
        });
    }
};
