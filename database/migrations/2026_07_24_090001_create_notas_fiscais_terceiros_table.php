<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * NF-e emitida por um FORNECEDOR contra o CNPJ da loja/empresa —
     * diferente de `notas_fiscais` (documentos que NÓS emitimos, ligados a
     * venda/transferência). Descoberta via consulta à SEFAZ (Distribuição
     * DFe, ver DistribuicaoDfeService), não por ação do usuário.
     */
    public function up(): void
    {
        Schema::create('notas_fiscais_terceiros', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('loja_id')->constrained('lojas');

            $table->string('chave_acesso');
            $table->string('nsu');

            $table->string('emitente_cnpj')->nullable();
            $table->string('emitente_nome')->nullable();
            $table->decimal('valor_total', 12, 2)->nullable();
            $table->timestamp('data_emissao')->nullable();

            // resumo: só metadados (resNFe) — completa: XML integral já
            // baixado (procNFe), com itens já parseados em
            // notas_fiscais_terceiros_itens.
            $table->string('situacao')->default('resumo');
            $table->boolean('manifestada')->default(false);
            $table->longText('xml')->nullable();

            $table->timestamp('entrada_estoque_em')->nullable();
            $table->foreignId('entrada_estoque_user_id')->nullable()->constrained('users');

            $table->timestamps();

            $table->unique(['empresa_id', 'chave_acesso']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notas_fiscais_terceiros');
    }
};
