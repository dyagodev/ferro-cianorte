<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            // Diferente da Spedy (onde o certificado fica guardado lá), o
            // MDF-e é emitido direto na SEFAZ (nfephp-org/sped-mdfe) — o
            // certificado A1 precisa estar aqui, em repouso criptografado
            // (ver MdfeService), pra poder assinar o XML a cada emissão.
            $table->string('mdfe_ambiente')->nullable()->after('spedy_serie_nfce');
            $table->text('mdfe_certificado')->nullable()->after('mdfe_ambiente');
            $table->string('mdfe_certificado_senha')->nullable()->after('mdfe_certificado');
            $table->string('mdfe_rntrc', 20)->nullable()->after('mdfe_certificado_senha');
            // Numeração sequencial do MDF-e é responsabilidade nossa (não
            // tem gateway assumindo isso) — incrementado atomicamente a
            // cada emissão (ver MdfeService::proximoNumero).
            $table->unsignedInteger('mdfe_proximo_numero')->default(1)->after('mdfe_rntrc');
        });
    }

    public function down(): void
    {
        Schema::table('lojas', function (Blueprint $table) {
            $table->dropColumn([
                'mdfe_ambiente', 'mdfe_certificado', 'mdfe_certificado_senha',
                'mdfe_rntrc', 'mdfe_proximo_numero',
            ]);
        });
    }
};
