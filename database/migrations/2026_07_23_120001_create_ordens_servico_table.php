<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Camada de acompanhamento (diagnóstico, itens usados, execução) ANTES
     * da venda acontecer — ao faturar, vira uma Venda de verdade via
     * VendaService::registrar() (ver OrdemServicoService::faturar()),
     * herdando de graça baixa de estoque, emissão fiscal e relatórios já
     * existentes. Não duplica nada disso aqui.
     */
    public function up(): void
    {
        Schema::create('ordens_servico', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('loja_id')->constrained('lojas');
            $table->foreignId('cliente_id')->constrained('clientes');
            // Nem toda OS tem um ativo (ex.: consultoria, serviço avulso).
            $table->foreignId('ativo_id')->nullable()->constrained('ativos');
            $table->foreignId('user_id')->constrained('users');
            // Quem executa — pode ser diferente de quem abriu.
            $table->foreignId('profissional_id')->nullable()->constrained('users');

            // aberta -> em_execucao -> concluida -> faturada (terminal);
            // aberta/em_execucao -> cancelada.
            $table->string('status')->default('aberta');

            $table->text('descricao_problema')->nullable();
            $table->text('observacoes')->nullable();

            $table->timestamp('data_abertura')->useCurrent();
            $table->timestamp('data_previsao')->nullable();
            $table->timestamp('data_conclusao')->nullable();

            // Preenchido só ao faturar (ver OrdemServicoService::faturar()).
            $table->foreignId('venda_id')->nullable()->constrained('vendas');

            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('desconto', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ordens_servico');
    }
};
