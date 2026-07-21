<?php

namespace App\Console\Commands;

use App\Models\GrupoFiscal;
use App\Models\Loja;
use App\Models\Produto;
use App\Support\TenantContext;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Gera um grupo fiscal por NCM a partir do mesmo relatório "Consulta NF-e"
 * usado por ImportarProdutosPlanilhaNfe, e já vincula cada produto ao seu
 * grupo. Pensado pra empresa de Regime Normal (Lucro Presumido/Real) — usa
 * cst_icms, não csosn.
 *
 * IMPORTANTE: a planilha é de ENTRADA (CST/CFOP de como o FORNECEDOR vendeu
 * pra essa empresa), não de saída. O que essa importação assume, com base
 * em como CFOP/CST funcionam na prática pra revenda simples (não
 * industrialização):
 *   - CFOP 5102 (venda de mercadoria de terceiro, dentro do estado) e 5405/
 *     5403 (idem, sujeito a substituição tributária) descrevem o TIPO de
 *     operação, não quem é o vendedor — continuam válidos quando essa
 *     empresa revende o mesmo produto. cfop_fora_estado é derivado trocando
 *     o primeiro dígito 5->6 (convenção padrão dentro/fora estado).
 *   - CST 60 (ICMS já retido por ST) na entrada implica CST 60 na saída
 *     também — não cobra ICMS de novo, ele já foi recolhido lá atrás.
 *   - CST 00/10/20/40 (tributação normal/isenta) é usado como ponto de
 *     partida com a MESMA alíquota vista na entrada — isso é a parte menos
 *     certa (a alíquota de saída pode diferir por legislação estadual
 *     específica do NCM) e pede revisão de um contador antes de emitir nota
 *     de produção de verdade.
 *   - PIS/COFINS não vêm nessa planilha — ficam em branco (o código já usa
 *     um fallback seguro, CST 07 isento, quando o grupo não define nada).
 *
 * Quando mais de uma combinação CFOP/CST/alíquota aparece pro mesmo NCM
 * (notas diferentes, pequena variação), usa a mais frequente.
 */
#[Signature('app:gerar-grupos-fiscais-nfe-planilha {arquivo : Caminho do .xls} {loja_id : Loja dona do catálogo} {--dry-run : Só mostra o que faria, não grava nada}')]
#[Description('Gera grupos fiscais por NCM a partir de um relatório "Consulta NF-e" (.xls) e vincula os produtos já importados')]
class GerarGruposFiscaisPlanilhaNfe extends Command
{
    public function handle(): int
    {
        $loja = Loja::withoutGlobalScopes()->find($this->argument('loja_id'));
        if (! $loja) {
            $this->error('Loja não encontrada.');

            return self::FAILURE;
        }

        $arquivo = $this->argument('arquivo');
        if (! is_file($arquivo)) {
            $this->error("Arquivo não encontrado: {$arquivo}");

            return self::FAILURE;
        }

        TenantContext::set($loja->empresa_id);

        $planilha = IOFactory::load($arquivo);
        $sheet = $planilha->sheetNameExists('Consulta NF-e') ? $planilha->getSheetByName('Consulta NF-e') : $planilha->getActiveSheet();
        $linhas = $sheet->toArray(null, true, true, true);

        $porNcm = [];
        $lendoDados = false;

        foreach ($linhas as $linha) {
            if (! $lendoDados) {
                if (trim((string) ($linha['A'] ?? '')) === 'CÓD. PROD.') {
                    $lendoDados = true;
                }

                continue;
            }

            $codigo = trim((string) ($linha['A'] ?? ''));
            $ncm = trim((string) ($linha['D'] ?? ''));
            if ($codigo === '' || $ncm === '') {
                continue;
            }

            $cfop = trim((string) ($linha['E'] ?? ''));
            $cst = str_pad(trim((string) ($linha['J'] ?? '')), 2, '0', STR_PAD_LEFT);
            $aliquota = (float) str_replace(',', '.', (string) ($linha['L'] ?? 0));
            $combo = "{$cfop}|{$cst}|{$aliquota}";

            $porNcm[$ncm]['combos'][$combo] = ($porNcm[$ncm]['combos'][$combo] ?? 0) + 1;
            $porNcm[$ncm]['produtos'][$codigo] = true;
        }

        $this->info(count($porNcm).' NCM(s) distinto(s) encontrado(s).');

        $dryRun = (bool) $this->option('dry-run');
        $gruposCriados = 0;
        $produtosVinculados = 0;
        $produtosNaoEncontrados = 0;

        foreach ($porNcm as $ncm => $info) {
            arsort($info['combos']);
            [$cfopDentro, $cst, $aliquota] = explode('|', array_key_first($info['combos']));
            $cfopFora = str_starts_with($cfopDentro, '5') ? '6'.substr($cfopDentro, 1) : $cfopDentro;
            $codigosProduto = array_keys($info['produtos']);

            if ($dryRun) {
                $this->line("[preview] NCM {$ncm} — CST {$cst} — alíq {$aliquota}% — CFOP {$cfopDentro}/{$cfopFora} — ".count($codigosProduto).' produto(s)');

                continue;
            }

            $grupo = GrupoFiscal::updateOrCreate(
                ['ncm' => $ncm],
                [
                    'nome' => "NCM {$ncm}",
                    'cfop_dentro_estado' => $cfopDentro,
                    'cfop_fora_estado' => $cfopFora,
                    'cst_icms' => $cst,
                    'aliquota_icms' => $aliquota,
                ],
            );
            $gruposCriados++;

            $atualizados = Produto::whereIn('codigo_interno', $codigosProduto)->update(['grupo_fiscal_id' => $grupo->id]);
            $produtosVinculados += $atualizados;
            $produtosNaoEncontrados += count($codigosProduto) - $atualizados;
        }

        if ($dryRun) {
            $this->info('Preview concluído — nada foi gravado (rode sem --dry-run pra gravar de verdade).');

            return self::SUCCESS;
        }

        $this->info("Concluído — {$gruposCriados} grupo(s) fiscal(is), {$produtosVinculados} produto(s) vinculado(s), {$produtosNaoEncontrados} produto(s) não encontrado(s) pelo código interno.");
        $this->warn('CST 00/10/20/40 (tributação normal) usa a MESMA alíquota vista na entrada como ponto de partida — pede revisão de contador antes de emitir nota de produção. CST 60 (substituição tributária) é seguro de reusar direto.');

        return self::SUCCESS;
    }
}
