<?php

namespace App\Services;

use App\Models\Produto;
use App\Models\SyncConexao;
use App\Models\SyncExecucao;
use App\Models\User;
use App\Models\Venda;
use App\Support\TenantContext;
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

    // "pre_venda_codigo is null" (usado até 2026-07-16) partia da premissa de
    // que negociação vinda de pré-venda nunca é venda de balcão finalizada —
    // falso: confirmado com dado real (venda #39586, R$630, NFC-e 000011921
    // Autorizada) que uma negociação pode ter pre_venda_codigo preenchido E
    // estar 100% concluída, e nesse caso ficava de fora da sincronização pra
    // sempre. O sinal confiável de "venda consolidada" é a emissão da NFC-e
    // (confirmado com o usuário): only sincroniza quando existe uma NFC-e
    // "Autorizada" pra essa negociação. nfe.id_negociacao nem sempre vem
    // preenchido (visto no mesmo caso real), então o join certo é por
    // nfe.id_caixa -> caixa.id_caixa -> caixa.id_negociacao. Isso não corre
    // risco de pular venda nova cuja NFC-e ainda não autorizou: o cursor
    // (id_negociacao > ?) só avança pras negociações que efetivamente vieram
    // no resultado, então uma negociação sem NFC-e Autorizada ainda é
    // reconsiderada na sincronização seguinte, não é perdida.
    private const QUERY_VENDAS = <<<'SQL'
        select
          n.id_negociacao     as id,
          n.data              as data_hora,
          n.valor_total_venda as valor_total,
          (select codigo_loja::text from dados_empresa limit 1) as loja_externa,
          coalesce(u.nome, n.nome_usuario) as vendedor_nome
        from negociacao n
        left join usuario u on u.id_usuario = n.id_usuario
        where n.id_negociacao > ?
          and n.venda = true
          and n.data >= ?::timestamp
          and exists (
            select 1
            from caixa cx
            join nfe on nfe.id_caixa = cx.id_caixa and nfe.situacao = 'Autorizada'
            where cx.id_negociacao = n.id_negociacao
          )
        order by n.id_negociacao asc
        limit 200
        SQL;

    // Mesma regra da QUERY_VENDAS, mas pra recuperação manual
    // (LinkProSyncService::recuperarVendas): não usa o cursor incremental
    // (id_negociacao > cursor persistido), só um cursor local que começa do
    // 0 dentro do intervalo de datas pedido — assim pega tanto venda nova
    // quanto venda antiga que ficou de fora por causa da regra velha
    // (pre_venda_codigo), sem precisar mexer no cursor real usado pelo
    // sync:lojas de cada minuto.
    private const QUERY_VENDAS_RECUPERACAO = <<<'SQL'
        select
          n.id_negociacao     as id,
          n.data              as data_hora,
          n.valor_total_venda as valor_total,
          coalesce(u.nome, n.nome_usuario) as vendedor_nome
        from negociacao n
        left join usuario u on u.id_usuario = n.id_usuario
        where n.id_negociacao > ?
          and n.venda = true
          and n.data >= ?::timestamp
          and n.data < ?::timestamp
          and exists (
            select 1
            from caixa cx
            join nfe on nfe.id_caixa = cx.id_caixa and nfe.situacao = 'Autorizada'
            where cx.id_negociacao = n.id_negociacao
          )
        order by n.id_negociacao asc
        limit 500
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

    // id_ajuste_estoque_motivo só vem preenchido quando a mudança foi um
    // ajuste manual (contagem, balança, entrada de mercadoria) — nulo quando
    // é decorrente de venda. Filtramos pra só trazer ajuste manual de
    // propósito: venda do Link Pro já é decrementada por sincronizarVendas(),
    // contar ela de novo aqui decrementaria a mesma venda duas vezes.
    // qtd_estoque_antigo permite aplicar como DELTA (não valor absoluto) —
    // overwrite absoluto apagaria venda feita direto no nosso próprio caixa
    // entre uma sincronização e outra, já que o Link Pro nunca fica sabendo
    // dessa venda.
    private const QUERY_ESTOQUE = <<<'SQL'
        select
          l.id_log_produto_qtd_estoque as id,
          p.produto_codigo    as codigo_interno,
          l.qtd_estoque_antigo as quantidade_antiga,
          l.qtd_estoque_novo   as quantidade,
          l.data_hora          as atualizado_em,
          p.descricao          as descricao,
          p.cean               as codigo_barras,
          coalesce(u.descricao, 'UN') as unidade,
          p.preco_custo        as preco_custo,
          p.preco_venda        as preco_venda_cadastro
        from log_produto_qtd_estoque l
        join produto p on p.id_produto = l.id_produto
        left join prod_unidade u on u.id_prod_unidade = p.id_prod_unidade
        where (l.data_hora, l.id_log_produto_qtd_estoque) > (?::timestamp, ?::bigint)
          and l.id_ajuste_estoque_motivo is not null
        order by l.data_hora asc, l.id_log_produto_qtd_estoque asc
        limit 500
        SQL;

    // Reconciliação completa: lê o estoque ATUAL direto de produto.qtd_estoque
    // (não o histórico) — mais pesada, mas não depende do cursor incremental
    // ter alcançado o presente. Usada como rede de segurança quando o volume
    // de mudanças na loja é maior que o que o incremental consegue processar
    // por ciclo (limit 500 de QUERY_ESTOQUE), o que faz o cursor nunca
    // alcançar o "agora" de verdade.
    private const QUERY_ESTOQUE_COMPLETO = <<<'SQL'
        select
          p.produto_codigo as codigo_interno,
          p.qtd_estoque     as quantidade,
          p.descricao          as descricao,
          p.cean               as codigo_barras,
          coalesce(u.descricao, 'UN') as unidade,
          p.preco_custo        as preco_custo,
          p.preco_venda        as preco_venda_cadastro
        from produto p
        left join prod_unidade u on u.id_prod_unidade = p.id_prod_unidade
        where p.inativo = false
          and p.produto_codigo is not null
        SQL;

    // Lista enxuta (só o código) de todo produto ativo no Link Pro dessa
    // loja — usada pra desligar (produto_estoques.ativo = false) o que a
    // loja tinha mas não tem mais, sem pedir os outros campos de
    // QUERY_ESTOQUE_COMPLETO (não precisamos recadastrar nada aqui, só
    // comparar quais códigos existem).
    private const QUERY_CODIGOS_PRODUTOS_ATIVOS = <<<'SQL'
        select produto_codigo as codigo_interno
        from produto
        where inativo = false
          and produto_codigo is not null
        SQL;

    // Cobre os textos de forma de pagamento que o Link Pro já manda prontos
    // (confirmado real: "Dinheiro", "PIX", "Cartão" — ver sync-agent/README.md)
    // pro nosso enum (dinheiro/cartao/pix/boleto/cheque/crediario/a_prazo/outros),
    // já normalizado (sem acento, minúsculo). O de-para por conexão
    // (mapa_formas_pagamento) só deve ser preenchido pra cobrir texto fora do
    // padrão numa instalação específica — não devia ser necessário no caso comum.
    private const MAPA_FORMAS_PADRAO = [
        'dinheiro' => 'dinheiro',
        'pix' => 'pix',
        'cartao' => 'cartao',
        'cartao de credito' => 'cartao',
        'credito' => 'cartao',
        'cartao de debito' => 'cartao_debito',
        'debito' => 'cartao_debito',
        'boleto' => 'boleto',
        'cheque' => 'cheque',
        'crediario' => 'crediario',
        'a prazo' => 'a_prazo',
        'convenio' => 'outros',
    ];

    /** @var string[] */
    private array $avisos = [];

    public function sincronizar(SyncConexao $conexao): SyncExecucao
    {
        return $this->executar($conexao, 'incremental', function ($origem) use ($conexao) {
            $vendasSincronizadas = $this->sincronizarVendas($conexao, $origem);
            $estoqueAtualizado = $this->sincronizarEstoque($conexao, $origem);
            $this->sincronizarCatalogoLoja($conexao, $origem);

            return [$vendasSincronizadas, $estoqueAtualizado];
        });
    }

    /**
     * Rede de segurança contra o incremental nunca alcançar o "agora": lê o
     * estoque atual de TODOS os produtos direto de produto.qtd_estoque (não
     * depende do cursor de log_produto_qtd_estoque) e sobrescreve tudo.
     * Mais pesado que o incremental (lê a tabela de produtos inteira), não
     * roda a cada minuto — sob demanda ou num agendamento bem mais espaçado.
     */
    public function reconciliarEstoqueCompleto(SyncConexao $conexao): SyncExecucao
    {
        return $this->executar($conexao, 'reconciliacao_completa', function ($origem) use ($conexao) {
            $registros = $origem->select(self::QUERY_ESTOQUE_COMPLETO);
            $atualizados = 0;
            $produtoIdsEncontrados = [];

            // O Link Pro nunca fica sabendo de venda feita direto no nosso
            // próprio caixa (venda "nativa", sem sync_conexao_id) — o valor
            // absoluto de produto.qtd_estoque dele, então, sempre vem mais
            // alto do que a realidade por exatamente essa quantidade.
            // Descontamos aqui em vez de sobrescrever cego, senão toda
            // reconciliação apagaria as vendas feitas por fora do Link Pro.
            // Venda cancelada já teve o estoque estornado (VendaController::cancelar)
            // — contar ela aqui também descontaria a mesma quantidade duas vezes.
            $vendidoNativamentePorProduto = \App\Models\VendaItem::query()
                ->join('vendas', 'vendas.id', '=', 'venda_itens.venda_id')
                ->where('vendas.loja_id', $conexao->loja_id)
                ->whereNull('vendas.sync_conexao_id')
                ->where('vendas.status', '!=', 'cancelada')
                ->groupBy('venda_itens.produto_id')
                ->selectRaw('venda_itens.produto_id, sum(venda_itens.quantidade) as total')
                ->pluck('total', 'produto_id');

            foreach ($registros as $registro) {
                $produtoId = $this->garantirProduto($registro->codigo_interno, (array) $registro);
                if (! $produtoId) {
                    $this->avisos[] = "Reconciliação: produto \"{$registro->codigo_interno}\" não encontrado, ajuste ignorado.";

                    continue;
                }

                $produtoIdsEncontrados[] = $produtoId;

                $vendidoNativamente = (float) ($vendidoNativamentePorProduto[$produtoId] ?? 0);
                $quantidadeCorrigida = (float) $registro->quantidade - $vendidoNativamente;

                \App\Models\ProdutoEstoque::updateOrCreate(
                    ['produto_id' => $produtoId, 'loja_id' => $conexao->loja_id],
                    ['quantidade' => $quantidadeCorrigida],
                );

                $atualizados++;
            }

            // Essa leitura é a lista COMPLETA de produtos ativos com estoque
            // nessa loja de origem — qualquer produto que já tinha registro
            // aqui pra essa loja mas não apareceu agora não existe mais lá
            // (removido/desativado no Link Pro) ou zerou, então zera aqui
            // também em vez de deixar um valor antigo parado pra sempre (0
            // do Link Pro menos o que foi vendido nativamente, mesma
            // correção de cima — senão apagaria venda nativa desse produto).
            $faltantes = \App\Models\ProdutoEstoque::where('loja_id', $conexao->loja_id)
                ->whereNotIn('produto_id', $produtoIdsEncontrados)
                ->get();

            $zerados = 0;
            foreach ($faltantes as $estoqueFaltante) {
                $vendidoNativamente = (float) ($vendidoNativamentePorProduto[$estoqueFaltante->produto_id] ?? 0);
                $quantidadeCorrigida = 0 - $vendidoNativamente;

                if ((float) $estoqueFaltante->quantidade !== $quantidadeCorrigida) {
                    $estoqueFaltante->update(['quantidade' => $quantidadeCorrigida]);
                    $zerados++;
                }
            }

            if ($zerados > 0) {
                $this->avisos[] = "Reconciliação: {$zerados} produto(s) zerado(s) por não terem sido encontrados na origem.";
            }

            return [0, $atualizados + $zerados];
        });
    }

    /**
     * Esqueleto comum a sincronizar() e reconciliarEstoqueCompleto(): cria o
     * registro de execução, abre/fecha a conexão dinâmica com a origem, e
     * grava resultado ou erro de forma uniforme.
     *
     * @param  callable(Connection): array{0: int, 1: int}  $acao  retorna [vendas, estoque]
     */
    private function executar(SyncConexao $conexao, string $tipo, callable $acao): SyncExecucao
    {
        $execucao = SyncExecucao::create([
            'sync_conexao_id' => $conexao->id,
            'tipo' => $tipo,
            'iniciado_em' => now(),
            'status' => 'em_andamento',
        ]);

        $this->avisos = [];
        $nomeConexao = "sync_origem_{$conexao->id}";

        // Sync roda em background (comando agendado), sem usuário
        // autenticado pro Global Scope de empresa herdar — tem que setar
        // explicitamente qual empresa essa conexão pertence (via a loja
        // dela), senão garantirProduto() casaria/criaria produto pelo
        // codigo_interno em TODAS as empresas, misturando catálogo de
        // clientes diferentes.
        TenantContext::set($conexao->loja->empresa_id);

        try {
            $origem = $this->conectar($conexao, $nomeConexao);

            [$vendasSincronizadas, $estoqueAtualizado] = $acao($origem);

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
            TenantContext::clear();
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

        $criadas = $this->processarVendasExternas($vendas, $origem, $conexao);

        // Cursor avança até a última venda do lote independente de ter
        // criado Venda ou não (já existia, item não mapeou etc.) — do
        // contrário uma venda "travada" (ex.: produto que nunca vai casar)
        // seria retentada pra sempre a cada minuto.
        $conexao->ultimo_id_processado = (int) end($vendas)->id;
        $conexao->save();

        return $criadas;
    }

    /**
     * Busca vendas que já batem com a regra atual (venda=true + NFC-e
     * Autorizada) num intervalo de datas, sem depender do cursor
     * incremental (ultimo_id_processado) — pega tanto venda nova quanto
     * venda antiga que ficou de fora por causa de uma regra velha ou de um
     * bug já corrigido. Não mexe no cursor real do sync:lojas: rodar isso
     * não atrapalha nem duplica o que a sincronização de cada minuto já fez
     * (idempotente por uuid, igual sincronizarVendas).
     */
    public function recuperarVendas(SyncConexao $conexao, string $desde, ?string $ate = null): SyncExecucao
    {
        $ate ??= now()->addDay()->format('Y-m-d');

        return $this->executar($conexao, 'recuperacao_manual', function (Connection $origem) use ($conexao, $desde, $ate) {
            $encontradas = 0;
            $sincronizadas = 0;
            $ultimoIdLocal = 0;

            while (true) {
                $vendas = $origem->select(self::QUERY_VENDAS_RECUPERACAO, [$ultimoIdLocal, $desde, $ate]);
                if (empty($vendas)) {
                    break;
                }

                $encontradas += count($vendas);
                $sincronizadas += $this->processarVendasExternas($vendas, $origem, $conexao);
                $ultimoIdLocal = (int) end($vendas)->id;
            }

            $this->avisos[] = "Recuperação manual ({$desde} a {$ate}): {$encontradas} venda(s) encontrada(s) batendo com a regra atual, {$sincronizadas} sincronizada(s) agora (o resto já existia).";

            return [$sincronizadas, 0];
        });
    }

    /**
     * Processa um lote de vendas externas já buscadas (itens, pagamentos,
     * cálculo de desconto, dedupe por uuid) — comum a sincronizarVendas()
     * (incremental, a cada minuto) e recuperarVendas() (manual, sob
     * demanda). Retorna quantas vendas foram criadas de fato (as que já
     * existiam por uuid não contam).
     */
    private function processarVendasExternas(array $vendasExternas, Connection $origem, SyncConexao $conexao): int
    {
        $ids = array_map(fn ($v) => (int) $v->id, $vendasExternas);
        $idsPg = '{'.implode(',', $ids).'}';

        $itensPorVenda = collect($origem->select(self::QUERY_ITENS, [$idsPg]))->groupBy('venda_id');
        $pagamentosPorVenda = collect($origem->select(self::QUERY_PAGAMENTOS, [$idsPg]))->groupBy('venda_id');

        // O de-para configurado na conexão tem prioridade (cobre texto fora do
        // padrão numa instalação específica); o padrão embutido cobre o caso
        // comum sem precisar de nenhuma configuração.
        $mapaFormas = collect(self::MAPA_FORMAS_PADRAO)
            ->merge(
                collect($conexao->mapa_formas_pagamento ?? [])
                    ->mapWithKeys(fn ($destino, $origemTexto) => [$this->normalizar($origemTexto) => $destino]),
            );

        $usuario = $this->usuarioResponsavel();
        $criadas = 0;

        foreach ($vendasExternas as $vendaExterna) {
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

                continue;
            }

            $pagamentos = [];
            foreach ($pagamentosPorVenda->get($vendaExterna->id, []) as $pagamento) {
                $forma = $mapaFormas->get($this->normalizar($pagamento->forma_pagamento));
                if (! $forma) {
                    // "outros" e não "dinheiro" de propósito: assumir dinheiro
                    // pra uma forma de pagamento não reconhecida mascararia
                    // PIX/cartão como dinheiro no fechamento de caixa.
                    $this->avisos[] = "Venda externa #{$vendaExterna->id}: forma de pagamento \"{$pagamento->forma_pagamento}\" não reconhecida, usando \"outros\".";
                }
                $pagamentos[] = ['forma_pagamento' => $forma ?? 'outros', 'valor' => (float) $pagamento->valor];
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
                $this->registrarVenda(
                    $uuid,
                    $conexao->id,
                    $conexao->loja_id,
                    $usuario->id,
                    $vendaExterna->vendedor_nome ?? null,
                    $vendaExterna->data_hora,
                    $itens,
                    $pagamentos,
                    $subtotal,
                    $desconto,
                );
                $criadas++;
            }
        }

        return $criadas;
    }

    private function registrarVenda(
        string $uuid,
        int $syncConexaoId,
        int $lojaId,
        int $userId,
        ?string $vendedorExternoNome,
        string $dataHora,
        array $itens,
        array $pagamentos,
        float $subtotal,
        float $desconto,
    ): void {
        DB::transaction(function () use ($uuid, $syncConexaoId, $lojaId, $userId, $vendedorExternoNome, $dataHora, $itens, $pagamentos, $subtotal, $desconto) {
            $venda = Venda::create([
                'uuid' => $uuid,
                'loja_id' => $lojaId,
                'sync_conexao_id' => $syncConexaoId,
                'user_id' => $userId,
                'vendedor_externo_nome' => $vendedorExternoNome,
                'subtotal' => $subtotal,
                'desconto' => $desconto,
                'total' => $subtotal - $desconto,
                'status' => 'concluida',
                'feita_offline' => false,
            ]);

            // Preserva a data real da venda de origem (não o momento da
            // sincronização), senão relatório por período/fechamento de
            // caixa fica errado. O timestamp do Link Pro vem "cru" (sem
            // fuso, já em horário de Brasília, hora local da loja — o
            // Postgres de origem confirma timezone America/Araguaina, que é
            // Brasília) — parse com America/Sao_Paulo interpreta o valor
            // certo, mas sem ->utc() o Carbon guarda esse mesmo relógio
            // "rotulado" como Brasília e o Eloquent grava ele cru (sem
            // converter), fazendo a leitura de volta (que assume UTC)
            // aplicar o desconto de 3h errado. ->utc() converte de verdade
            // pro instante UTC certo antes de gravar.
            $momento = Carbon::parse($dataHora, 'America/Sao_Paulo')->utc();
            $venda->created_at = $momento;
            $venda->updated_at = $momento;
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
     * balança, entrada de mercadoria — QUERY_ESTOQUE já filtra só esses,
     * exclui o que é decorrente de venda). Aplica como DELTA
     * (qtd_estoque_novo - qtd_estoque_antigo), não como valor absoluto —
     * overwrite apagaria uma venda feita direto no nosso próprio caixa que
     * aconteceu entre uma sincronização e outra, já que o Link Pro nunca
     * fica sabendo dela.
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

            $delta = (float) $registro->quantidade - (float) $registro->quantidade_antiga;
            if ($delta === 0.0) {
                continue;
            }

            $estoque = \App\Models\ProdutoEstoque::firstOrCreate(
                ['produto_id' => $produtoId, 'loja_id' => $conexao->loja_id],
                ['quantidade' => 0],
            );
            $estoque->increment('quantidade', $delta);

            $atualizados++;
        }

        $ultimoRegistro = end($registros);
        $conexao->ultima_atualizacao_estoque = $ultimoRegistro->atualizado_em;
        $conexao->ultimo_id_estoque = $ultimoRegistro->id;
        $conexao->save();

        return $atualizados;
    }

    /**
     * Desliga (produto_estoques.ativo = false) o produto que essa loja
     * tinha mas não tem mais no Link Pro dela — sem mexer no cadastro
     * global do produto nem no vínculo dele com outras lojas, então uma
     * loja não pode "apagar" produto de outra. Religa automaticamente se o
     * produto reaparecer no Link Pro depois (ex.: reativado por engano lá).
     * Roda toda sincronização incremental — a lista de códigos é leve (só
     * a coluna código, catálogo de loja de material de construção não passa
     * de baixos milhares de linhas), diferente de reconciliarEstoqueCompleto()
     * que traz o registro inteiro de cada produto.
     */
    private function sincronizarCatalogoLoja(SyncConexao $conexao, Connection $origem): void
    {
        $codigosAtivos = collect($origem->select(self::QUERY_CODIGOS_PRODUTOS_ATIVOS))
            ->pluck('codigo_interno')
            ->all();

        // Lista vazia quase certamente é falha de leitura, não uma loja sem
        // nenhum produto ativo — "whereNotIn" com array vazio bateria em
        // TUDO (NOT IN () é sempre verdadeiro), desligando o catálogo
        // inteiro da loja de uma vez. Mais seguro pular o ciclo do que
        // arriscar isso.
        if (empty($codigosAtivos)) {
            $this->avisos[] = 'Sincronização de catálogo: Link Pro não retornou nenhum produto ativo, pulando desligamento nesta rodada (provável falha de leitura).';

            return;
        }

        $desligados = \App\Models\ProdutoEstoque::where('loja_id', $conexao->loja_id)
            ->where('ativo', true)
            ->whereHas('produto', fn ($q) => $q->whereNotIn('codigo_interno', $codigosAtivos))
            ->update(['ativo' => false]);

        $religados = \App\Models\ProdutoEstoque::where('loja_id', $conexao->loja_id)
            ->where('ativo', false)
            ->whereHas('produto', fn ($q) => $q->whereIn('codigo_interno', $codigosAtivos))
            ->update(['ativo' => true]);

        if ($desligados > 0) {
            $this->avisos[] = "{$desligados} produto(s) desligado(s) desta loja (não encontrados mais no Link Pro dela).";
        }
        if ($religados > 0) {
            $this->avisos[] = "{$religados} produto(s) religado(s) nesta loja (voltaram a existir no Link Pro dela).";
        }
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

        $dadosProduto = [
            'codigo_interno' => $codigoInterno,
            'codigo_barras' => $dadosOrigem['codigo_barras'] ?? null,
            'descricao' => $descricao,
            'unidade' => $dadosOrigem['unidade'] ?? 'UN',
            'preco_custo' => $precoCusto,
            'margem_percentual' => $margem,
            'preco_venda' => $precoVenda,
        ];

        try {
            $produto = Produto::create($dadosProduto);
            $this->avisos[] = "Produto \"{$descricao}\" (código interno \"{$codigoInterno}\") cadastrado automaticamente.";

            return $produto->id;
        } catch (Throwable $e) {
            // Código de barras genérico repetido em vários itens é comum em
            // loja de material de construção (o cean já pode pertencer a
            // outro produto) — o casamento com o Link Pro é sempre feito
            // pelo codigo_interno, nunca pelo cean, então cadastrar sem
            // código de barras não compromete a sincronização futura.
            if ($dadosProduto['codigo_barras'] && $this->violaCodigoBarrasUnico($e)) {
                try {
                    $produto = Produto::create([...$dadosProduto, 'codigo_barras' => null]);
                    $this->avisos[] = "Produto \"{$descricao}\" (código interno \"{$codigoInterno}\") cadastrado automaticamente sem código de barras — \"{$dadosProduto['codigo_barras']}\" já pertence a outro produto.";

                    return $produto->id;
                } catch (Throwable $e2) {
                    $this->avisos[] = "Não foi possível cadastrar automaticamente o produto \"{$codigoInterno}\": {$e2->getMessage()}";

                    return null;
                }
            }

            $this->avisos[] = "Não foi possível cadastrar automaticamente o produto \"{$codigoInterno}\": {$e->getMessage()}";

            return null;
        }
    }

    private function violaCodigoBarrasUnico(Throwable $e): bool
    {
        return str_contains($e->getMessage(), 'codigo_barras');
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
