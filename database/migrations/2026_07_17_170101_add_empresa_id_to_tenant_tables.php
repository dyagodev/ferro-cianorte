<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Só essas 5 tabelas precisam de empresa_id direto: lojas e users são o
    // ponto de entrada (todo Global Scope resolve a partir do usuário
    // autenticado), e produtos/clientes/fornecedores eram tabelas GLOBAIS
    // até agora (sem loja_id nenhum) — sem empresa_id nelas, catálogo/
    // cliente de uma empresa vazaria pra outra. O resto (vendas,
    // produto_estoques, sync_conexoes, movimentacoes_caixa) já é
    // alcançável via loja_id -> empresa_id, não precisa de coluna própria
    // (evita redundância que pode dessincronizar).
    private const TABELAS_COM_EMPRESA = ['lojas', 'users', 'produtos', 'clientes', 'fornecedores'];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach (self::TABELAS_COM_EMPRESA as $tabela) {
            Schema::table($tabela, function (Blueprint $table) {
                $table->foreignId('empresa_id')->nullable()->after('id')->constrained('empresas');
            });
        }

        // Backfill: única empresa existente até agora, criada na migration
        // anterior — todo dado que já existe pertence a ela.
        $empresaId = DB::table('empresas')->value('id');
        foreach (self::TABELAS_COM_EMPRESA as $tabela) {
            DB::table($tabela)->update(['empresa_id' => $empresaId]);
        }

        foreach (self::TABELAS_COM_EMPRESA as $tabela) {
            Schema::table($tabela, function (Blueprint $table) {
                $table->foreignId('empresa_id')->nullable(false)->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach (self::TABELAS_COM_EMPRESA as $tabela) {
            Schema::table($tabela, function (Blueprint $table) {
                $table->dropConstrainedForeignId('empresa_id');
            });
        }
    }
};
