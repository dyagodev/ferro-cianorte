<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Produto;
use App\Models\ProdutoEstoque;
use Illuminate\Http\Request;

class ProdutoController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $lojaId = $user->isAdmin()
            ? $request->integer('loja_id') ?: null
            : $user->loja_id;

        $query = Produto::query()->where('ativo', true);

        if ($busca = $request->string('q')->toString()) {
            // Código interno é o que o leitor de código de barras lê — bate
            // exato. Não filtra mais por quantidade em estoque: esse dado
            // vem sujo/desatualizado do Link Pro (muito produto com estoque
            // zerado ou negativo mesmo sendo vendível de verdade), e
            // escondia venda legítima — quem controla o que aparece agora é
            // só o desligamento por loja logo abaixo.
            $query->where(function ($q) use ($busca) {
                $q->where('codigo_interno', $busca)
                    ->orWhere('descricao', 'like', "%{$busca}%");
            });
        }

        // A busca ao vivo do PDV/F3 nunca pagina (ver comentário abaixo) — é
        // o sinal que usamos pra saber que é o PDV chamando, não a tela de
        // gestão de produtos do admin (que precisa ver todo produto, mesmo
        // desligado de uma loja, pra poder religar/gerenciar). No PDV,
        // produto que essa loja não tem mais no Link Pro dela não é uma
        // opção de venda (ver LinkProSyncService::sincronizarCatalogoLoja).
        if ($lojaId && !$request->has('page')) {
            $query->whereDoesntHave('estoques', fn ($q) => $q->where('loja_id', $lojaId)->where('ativo', false));
        }

        $query->orderBy('descricao');

        // Paginação é opt-in (só quando ?page= é enviado): a busca ao vivo do
        // PDV (com "q") e o modal F3 sempre esperam o array completo, só a
        // tela de gestão de produtos do admin passa a pedir por página.
        if ($request->has('page')) {
            $paginado = $query->paginate($request->integer('per_page') ?: 30);
            $colecao = $paginado->getCollection();
        } else {
            $colecao = $query->get();
        }

        if ($lojaId) {
            $colecao->loadMissing(['estoques' => fn ($q) => $q->where('loja_id', $lojaId)]);
            $colecao->each(function (Produto $produto) use ($lojaId) {
                $produto->setAttribute('quantidade_estoque', $produto->estoqueNaLoja($lojaId));
            });
        } elseif ($user->isAdmin()) {
            // Admin olhando todas as lojas: traz o estoque de cada loja pra tela
            // de gestão de produtos conseguir mostrar a quantidade real por loja.
            $colecao->loadMissing('estoques');
        }

        return $paginado ?? $colecao;
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Produto::create($data), 201);
    }

    public function show(Produto $produto)
    {
        return $produto->load('estoques.loja', 'fornecedor');
    }

    public function update(Request $request, Produto $produto)
    {
        $data = $this->validated($request, $produto->id);
        $produto->update($data);

        return $produto;
    }

    public function destroy(Produto $produto)
    {
        $produto->update(['ativo' => false]);

        return response()->json(null, 204);
    }

    /**
     * Ajusta (define) a quantidade em estoque de um produto numa loja.
     */
    public function definirEstoque(Request $request, Produto $produto)
    {
        $data = $request->validate([
            'loja_id' => ['required', 'exists:lojas,id'],
            'quantidade' => ['required', 'numeric'],
        ]);

        $estoque = ProdutoEstoque::updateOrCreate(
            ['produto_id' => $produto->id, 'loja_id' => $data['loja_id']],
            ['quantidade' => $data['quantidade']],
        );

        return $estoque;
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'codigo_barras' => ['nullable', 'string', 'max:255', 'unique:produtos,codigo_barras,'.($ignoreId ?? 'NULL').',id'],
            'codigo_interno' => ['nullable', 'string', 'max:255', 'unique:produtos,codigo_interno,'.($ignoreId ?? 'NULL').',id'],
            'descricao' => ['required', 'string', 'max:255'],
            'unidade' => ['nullable', 'string', 'max:10'],
            'tipo' => ['nullable', 'string', 'max:50'],
            'grupo' => ['nullable', 'string', 'max:255'],
            'subgrupo' => ['nullable', 'string', 'max:255'],
            'marca' => ['nullable', 'string', 'max:255'],
            'fornecedor_id' => ['nullable', 'exists:fornecedores,id'],
            'preco_custo' => ['nullable', 'numeric', 'min:0'],
            'margem_percentual' => ['nullable', 'numeric', 'min:0'],
            'preco_venda' => ['nullable', 'numeric', 'min:0'],
            'estoque_minimo' => ['nullable', 'integer', 'min:0'],
            'ativo' => ['boolean'],
        ]);
    }
}
