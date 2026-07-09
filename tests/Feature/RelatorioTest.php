<?php

use App\Models\Loja;
use App\Models\Produto;
use App\Models\ProdutoEstoque;
use App\Models\User;
use App\Models\Venda;
use App\Models\VendaItem;
use App\Models\VendaPagamento;
use Illuminate\Support\Str;

function criarVendaCompleta(Loja $loja, User $vendedor, Produto $produto, float $quantidade, float $precoUnitario, string $formaPagamento): Venda
{
    $total = $quantidade * $precoUnitario;

    $venda = Venda::create([
        'uuid' => (string) Str::uuid(),
        'loja_id' => $loja->id,
        'user_id' => $vendedor->id,
        'subtotal' => $total,
        'desconto' => 0,
        'total' => $total,
        'status' => 'concluida',
    ]);

    VendaItem::create([
        'venda_id' => $venda->id,
        'produto_id' => $produto->id,
        'quantidade' => $quantidade,
        'preco_unitario' => $precoUnitario,
        'total' => $total,
    ]);

    VendaPagamento::create([
        'venda_id' => $venda->id,
        'forma_pagamento' => $formaPagamento,
        'valor' => $total,
    ]);

    return $venda;
}

test('relatorio de vendas soma totais e filtra por loja', function () {
    $lojaCentro = Loja::create(['nome' => 'Centro']);
    $lojaFilial = Loja::create(['nome' => 'Filial']);
    $admin = User::factory()->create(['role' => 'admin']);
    $vendedor = User::factory()->create(['role' => 'vendedor', 'loja_id' => $lojaCentro->id]);
    $produto = Produto::create(['descricao' => 'Parafuso', 'preco_venda' => 10]);

    criarVendaCompleta($lojaCentro, $vendedor, $produto, 2, 10, 'dinheiro');
    criarVendaCompleta($lojaFilial, $vendedor, $produto, 1, 10, 'pix');

    $resposta = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/relatorios/vendas?loja_id='.$lojaCentro->id)
        ->assertOk()
        ->json();

    expect($resposta['totais']['quantidade_vendas'])->toBe(1);
    expect((float) $resposta['totais']['total'])->toEqual(20.0);
});

test('fechamento de caixa agrupa por forma de pagamento', function () {
    $loja = Loja::create(['nome' => 'Centro']);
    $admin = User::factory()->create(['role' => 'admin']);
    $vendedor = User::factory()->create(['role' => 'vendedor', 'loja_id' => $loja->id]);
    $produto = Produto::create(['descricao' => 'Parafuso', 'preco_venda' => 10]);

    criarVendaCompleta($loja, $vendedor, $produto, 1, 10, 'dinheiro');
    criarVendaCompleta($loja, $vendedor, $produto, 1, 20, 'dinheiro');
    criarVendaCompleta($loja, $vendedor, $produto, 1, 5, 'pix');

    $resposta = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/relatorios/fechamento-caixa')
        ->assertOk()
        ->json();

    $dinheiro = collect($resposta['por_forma_pagamento'])->firstWhere('forma_pagamento', 'dinheiro');
    expect((float) $dinheiro['total'])->toEqual(30.0);
    expect((float) $resposta['total_geral'])->toEqual(35.0);
});

test('produtos mais vendidos ranqueia por valor total', function () {
    $loja = Loja::create(['nome' => 'Centro']);
    $admin = User::factory()->create(['role' => 'admin']);
    $vendedor = User::factory()->create(['role' => 'vendedor', 'loja_id' => $loja->id]);
    $produtoA = Produto::create(['descricao' => 'Produto A', 'preco_venda' => 10]);
    $produtoB = Produto::create(['descricao' => 'Produto B', 'preco_venda' => 100]);

    criarVendaCompleta($loja, $vendedor, $produtoA, 5, 10, 'dinheiro');
    criarVendaCompleta($loja, $vendedor, $produtoB, 1, 100, 'dinheiro');

    $resposta = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/relatorios/produtos-mais-vendidos')
        ->assertOk()
        ->json('produtos');

    expect($resposta[0]['produto_id'])->toBe($produtoB->id);
});

test('estoque baixo lista produtos abaixo do minimo', function () {
    $loja = Loja::create(['nome' => 'Centro']);
    $admin = User::factory()->create(['role' => 'admin']);
    $produtoBaixo = Produto::create(['descricao' => 'Baixo', 'preco_venda' => 10, 'estoque_minimo' => 50]);
    $produtoOk = Produto::create(['descricao' => 'Ok', 'preco_venda' => 10, 'estoque_minimo' => 10]);

    ProdutoEstoque::create(['produto_id' => $produtoBaixo->id, 'loja_id' => $loja->id, 'quantidade' => 5]);
    ProdutoEstoque::create(['produto_id' => $produtoOk->id, 'loja_id' => $loja->id, 'quantidade' => 20]);

    $resposta = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/relatorios/estoque-baixo')
        ->assertOk()
        ->json('itens');

    expect($resposta)->toHaveCount(1);
    expect($resposta[0]['produto_id'])->toBe($produtoBaixo->id);
});

test('vendedor nao acessa relatorios', function () {
    $vendedor = User::factory()->create(['role' => 'vendedor']);

    $this->actingAs($vendedor, 'sanctum')
        ->getJson('/api/relatorios/vendas')
        ->assertForbidden();
});
