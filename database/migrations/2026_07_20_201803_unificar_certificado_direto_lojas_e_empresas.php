<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * MDF-e/NFC-e/NF-e diretos usam sempre o MESMO certificado A1 (é o
     * mesmo CNPJ assinando os três tipos de documento) — ter um campo
     * separado por tipo só fazia o operador subir o mesmo arquivo três
     * vezes. Unifica num certificado só por loja/empresa; ambiente, série,
     * RNTRC e CSC continuam por tipo porque isso sim pode variar
     * (ex.: ambiente de homologação só pra NFC-e enquanto NF-e já é
     * produção).
     */
    public function up(): void
    {
        foreach (['lojas', 'empresas'] as $tabela) {
            Schema::table($tabela, function (Blueprint $table) {
                $table->text('certificado')->nullable()->after('cnpj');
                $table->string('certificado_senha')->nullable()->after('certificado');
            });

            DB::statement("
                UPDATE {$tabela}
                SET certificado = COALESCE(mdfe_certificado, nfce_certificado, nfe_certificado),
                    certificado_senha = COALESCE(mdfe_certificado_senha, nfce_certificado_senha, nfe_certificado_senha)
            ");

            Schema::table($tabela, function (Blueprint $table) {
                $table->dropColumn([
                    'mdfe_certificado', 'mdfe_certificado_senha',
                    'nfce_certificado', 'nfce_certificado_senha',
                    'nfe_certificado', 'nfe_certificado_senha',
                ]);
            });
        }
    }

    public function down(): void
    {
        foreach (['lojas', 'empresas'] as $tabela) {
            Schema::table($tabela, function (Blueprint $table) {
                $table->text('mdfe_certificado')->nullable();
                $table->string('mdfe_certificado_senha')->nullable();
                $table->text('nfce_certificado')->nullable();
                $table->string('nfce_certificado_senha')->nullable();
                $table->text('nfe_certificado')->nullable();
                $table->string('nfe_certificado_senha')->nullable();
            });

            DB::statement("
                UPDATE {$tabela}
                SET mdfe_certificado = certificado, mdfe_certificado_senha = certificado_senha,
                    nfce_certificado = certificado, nfce_certificado_senha = certificado_senha,
                    nfe_certificado = certificado, nfe_certificado_senha = certificado_senha
            ");

            Schema::table($tabela, function (Blueprint $table) {
                $table->dropColumn(['certificado', 'certificado_senha']);
            });
        }
    }
};
