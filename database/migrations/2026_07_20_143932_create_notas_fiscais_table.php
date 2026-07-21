<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('notas_fiscais', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            // Uma nota por venda — se a emissão falhar e for reenviada, é
            // update nessa mesma linha (idempotência via integrationId da
            // Spedy = uuid da venda), não uma linha nova.
            $table->foreignId('venda_id')->unique()->constrained('vendas');

            $table->string('tipo')->default('nfce');
            $table->string('spedy_invoice_id')->nullable();

            // created -> enqueued -> authorized|rejected|canceled (ver
            // SpedyService/webhook) — nunca apagamos linha, só atualizamos
            // o status conforme os eventos chegam.
            $table->string('status')->default('created');

            $table->string('chave_acesso')->nullable();
            $table->string('numero')->nullable();
            $table->string('serie')->nullable();
            $table->text('url_danfe')->nullable();
            $table->text('url_xml')->nullable();

            // codigo_retorno é o código SEFAZ ou "SPD-..." (validação da
            // própria Spedy antes de mandar pra SEFAZ) — mensagem_retorno é
            // o texto legível pra mostrar pro operador do caixa quando
            // rejeitada.
            $table->string('codigo_retorno')->nullable();
            $table->text('mensagem_retorno')->nullable();

            $table->json('payload_enviado')->nullable();
            $table->json('resposta_bruta')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notas_fiscais');
    }
};
