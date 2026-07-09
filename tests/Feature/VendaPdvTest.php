<?php

use App\Models\Loja;
use App\Models\Produto;
use App\Models\ProdutoEstoque;
use App\Models\User;
use Illuminate\Support\Str;

function criarUsuario(string $role, ?Loja $loja = null): User
{
    return User::factory()->create([
        'role' => $role,
        'loja_id' => $loja?->id,
    ]);
}

test('venda decrementa o estoque apenas da loja onde foi feita', function () {
    $lojaCentro = Loja::create(['nome' => 'Centro']);
    $lojaFilial = Loja::create(['nome' => 'Filial']);

    $produto = Produto::create(['descricao' => 'Parafuso', 'preco_venda' => 1]);
    ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $lojaCentro->id, 'quantidade' => 100]);
    ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $lojaFilial->id, 'quantidade' => 50]);

    $vendedor = criarUsuario('vendedor', $lojaCentro);

    $this->actingAs($vendedor, 'sanctum')->postJson('/api/vendas', [
        'itens' => [
            ['produto_id' => $produto->id, 'quantidade' => 10, 'preco_unitario' => 1],
        ],
        'pagamentos' => [
            ['forma_pagamento' => 'dinheiro', 'valor' => 10],
        ],
    ])->assertCreated();

    expect($produto->estoqueNaLoja($lojaCentro->id))->toBe(90);
    expect($produto->estoqueNaLoja($lojaFilial->id))->toBe(50);
});

test('venda grava o preco original do produto mesmo quando o preco cobrado eh alterado no caixa', function () {
    $loja = Loja::create(['nome' => 'Centro']);
    $produto = Produto::create(['descricao' => 'Parafuso', 'preco_venda' => 10]);
    ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $loja->id, 'quantidade' => 100]);

    $vendedor = criarUsuario('vendedor', $loja);

    $resposta = $this->actingAs($vendedor, 'sanctum')->postJson('/api/vendas', [
        'itens' => [
            ['produto_id' => $produto->id, 'quantidade' => 2, 'preco_unitario' => 7.5],
        ],
        'pagamentos' => [
            ['forma_pagamento' => 'dinheiro', 'valor' => 15],
        ],
    ])->assertCreated();

    $item = $resposta->json('itens.0');

    expect((float) $item['preco_original'])->toEqual(10.0);
    expect((float) $item['preco_unitario'])->toEqual(7.5);

    // Alterar o preço de tabela do produto depois não deve reescrever o histórico da venda.
    $produto->update(['preco_venda' => 99]);
    expect((float) \App\Models\VendaItem::find($item['id'])->preco_original)->toEqual(10.0);
});

test('venda com uuid repetido nao duplica nem decrementa o estoque duas vezes', function () {
    $loja = Loja::create(['nome' => 'Centro']);
    $produto = Produto::create(['descricao' => 'Parafuso', 'preco_venda' => 1]);
    ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $loja->id, 'quantidade' => 100]);

    $vendedor = criarUsuario('vendedor', $loja);
    $uuid = (string) Str::uuid();

    $payload = [
        'uuid' => $uuid,
        'itens' => [['produto_id' => $produto->id, 'quantidade' => 5, 'preco_unitario' => 1]],
        'pagamentos' => [['forma_pagamento' => 'dinheiro', 'valor' => 5]],
    ];

    $this->actingAs($vendedor, 'sanctum')->postJson('/api/vendas', $payload)->assertCreated();
    $this->actingAs($vendedor, 'sanctum')->postJson('/api/vendas', $payload)->assertCreated();

    expect(\App\Models\Venda::where('uuid', $uuid)->count())->toBe(1);
    expect($produto->estoqueNaLoja($loja->id))->toBe(95);
});

test('vendedor nao acessa rotas administrativas', function () {
    $loja = Loja::create(['nome' => 'Centro']);
    $vendedor = criarUsuario('vendedor', $loja);

    $this->actingAs($vendedor, 'sanctum')
        ->postJson('/api/lojas', ['nome' => 'Nova Loja'])
        ->assertForbidden();
});

test('admin acessa rotas administrativas', function () {
    $admin = criarUsuario('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/lojas', ['nome' => 'Nova Loja'])
        ->assertCreated();
});

test('vendedor so ve vendas da propria loja', function () {
    $lojaCentro = Loja::create(['nome' => 'Centro']);
    $lojaFilial = Loja::create(['nome' => 'Filial']);
    $produto = Produto::create(['descricao' => 'Parafuso', 'preco_venda' => 1]);
    ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $lojaCentro->id, 'quantidade' => 10]);
    ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $lojaFilial->id, 'quantidade' => 10]);

    $vendedorCentro = criarUsuario('vendedor', $lojaCentro);
    $vendedorFilial = criarUsuario('vendedor', $lojaFilial);

    $venda = fn () => [
        'itens' => [['produto_id' => $produto->id, 'quantidade' => 1, 'preco_unitario' => 1]],
        'pagamentos' => [['forma_pagamento' => 'dinheiro', 'valor' => 1]],
    ];

    $this->actingAs($vendedorCentro, 'sanctum')->postJson('/api/vendas', $venda())->assertCreated();
    $this->actingAs($vendedorFilial, 'sanctum')->postJson('/api/vendas', $venda())->assertCreated();

    $resposta = $this->actingAs($vendedorCentro, 'sanctum')->getJson('/api/vendas')->json('data');

    expect($resposta)->toHaveCount(1);
    expect($resposta[0]['loja_id'])->toBe($lojaCentro->id);
});

test('sync aceita lote de vendas feitas offline e marca feita_offline', function () {
    $loja = Loja::create(['nome' => 'Centro']);
    $produto = Produto::create(['descricao' => 'Parafuso', 'preco_venda' => 1]);
    ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $loja->id, 'quantidade' => 20]);

    $vendedor = criarUsuario('vendedor', $loja);
    $uuid = (string) Str::uuid();

    $this->actingAs($vendedor, 'sanctum')->postJson('/api/vendas/sync', [
        'vendas' => [[
            'uuid' => $uuid,
            'itens' => [['produto_id' => $produto->id, 'quantidade' => 3, 'preco_unitario' => 1]],
            'pagamentos' => [['forma_pagamento' => 'dinheiro', 'valor' => 3]],
        ]],
    ])->assertOk()->assertJsonPath('resultados.0.status', 'sincronizada');

    expect(\App\Models\Venda::where('uuid', $uuid)->first()->feita_offline)->toBeTrue();
    expect($produto->estoqueNaLoja($loja->id))->toBe(17);
});
