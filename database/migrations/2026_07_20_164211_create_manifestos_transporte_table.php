<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manifestos_transporte', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            // Loja é quem emite (CNPJ/UF do MDF-e vem dela — mesmo padrão
            // usado pra NF-e, ver Loja::possuiSpedyConfigurado).
            $table->foreignId('loja_id')->constrained('lojas');
            $table->foreignId('veiculo_tracao_id')->constrained('veiculos');

            // rascunho -> enviado -> autorizado|rejeitado ; autorizado -> encerrado|cancelado
            $table->string('status')->default('rascunho');

            // tpEmit: 1 prestador de serviço de transporte, 2 transportador
            // de carga própria, 3 contratante do serviço de transporte.
            $table->string('tp_emitente', 1)->default('1');

            $table->unsignedInteger('numero')->nullable();
            $table->string('serie', 3)->default('1');
            // cMDF: código numérico aleatório (semente da chave de acesso) — a
            // própria lib corrige se estiver errado (ver Make::checkMDFKey).
            $table->string('codigo_numerico', 8)->nullable();
            $table->string('chave_acesso', 44)->nullable();
            $table->string('protocolo')->nullable();

            $table->string('uf_ini', 2);
            $table->string('uf_fim', 2);
            $table->string('municipio_carregamento_codigo', 7);
            $table->string('municipio_carregamento_nome');
            $table->string('municipio_descarga_codigo', 7);
            $table->string('municipio_descarga_nome');

            // tpCarga (01 granel sólido...05 carga geral etc — ver Make::tagprodPred)
            $table->string('tipo_carga', 2)->default('05');
            $table->string('descricao_produto');
            $table->string('ncm', 8)->nullable();
            $table->decimal('valor_carga', 15, 2)->default(0);
            $table->decimal('peso_carga_kg', 12, 3)->default(0);

            // Snapshot do RNTRC no momento da emissão (pode mudar na loja depois).
            $table->string('rntrc', 20)->nullable();

            $table->timestamp('dh_emissao')->nullable();
            $table->timestamp('dh_inicio_viagem')->nullable();

            // XML assinado que foi (ou seria) enviado — guardamos pra
            // auditoria/reenvio, mesmo quando a emissão falha.
            $table->longText('xml_gerado')->nullable();
            $table->string('codigo_retorno')->nullable();
            $table->text('mensagem_retorno')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manifestos_transporte');
    }
};
