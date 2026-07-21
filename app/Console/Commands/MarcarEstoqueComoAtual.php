<?php

namespace App\Console\Commands;

use App\Models\SyncConexao;
use App\Services\LinkProSyncService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Ação manual, sob demanda — nunca agendada (ver routes/console.php, só
 * sync:lojas e sync:reconciliar-estoque rodam sozinhas). Pensada pra depois
 * de rodar sync:reconciliar-estoque (que já corrige o estoque puxando o
 * valor absoluto certo): sem isso aqui, a sincronização incremental de todo
 * minuto ainda tentaria reprocessar o histórico antigo (que pode ter sido
 * contabilizado por um caminho diferente antes de um fix), duplicando ou
 * confundindo o que a reconciliação acabou de corrigir.
 */
#[Signature('sync:estoque-marcar-atual {conexao? : ID de uma SyncConexao específica — sem isso, roda pra todas as ativas}')]
#[Description('Avança o cursor de sincronização de estoque pro presente, sem reprocessar histórico — uso manual, sob demanda')]
class MarcarEstoqueComoAtual extends Command
{
    public function handle(LinkProSyncService $service): int
    {
        $conexoes = $this->argument('conexao')
            ? SyncConexao::where('id', $this->argument('conexao'))->get()
            : SyncConexao::where('ativo', true)->get();

        if ($conexoes->isEmpty()) {
            $this->error('Nenhuma conexão encontrada.');

            return self::FAILURE;
        }

        if (! $this->confirm("Isso vai marcar o estoque como \"em dia\" pra {$conexoes->count()} conexão(ões) — nenhum movimento anterior a agora será reprocessado. Confirma?")) {
            $this->comment('Nada foi alterado.');

            return self::SUCCESS;
        }

        foreach ($conexoes as $conexao) {
            $this->line("[{$conexao->nome}] marcando estoque como atual...");
            $execucao = $service->marcarEstoqueComoAtual($conexao);

            if ($execucao->status === 'sucesso') {
                foreach ($execucao->avisos ?? [] as $aviso) {
                    $this->info("[{$conexao->nome}] {$aviso}");
                }
            } else {
                $this->error("[{$conexao->nome}] falhou — {$execucao->erro}");
            }
        }

        return self::SUCCESS;
    }
}
