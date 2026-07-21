<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            // Config padrão pra todas as lojas — usada quando a loja não
            // tem CNPJ próprio (ou tem o mesmo CNPJ da empresa) e não subiu
            // certificado dela mesma. Ver Loja::possuiMdfeConfigurado /
            // possuiNfceConfigurado, que decidem se cai aqui ou não.
            $table->string('mdfe_ambiente')->nullable()->after('spedy_serie_nfce');
            $table->text('mdfe_certificado')->nullable()->after('mdfe_ambiente');
            $table->string('mdfe_certificado_senha')->nullable()->after('mdfe_certificado');
            $table->string('mdfe_rntrc', 20)->nullable()->after('mdfe_certificado_senha');

            $table->string('nfce_ambiente')->nullable()->after('mdfe_rntrc');
            $table->text('nfce_certificado')->nullable()->after('nfce_ambiente');
            $table->string('nfce_certificado_senha')->nullable()->after('nfce_certificado');
            $table->string('nfce_csc')->nullable()->after('nfce_certificado_senha');
            $table->string('nfce_csc_id')->nullable()->after('nfce_csc');
            $table->string('nfce_serie')->nullable()->after('nfce_csc_id');
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn([
                'mdfe_ambiente', 'mdfe_certificado', 'mdfe_certificado_senha', 'mdfe_rntrc',
                'nfce_ambiente', 'nfce_certificado', 'nfce_certificado_senha',
                'nfce_csc', 'nfce_csc_id', 'nfce_serie',
            ]);
        });
    }
};
