<?php

namespace App\Console\Commands;

use App\Models\SyncConexao;
use App\Services\LinkProSyncService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sync:reconciliar-estoque')]
#[Description('Reconciliação completa de estoque (lê produto.qtd_estoque direto, sem depender do cursor incremental) — mais pesada, não roda a cada minuto')]
class ReconciliarEstoqueLojasLinkPro extends Command
{
    public function handle(LinkProSyncService $service): int
    {
        $conexoes = SyncConexao::where('ativo', true)->get();

        foreach ($conexoes as $conexao) {
            $this->line("[{$conexao->nome}] reconciliando estoque...");
            $execucao = $service->reconciliarEstoqueCompleto($conexao);

            if ($execucao->status === 'sucesso') {
                $this->info("[{$conexao->nome}] ok — {$execucao->estoque_atualizado} produto(s) corrigido(s).");
            } else {
                $this->error("[{$conexao->nome}] falhou — {$execucao->erro}");
            }
        }

        return self::SUCCESS;
    }
}
