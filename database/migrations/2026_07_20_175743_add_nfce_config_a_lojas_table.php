<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            // 'spedy' (gateway, como já funciona) ou 'direta' (nfephp-org/sped-nfe,
            // sem taxa por documento — ver NfceService). Default 'spedy' pra não
            // quebrar quem já está configurado.
            $table->string('emissao_fiscal_modo')->default('spedy')->after('spedy_serie_nfce');

            // Emissão direta na SEFAZ precisa do próprio certificado (igual ao
            // MDF-e) — não tem gateway guardando isso por nós.
            $table->string('nfce_ambiente')->nullable()->after('emissao_fiscal_modo');
            $table->text('nfce_certificado')->nullable()->after('nfce_ambiente');
            $table->string('nfce_certificado_senha')->nullable()->after('nfce_certificado');

            // CSC/CSCid são exigidos pra NFC-e mesmo emitindo direto (o QR
            // Code do cupom depende disso) — vêm do credenciamento na SEFAZ,
            // não são gerados por nós nem pela biblioteca.
            $table->string('nfce_csc')->nullable()->after('nfce_certificado_senha');
            $table->string('nfce_csc_id')->nullable()->after('nfce_csc');

            $table->string('nfce_serie')->nullable()->after('nfce_csc_id');
            // Numeração sequencial é nossa responsabilidade na emissão direta
            // (sem gateway assumindo isso) — mesmo padrão do mdfe_proximo_numero.
            $table->unsignedInteger('nfce_proximo_numero')->default(1)->after('nfce_serie');
        });
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn([
                'emissao_fiscal_modo', 'nfce_ambiente', 'nfce_certificado',
                'nfce_certificado_senha', 'nfce_csc', 'nfce_csc_id',
                'nfce_serie', 'nfce_proximo_numero',
            ]);
        });
    }
};
