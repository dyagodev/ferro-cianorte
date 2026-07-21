<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manifesto_documentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('manifesto_transporte_id')->constrained('manifestos_transporte')->cascadeOnDelete();
            // nfe ou cte — cada um vira Make::taginfNFe()/taginfCTe() na hora de montar.
            $table->string('tipo', 3);
            $table->string('chave', 44);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manifesto_documentos');
    }
};
