<?php

namespace Database\Seeders;

use App\Models\Loja;
use App\Models\Produto;
use App\Models\ProdutoEstoque;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $lojaCentro = Loja::create(['nome' => 'Loja Centro', 'ativo' => true]);
        $lojaFilial = Loja::create(['nome' => 'Loja Filial', 'ativo' => true]);

        User::factory()->create([
            'name' => 'Administrador',
            'email' => 'admin@carmempdv.test',
            'password' => 'password',
            'role' => 'admin',
            'loja_id' => null,
        ]);

        User::factory()->create([
            'name' => 'Vendedor Centro',
            'email' => 'vendedor@carmempdv.test',
            'password' => 'password',
            'role' => 'vendedor',
            'loja_id' => $lojaCentro->id,
        ]);

        $produto = Produto::create([
            'codigo_barras' => '7891234567890',
            'descricao' => 'Arruela Lisa 1/2" Ferro Zincado',
            'unidade' => 'UN',
            'preco_custo' => 0.25,
            'margem_percentual' => 140,
            'preco_venda' => 0.60,
            'estoque_minimo' => 50,
        ]);

        ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $lojaCentro->id, 'quantidade' => 200]);
        ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $lojaFilial->id, 'quantidade' => 80]);
    }
}
