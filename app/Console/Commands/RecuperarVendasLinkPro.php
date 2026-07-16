<?php

namespace App\Console\Commands;

use App\Models\SyncConexao;
use App\Services\LinkProSyncService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

#[Signature('sync:recuperar-vendas {--conexao= : ID da SyncConexao (padrão: todas as ativas)} {--desde= : Data inicial YYYY-MM-DD (padrão: 30 dias atrás)} {--ate= : Data final YYYY-MM-DD, exclusiva (padrão: agora)}')]
#[Description('Busca e sincroniza manualmente vendas que batem com a regra atual (NFC-e Autorizada) mas ficaram de fora do cursor incremental — não roda sozinho, é sob demanda')]
class RecuperarVendasLinkPro extends Command
{
    public function handle(LinkProSyncService $service): int
    {
        $desde = $this->option('desde') ?? Carbon::today()->subDays(30)->format('Y-m-d');
        $ate = $this->option('ate');

        $conexaoId = $this->option('conexao');
        $conexoes = $conexaoId
            ? SyncConexao::where('id', $conexaoId)->get()
            : SyncConexao::where('ativo', true)->get();

        if ($conexoes->isEmpty()) {
            $this->error('Nenhuma conexão encontrada.');

            return self::FAILURE;
        }

        foreach ($conexoes as $conexao) {
            $this->line("[{$conexao->nome}] buscando vendas de {$desde}".($ate ? " até {$ate}" : ' até agora').'...');

            $execucao = $service->recuperarVendas($conexao, $desde, $ate);

            if ($execucao->status === 'sucesso') {
                $this->info("[{$conexao->nome}] ok — {$execucao->vendas_sincronizadas} venda(s) recuperada(s).");
            } else {
                $this->error("[{$conexao->nome}] falhou — {$execucao->erro}");
            }

            foreach ($execucao->avisos ?? [] as $aviso) {
                $this->line("  - {$aviso}");
            }
        }

        return self::SUCCESS;
    }
}
