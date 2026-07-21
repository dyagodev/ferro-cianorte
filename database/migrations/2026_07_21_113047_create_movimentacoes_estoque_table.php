<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Log imutável de toda mudança em produto_estoques.quantidade — sem
     * isso não tem como montar um relatório de histórico (estilo Link Pro,
     * ver EstoqueService). Cada ponto do sistema que mexe em estoque
     * (venda, cancelamento, transferência, sync do Link Pro, ajuste manual)
     * passa a gravar uma linha aqui, sempre com o valor de antes/depois —
     * nunca só o delta, pra dar pra auditar/recalcular exato mesmo se duas
     * mudanças se sobrepuserem.
     */
    public function up(): void
    {
        Schema::create('movimentacoes_estoque', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('produto_id')->constrained('produtos');
            $table->foreignId('loja_id')->constrained('lojas');

            $table->decimal('quantidade_antes', 12, 3);
            $table->decimal('quantidade_depois', 12, 3);

            // venda | cancelamento_venda | transferencia_saida |
            // transferencia_entrada | transferencia_estorno |
            // sincronizacao_linkpro | reconciliacao_linkpro | ajuste_manual
            $table->string('tipo');

            // De onde veio, quando aplicável — não é FK de propósito (aponta
            // pra tabelas diferentes conforme o tipo: vendas, transferencias_
            // estoque, sync_conexoes), só pra navegação/contexto no relatório.
            $table->string('origem_tipo')->nullable();
            $table->unsignedBigInteger('origem_id')->nullable();

            // Nulo em mudança automática (venda sincronizada do Link Pro,
            // reconciliação agendada) — só preenchido quando teve humano
            // apertando o botão.
            $table->foreignId('user_id')->nullable()->constrained('users');
            $table->text('observacao')->nullable();

            $table->timestamp('created_at')->useCurrent();

            // Nome curto explícito — o nome automático (com os 4 nomes de
            // coluna concatenados) passa de 64 caracteres, limite do MySQL
            // pra identificador (SQLite não reclama, por isso passou liso
            // em dev).
            $table->index(['empresa_id', 'produto_id', 'loja_id', 'created_at'], 'mov_estoque_consulta_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('movimentacoes_estoque');
    }
};
