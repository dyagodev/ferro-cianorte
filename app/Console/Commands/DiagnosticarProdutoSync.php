<?php

namespace App\Console\Commands;

use App\Models\Produto;
use App\Models\ProdutoEstoque;
use App\Models\SyncConexao;
use App\Models\SyncExecucao;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Diagnóstico rápido de um produto específico pra investigar divergência de
 * estoque, sem precisar de tinker (alguns hostings só permitem rodar um
 * comando artisan de cada vez, não sessão interativa).
 */
#[Signature('sync:diagnosticar-produto {codigo_interno}')]
class DiagnosticarProdutoSync extends Command
{
    public function handle(): int
    {
        $codigoInterno = $this->argument('codigo_interno');

        $this->info("Produto com código interno \"{$codigoInterno}\":");
        $produtos = Produto::where('codigo_interno', $codigoInterno)->get();

        if ($produtos->isEmpty()) {
            $this->warn('Não encontrado no catálogo — nunca foi cadastrado (auto-criação pode ter falhado).');
        } else {
            $this->table(
                ['id', 'codigo_interno', 'codigo_barras', 'descricao'],
                $produtos->map(fn ($p) => [$p->id, $p->codigo_interno, $p->codigo_barras, $p->descricao])->all(),
            );
        }

        if ($produtos->isNotEmpty()) {
            $this->info('Estoque salvo por loja:');
            $estoques = ProdutoEstoque::with('loja')
                ->whereIn('produto_id', $produtos->pluck('id'))
                ->get();

            $this->table(
                ['produto_id', 'loja_id', 'loja', 'quantidade'],
                $estoques->map(fn ($e) => [$e->produto_id, $e->loja_id, $e->loja->nome ?? '—', $e->quantidade])->all(),
            );
        }

        $this->info('Conexões de sincronização e cursor de estoque:');
        $this->table(
            ['id', 'nome', 'loja_id', 'ultimo_id_estoque', 'ultima_atualizacao_estoque', 'ultimo_erro'],
            SyncConexao::all()->map(fn ($c) => [
                $c->id, $c->nome, $c->loja_id, $c->ultimo_id_estoque, $c->ultima_atualizacao_estoque, $c->ultimo_erro,
            ])->all(),
        );

        $this->info("Avisos recentes mencionando \"{$codigoInterno}\":");
        $avisos = SyncExecucao::latest('iniciado_em')
            ->limit(30)
            ->get()
            ->flatMap(fn ($e) => collect($e->avisos ?? [])
                ->filter(fn ($a) => str_contains($a, (string) $codigoInterno))
                ->map(fn ($a) => "[conexão {$e->sync_conexao_id} · {$e->iniciado_em}] {$a}"));

        if ($avisos->isEmpty()) {
            $this->line('Nenhum.');
        } else {
            $avisos->each(fn ($a) => $this->line($a));
        }

        return self::SUCCESS;
    }
}
