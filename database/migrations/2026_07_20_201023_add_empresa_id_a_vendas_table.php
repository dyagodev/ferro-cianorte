<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Venda nunca teve empresa_id/BelongsToEmpresa — nada isolava as
     * queries por tenant além de cada controller lembrar de filtrar por
     * loja_id manualmente (e nem todos lembravam, ver RelatorioController e
     * VendaController::index antes desse fix). Isso também deixava as rotas
     * com {venda} no path (cancelar, emitir-nota) vulneráveis a um admin de
     * uma empresa acessar venda de outra só adivinhando o ID. Adicionar
     * empresa_id com BelongsToEmpresa fecha isso na raiz, do jeito que
     * Loja/Produto/NotaFiscal já funcionam.
     */
    public function up(): void
    {
        Schema::table('vendas', function (Blueprint $table) {
            $table->foreignId('empresa_id')->nullable()->after('id')->constrained('empresas')->nullOnDelete();
        });

        DB::statement('
            UPDATE vendas
            SET empresa_id = (SELECT lojas.empresa_id FROM lojas WHERE lojas.id = vendas.loja_id)
        ');
    }

    public function down(): void
    {
        Schema::table('vendas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('empresa_id');
        });
    }
};
