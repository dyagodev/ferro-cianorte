<?php

namespace App\Services;

use App\Models\Produto;
use App\Models\SyncConexao;
use App\Models\SyncExecucao;
use App\Models\User;
use App\Models\Venda;
use Illuminate\Database\Connection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Ramsey\Uuid\Uuid;
use Throwable;

/**
 * Porta pra dentro do Laravel a lógica que antes rodava no sync-agent
 * (Node.js, instalado na máquina de cada loja): lê vendas/itens/pagamentos e
 * ajustes de estoque direto do Postgres do Link Pro de cada loja (uma
 * SyncConexao = um Postgres remoto) e grava aqui pelas mesmas regras que
 * VendaController::sync usava quando o agente empurrava via HTTP — agora é
 * tudo em processo, sem chamada de API.
 *
 * As queries abaixo são as confirmadas contra o schema real do Link Pro
 * (InkDB) em sync-agent/queries/*.sql — ver aquele README pra contexto de
 * cada coluna/join.
 */
class LinkProSyncService
{
    // Namespace fixo pra gerar UUIDs determinísticos — mesmo valor usado
    // historicamente pelo sync-agent (transformar.js), mantido por
    // compatibilidade com vendas já sincronizadas antes desta migração.
    private const NAMESPACE_LINKPRO = '5f2f2f5e-3d0a-4a8a-9b8a-2f6a4c6f9f10';

    private const QUERY_VENDAS = <<<'SQL'
        select
          n.id_negociacao     as id,
          n.data              as data_hora,
          n.valor_total_venda as valor_total,
          (select codigo_loja::text from dados_empresa limit 1) as loja_externa
        from negociacao n
        where n.id_negociacao > ?
          and n.venda = true
          and n.pre_venda_codigo is null
          and n.data >= ?::timestamp
        order by n.id_negociacao asc
        limit 200
        SQL;

    private const QUERY_ITENS = <<<'SQL'
        select
          iv.id_negociacao   as venda_id,
          p.produto_codigo   as codigo_interno,
          iv.qtd             as quantidade,
          round(iv.preco_bruto_unitario * (1 - iv.desconto_percentual / 100.0), 2) as preco_unitario,
          p.descricao         as descricao,
          p.cean              as codigo_barras,
          coalesce(u.descricao, 'UN') as unidade,
          p.preco_custo       as preco_custo,
          p.preco_venda       as preco_venda_cadastro
        from negociacao_item_vendido iv
        join produto p on p.id_produto = iv.id_produto
        left join prod_unidade u on u.id_prod_unidade = p.id_prod_unidade
        where iv.id_negociacao = any(?::bigint[])
        SQL;

    private const QUERY_PAGAMENTOS = <<<'SQL'
        select
          c.id_negociacao as venda_id,
          v.descricao_fp   as forma_pagamento,
          v.valor          as valor
        from vw_formas_pagamento_por_estacao v
        join caixa c on c.id_caixa = v.id_caixa
        where c.id_negociacao = any(?::bigint[])
        SQL;

    private const QUERY_ESTOQUE = <<<'SQL'
        select
          l.id_log_produto_qtd_estoque as id,
          p.produto_codigo   as codigo_interno,
          l.qtd_estoque_novo as quantidade,
          l.data_hora         as atualizado_em,
          p.descricao          as descricao,
          p.cean               as codigo_barras,
          coalesce(u.descricao, 'UN') as unidade,
          p.preco_custo        as preco_custo,
          p.preco_venda        as preco_venda_cadastro
        from log_produto_qtd_estoque l
        join produto p on p.id_produto = l.id_produto
        left join prod_unidade u on u.id_prod_unidade = p.id_prod_unidade
        where (l.data_hora, l.id_log_produto_qtd_estoque) > (?::timestamp, ?::bigint)
        order by l.data_hora asc, l.id_log_produto_qtd_estoque asc
        limit 500
        SQL;

    /** @var string[] */
    private array $avisos = [];

    public function sincronizar(SyncConexao $conexao): SyncExecucao
    {
        $execucao = SyncExecucao::create([
            'sync_conexao_id' => $conexao->id,
            'iniciado_em' => now(),
            'status' => 'em_andamento',
        ]);

        $this->avisos = [];
        $nomeConexao = "sync_origem_{$conexao->id}";

        try {
            $origem = $this->conectar($conexao, $nomeConexao);

            $vendasSincronizadas = $this->sincronizarVendas($conexao, $origem);
            $estoqueAtualizado = $this->sincronizarEstoque($conexao, $origem);

            $conexao->ultima_sincronizacao_em = now();
            $conexao->ultimo_erro = null;
            $conexao->save();

            $execucao->update([
                'finalizado_em' => now(),
                'status' => 'sucesso',
                'vendas_sincronizadas' => $vendasSincronizadas,
                'estoque_atualizado' => $estoqueAtualizado,
                'avisos' => $this->avisos,
            ]);
        } catch (Throwable $e) {
            $conexao->ultimo_erro = $e->getMessage();
            $conexao->save();

            $execucao->update([
                'finalizado_em' => now(),
                'status' => 'erro',
                'avisos' => $this->avisos,
                'erro' => $e->getMessage(),
            ]);
        } finally {
            DB::purge($nomeConexao);
        }

        return $execucao->fresh();
    }

    private function conectar(SyncConexao $conexao, string $nome): Connection
    {
        config(["database.connections.$nome" => [
            'driver' => 'pgsql',
            'host' => $conexao->host,
            'port' => $conexao->porta,
            'database' => $conexao->database,
            'username' => $conexao->usuario,
            'password' => $conexao->senha,
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'public',
            'sslmode' => $conexao->ssl ? 'require' : 'prefer',
        ]]);

        $conexaoDb = DB::connection($nome);
        // node-postgres, no agente antigo, tratava timestamp como string bruta
        // pra nunca converter fuso horário — aqui a extensão pdo_pgsql já
        // devolve timestamp como string por padrão, sem cast pra DateTime,
        // então o mesmo cuidado já vem de graça.
        $conexaoDb->getPdo();

        return $conexaoDb;
    }

    /**
     * Busca vendas novas (id > checkpoint, data >= sync_desde) e replica
     * cada uma seguindo a mesma regra de VendaController::registrarVenda —
     * idempotente por uuid, decrementa estoque da loja, preserva a data
     * real da venda.
     */
    private function sincronizarVendas(SyncConexao $conexao, Connection $origem): int
    {
        $ultimoId = $conexao->ultimo_id_processado ?? 0;
        $syncDesde = ($conexao->sync_desde ?? Carbon::today())->format('Y-m-d');

        $vendas = $origem->select(self::QUERY_VENDAS, [$ultimoId, $syncDesde]);
        if (empty($vendas)) {
            return 0;
        }

        $ids = array_map(fn ($v) => (int) $v->id, $vendas);
        $idsPg = '{'.implode(',', $ids).'}';

        $itensPorVenda = collect($origem->select(self::QUERY_ITENS, [$idsPg]))->groupBy('venda_id');
        $pagamentosPorVenda = collect($origem->select(self::QUERY_PAGAMENTOS, [$idsPg]))->groupBy('venda_id');

        $mapaFormas = collect($conexao->mapa_formas_pagamento ?? [])
            ->mapWithKeys(fn ($destino, $origemTexto) => [$this->normalizar($origemTexto) => $destino]);

        $usuario = $this->usuarioResponsavel();
        $processadas = 0;

        foreach ($vendas as $vendaExterna) {
            $itens = [];

            foreach ($itensPorVenda->get($vendaExterna->id, []) as $item) {
                $produtoId = $this->garantirProduto($item->codigo_interno, (array) $item);
                if (! $produtoId) {
                    $this->avisos[] = "Venda externa #{$vendaExterna->id}: produto \"{$item->codigo_interno}\" não encontrado, item ignorado.";

                    continue;
                }

                $itens[] = [
                    'produto_id' => $produtoId,
                    'quantidade' => (float) $item->quantidade,
                    'preco_unitario' => (float) $item->preco_unitario,
                ];
            }

            if (empty($itens)) {
                $this->avisos[] = "Venda externa #{$vendaExterna->id}: nenhum item pôde ser mapeado, venda ignorada.";
                $conexao->ultimo_id_processado = $vendaExterna->id;

                continue;
            }

            $pagamentos = [];
            foreach ($pagamentosPorVenda->get($vendaExterna->id, []) as $pagamento) {
                $forma = $mapaFormas->get($this->normalizar($pagamento->forma_pagamento));
                if (! $forma) {
                    $this->avisos[] = "Venda externa #{$vendaExterna->id}: forma de pagamento \"{$pagamento->forma_pagamento}\" sem mapeamento, usando \"dinheiro\".";
                }
                $pagamentos[] = ['forma_pagamento' => $forma ?? 'dinheiro', 'valor' => (float) $pagamento->valor];
            }

            $subtotal = array_sum(array_map(fn ($i) => $i['quantidade'] * $i['preco_unitario'], $itens));
            $valorTotalOrigem = (float) $vendaExterna->valor_total;
            // negociacao_item_vendido não reflete desconto dado na tela de
            // fechamento da venda (só desconto por item) — o desconto real é
            // a diferença entre a soma bruta dos itens e o valor final que o
            // Link Pro registrou.
            $desconto = $valorTotalOrigem > 0 ? max(0, $subtotal - $valorTotalOrigem) : 0;

            if (empty($pagamentos)) {
                $pagamentos[] = [
                    'forma_pagamento' => 'dinheiro',
                    'valor' => $valorTotalOrigem > 0 ? $valorTotalOrigem : $subtotal,
                ];
            }

            // Inclui o id da conexão no seed do uuid (não só o id da venda):
            // cada loja tem sua própria sequência de id_negociacao começando
            // do 1, então duas lojas diferentes podem ter a mesma venda #500
            // — sem isso as duas colidiriam no mesmo uuid.
            $uuid = Uuid::uuid5(self::NAMESPACE_LINKPRO, "{$conexao->id}:{$vendaExterna->id}")->toString();

            if (! Venda::where('uuid', $uuid)->exists()) {
                $this->registrarVenda($uuid, $conexao->loja_id, $usuario->id, $vendaExterna->data_hora, $itens, $pagamentos, $subtotal, $desconto);
            }

            $processadas++;
            $conexao->ultimo_id_processado = $vendaExterna->id;
        }

        $conexao->save();

        return $processadas;
    }

    private function registrarVenda(
        string $uuid,
        int $lojaId,
        int $userId,
        string $dataHora,
        array $itens,
        array $pagamentos,
        float $subtotal,
        float $desconto,
    ): void {
        DB::transaction(function () use ($uuid, $lojaId, $userId, $dataHora, $itens, $pagamentos, $subtotal, $desconto) {
            $venda = Venda::create([
                'uuid' => $uuid,
                'loja_id' => $lojaId,
                'user_id' => $userId,
                'subtotal' => $subtotal,
                'desconto' => $desconto,
                'total' => $subtotal - $desconto,
                'status' => 'concluida',
                'feita_offline' => false,
            ]);

            // Preserva a data real da venda de origem (não o momento da
            // sincronização), senão relatório por período/fechamento de
            // caixa fica errado.
            $venda->created_at = $dataHora;
            $venda->updated_at = $dataHora;
            $venda->save();

            $produtos = Produto::whereIn('id', array_column($itens, 'produto_id'))->get()->keyBy('id');

            foreach ($itens as $item) {
                $venda->itens()->create([
                    'produto_id' => $item['produto_id'],
                    'quantidade' => $item['quantidade'],
                    'preco_original' => $produtos[$item['produto_id']]->preco_venda,
                    'preco_unitario' => $item['preco_unitario'],
                    'total' => $item['quantidade'] * $item['preco_unitario'],
                ]);

                $this->decrementarEstoque($item['produto_id'], $lojaId, $item['quantidade']);
            }

            foreach ($pagamentos as $pagamento) {
                $venda->pagamentos()->create($pagamento);
            }
        });
    }

    private function decrementarEstoque(int $produtoId, int $lojaId, float $quantidade): void
    {
        $estoque = \App\Models\ProdutoEstoque::where('produto_id', $produtoId)
            ->where('loja_id', $lojaId)
            ->lockForUpdate()
            ->first();

        if (! $estoque) {
            $estoque = \App\Models\ProdutoEstoque::create([
                'produto_id' => $produtoId,
                'loja_id' => $lojaId,
                'quantidade' => 0,
            ]);
        }

        // Estoque pode ficar negativo de propósito (o caixa não deve travar
        // por divergência) — quantidade fracionária de propósito (produto
        // vendido por peso/metro).
        $estoque->decrement('quantidade', $quantidade);
    }

    /**
     * Ajustes de estoque feitos SEM venda no Link Pro (contagem manual,
     * balança, entrada de mercadoria) — sobrescreve a quantidade
     * correspondente aqui, produto a produto, pra nunca ficar com furo entre
     * os dois sistemas.
     */
    private function sincronizarEstoque(SyncConexao $conexao, Connection $origem): int
    {
        $desde = $conexao->ultima_atualizacao_estoque?->format('Y-m-d H:i:s') ?? '1970-01-01 00:00:00';
        $ultimoId = $conexao->ultimo_id_estoque ?? 0;

        $registros = $origem->select(self::QUERY_ESTOQUE, [$desde, $ultimoId]);
        if (empty($registros)) {
            return 0;
        }

        $atualizados = 0;

        foreach ($registros as $registro) {
            $produtoId = $this->garantirProduto($registro->codigo_interno, (array) $registro);
            if (! $produtoId) {
                $this->avisos[] = "Estoque: produto \"{$registro->codigo_interno}\" não encontrado, ajuste ignorado.";

                continue;
            }

            \App\Models\ProdutoEstoque::updateOrCreate(
                ['produto_id' => $produtoId, 'loja_id' => $conexao->loja_id],
                ['quantidade' => (float) $registro->quantidade],
            );

            $atualizados++;
        }

        $ultimoRegistro = end($registros);
        $conexao->ultima_atualizacao_estoque = $ultimoRegistro->atualizado_em;
        $conexao->ultimo_id_estoque = $ultimoRegistro->id;
        $conexao->save();

        return $atualizados;
    }

    /**
     * Resolve o produto_id pelo código interno — cadastra automaticamente se
     * ainda não existir (em vez de só ignorar o item), usando descrição/preço
     * vindos do Link Pro. Sem descrição não tem como cadastrar (campo
     * obrigatório), aí só ignora e avisa.
     */
    private function garantirProduto(?string $codigoInterno, array $dadosOrigem): ?int
    {
        if (! $codigoInterno) {
            return null;
        }

        $produto = Produto::where('codigo_interno', $codigoInterno)->first();
        if ($produto) {
            return $produto->id;
        }

        $descricao = trim((string) ($dadosOrigem['descricao'] ?? ''));
        if ($descricao === '') {
            $this->avisos[] = "Produto código interno \"{$codigoInterno}\" não encontrado e sem descrição pra cadastrar automaticamente.";

            return null;
        }

        $precoCusto = (float) ($dadosOrigem['preco_custo'] ?? 0);
        $precoVenda = (float) ($dadosOrigem['preco_venda_cadastro'] ?? 0);
        $margem = $precoCusto > 0 ? round((($precoVenda - $precoCusto) / $precoCusto) * 100, 2) : 0;

        try {
            $produto = Produto::create([
                'codigo_interno' => $codigoInterno,
                'codigo_barras' => $dadosOrigem['codigo_barras'] ?? null,
                'descricao' => $descricao,
                'unidade' => $dadosOrigem['unidade'] ?? 'UN',
                'preco_custo' => $precoCusto,
                'margem_percentual' => $margem,
                'preco_venda' => $precoVenda,
            ]);

            $this->avisos[] = "Produto \"{$descricao}\" (código interno \"{$codigoInterno}\") cadastrado automaticamente.";

            return $produto->id;
        } catch (Throwable $e) {
            $this->avisos[] = "Não foi possível cadastrar automaticamente o produto \"{$codigoInterno}\": {$e->getMessage()}";

            return null;
        }
    }

    /**
     * Vendas sincronizadas precisam de um user_id (coluna obrigatória).
     * Como é um processo automático, não um vendedor logado, usa o primeiro
     * admin cadastrado — mesmo papel que o "usuário de integração" que o
     * sync-agent antigo exigia pra autenticar na API.
     */
    private function usuarioResponsavel(): User
    {
        return User::where('role', 'admin')->orderBy('id')->firstOrFail();
    }

    private function normalizar(?string $texto): string
    {
        return Str::of($texto ?? '')->trim()->lower()->ascii()->toString();
    }
}
