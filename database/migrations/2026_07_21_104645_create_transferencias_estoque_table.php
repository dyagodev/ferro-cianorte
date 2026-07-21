<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Transferência de mercadoria entre lojas da mesma empresa — sai da
     * origem com NF-e (natOp "Transferência", CFOP 5152/6152, ver
     * TransferenciaEstoqueService) e, se aplicável, MDF-e referenciando
     * essa NF-e (ManifestoTransporte, ver add_transferencia_a_manifestos).
     */
    public function up(): void
    {
        Schema::create('transferencias_estoque', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('loja_origem_id')->constrained('lojas');
            $table->foreignId('loja_destino_id')->constrained('lojas');

            // rascunho (ainda editável, estoque intocado) -> em_transito
            // (NF-e autorizada, origem já baixou) -> recebida (destino
            // confirmou, incrementou lá) ; rascunho ou em_transito ->
            // cancelada (se em_transito, cancela a NF-e na SEFAZ e estorna
            // a origem).
            $table->string('status')->default('rascunho');

            $table->foreignId('user_id')->constrained('users');
            $table->text('observacao')->nullable();

            $table->foreignId('recebido_por')->nullable()->constrained('users');
            $table->timestamp('recebido_em')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transferencias_estoque');
    }
};
