<?php

namespace App\Console\Commands;

use App\Models\SyncConexao;
use App\Services\LinkProSyncService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sync:lojas')]
#[Description('Sincroniza vendas/estoque de todas as conexões Link Pro ativas dentro do horário de funcionamento')]
class SincronizarLojasLinkPro extends Command
{
    public function handle(LinkProSyncService $service): int
    {
        $conexoes = SyncConexao::where('ativo', true)->get();

        foreach ($conexoes as $conexao) {
            if (! $conexao->dentroDoHorarioDeFuncionamento()) {
                $this->line("[{$conexao->nome}] fora do horário de funcionamento, pulando.");

                continue;
            }

            $this->line("[{$conexao->nome}] sincronizando...");
            $execucao = $service->sincronizar($conexao);

            if ($execucao->status === 'sucesso') {
                $this->info("[{$conexao->nome}] ok — {$execucao->vendas_sincronizadas} venda(s), {$execucao->estoque_atualizado} estoque(s).");
            } else {
                $this->error("[{$conexao->nome}] falhou — {$execucao->erro}");
            }
        }

        return self::SUCCESS;
    }
}
