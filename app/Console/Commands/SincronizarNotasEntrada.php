<?php

namespace App\Console\Commands;

use App\Models\Loja;
use App\Services\DistribuicaoDfeService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

/**
 * Consulta a Distribuição DFe da SEFAZ pra cada loja com certificado
 * configurado — mesmo serviço usado pelo botão "Sincronizar agora" da tela
 * admin/notas-entrada (ver NotaFiscalTerceiroController::sincronizar()),
 * só que percorrendo todas as lojas automaticamente.
 */
#[Signature('sync:notas-entrada')]
#[Description('Busca notas fiscais de fornecedor emitidas contra o CNPJ de cada loja (Distribuição DFe)')]
class SincronizarNotasEntrada extends Command
{
    public function handle(DistribuicaoDfeService $service): int
    {
        $lojas = Loja::where('ativo', true)->get()->filter(fn (Loja $loja) => $loja->possuiCertificado());

        foreach ($lojas as $loja) {
            try {
                $resumo = $service->sincronizar($loja);
                $this->info("Loja {$loja->nome}: {$resumo['novas']} nova(s), {$resumo['atualizadas']} atualizada(s), {$resumo['erros']} erro(s).");
            } catch (Throwable $e) {
                $this->error("Loja {$loja->nome}: falha na sincronização — {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
