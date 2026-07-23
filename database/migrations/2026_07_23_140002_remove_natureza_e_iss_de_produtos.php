<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Serviço virou entidade própria (tabela servicos, ver
     * 2026_07_23_140000_create_servicos_table.php) — natureza/
     * codigo_servico_municipal/aliquota_iss não fazem mais sentido em
     * Produto. Checado em produção antes de escrever essa migration: 0
     * produtos com natureza=servico existiam (nenhuma empresa cliente
     * tinha cadastrado serviço ainda), então não tem dado real pra migrar
     * — mesmo assim, trava com erro claro em vez de apagar silenciosamente
     * caso apareça algum registro novo entre o commit e o deploy.
     */
    public function up(): void
    {
        $comServico = DB::table('produtos')->where('natureza', 'servico')->count();

        if ($comServico > 0) {
            throw new RuntimeException(
                "Encontrado {$comServico} produto(s) com natureza=servico — essa migration apagaria os campos de ISS deles sem migrar pra tabela servicos. Pare e migre manualmente antes de rodar isso.",
            );
        }

        Schema::table('produtos', function (Blueprint $table) {
            $table->dropColumn(['natureza', 'codigo_servico_municipal', 'aliquota_iss']);
        });
    }

    public function down(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->string('natureza')->default('produto')->after('tipo');
            $table->string('codigo_servico_municipal')->nullable()->after('natureza');
            $table->decimal('aliquota_iss', 5, 2)->nullable()->after('codigo_servico_municipal');
        });
    }
};
