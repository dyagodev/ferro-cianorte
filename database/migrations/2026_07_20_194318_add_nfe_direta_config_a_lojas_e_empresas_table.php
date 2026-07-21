<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Emissão direta de NF-e (venda de atacado/revenda, mod 55) segue o
        // mesmo emissao_fiscal_modo ('spedy'|'direta') já usado pra NFC-e —
        // é uma decisão por loja, não por tipo de documento. Certificado e
        // série são campos próprios porque, na prática, cada tipo de nota
        // pode ter numeração/ambiente configurados separadamente (mesmo
        // padrão do mdfe_* e nfce_*), mas NF-e não precisa de CSC/CSCid
        // (isso é exclusivo do QR Code da NFC-e).
        Schema::table('lojas', function (Blueprint $table) {
            $table->string('nfe_ambiente')->nullable()->after('nfce_proximo_numero');
            $table->text('nfe_certificado')->nullable()->after('nfe_ambiente');
            $table->string('nfe_certificado_senha')->nullable()->after('nfe_certificado');
            $table->string('nfe_serie')->nullable()->after('nfe_certificado_senha');
        });

        Schema::table('empresas', function (Blueprint $table) {
            $table->string('nfe_ambiente')->nullable()->after('nfce_serie');
            $table->text('nfe_certificado')->nullable()->after('nfe_ambiente');
            $table->string('nfe_certificado_senha')->nullable()->after('nfe_certificado');
            $table->string('nfe_serie')->nullable()->after('nfe_certificado_senha');
        });
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn(['nfe_ambiente', 'nfe_certificado', 'nfe_certificado_senha', 'nfe_serie']);
        });

        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn(['nfe_ambiente', 'nfe_certificado', 'nfe_certificado_senha', 'nfe_serie']);
        });
    }
};
