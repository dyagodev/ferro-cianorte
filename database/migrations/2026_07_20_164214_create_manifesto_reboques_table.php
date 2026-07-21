<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manifesto_reboques', function (Blueprint $table) {
            $table->id();
            $table->foreignId('manifesto_transporte_id')->constrained('manifestos_transporte')->cascadeOnDelete();
            $table->foreignId('veiculo_id')->constrained('veiculos');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manifesto_reboques');
    }
};
