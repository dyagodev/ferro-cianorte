<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Estoque do Link Pro pode ser fracionário (produto vendido por
        // peso/metro) — inteiro truncava esse valor. SQLite não suporta
        // MODIFY COLUMN (e não impõe tipo estrito de qualquer forma), então
        // isso só precisa rodar de verdade em bancos reais (MySQL/Postgres).
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE produto_estoques MODIFY quantidade DECIMAL(12,3) NOT NULL DEFAULT 0');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE produto_estoques MODIFY quantidade INTEGER NOT NULL DEFAULT 0');
        }
    }
};
