<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            // Nota de transferência não tem Venda por trás (não é venda,
            // não deve contar em relatório de vendas) — venda_id passa a
            // ser opcional, e transferencia_estoque_id cobre esse caso.
            $table->foreignId('venda_id')->nullable()->change();
            $table->foreignId('transferencia_estoque_id')->nullable()->after('venda_id')->constrained('transferencias_estoque');
            $table->unique(['transferencia_estoque_id', 'tipo']);
        });

        Schema::table('transferencias_estoque', function (Blueprint $table) {
            $table->foreignId('nota_fiscal_id')->nullable()->after('status')->constrained('notas_fiscais');
            $table->foreignId('manifesto_transporte_id')->nullable()->after('nota_fiscal_id')->constrained('manifestos_transporte');
        });

        Schema::table('manifestos_transporte', function (Blueprint $table) {
            // Rastreabilidade: de qual transferência esse manifesto veio,
            // se veio de uma (manifesto continua podendo ser criado avulso,
            // sem transferência nenhuma, como já funciona hoje).
            $table->foreignId('transferencia_estoque_id')->nullable()->after('loja_id')->constrained('transferencias_estoque');
        });
    }

    public function down(): void
    {
        Schema::table('manifestos_transporte', function (Blueprint $table) {
            $table->dropConstrainedForeignId('transferencia_estoque_id');
        });

        Schema::table('transferencias_estoque', function (Blueprint $table) {
            $table->dropConstrainedForeignId('manifesto_transporte_id');
            $table->dropConstrainedForeignId('nota_fiscal_id');
        });

        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropUnique(['transferencia_estoque_id', 'tipo']);
            $table->dropConstrainedForeignId('transferencia_estoque_id');
            $table->foreignId('venda_id')->nullable(false)->change();
        });
    }
};
