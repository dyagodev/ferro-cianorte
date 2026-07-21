<?php

namespace App\Console\Commands;

use App\Models\Loja;
use App\Models\Produto;
use App\Support\TenantContext;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Throwable;

/**
 * Importa produtos a partir de um relatório "Consulta NF-e" (.xls) — não é
 * um catálogo limpo, é uma listagem de itens de nota fiscal de ENTRADA
 * num período (colunas: CÓD. PROD., DESCRIÇÃO PROD., EAN, NCM, CFOP, UND,
 * QTD COM., VLR UNIT., ORIGEM, CST, BC ICMS, ALIQ ICMS — sem preço de
 * venda). Cada produto pode aparecer em mais de uma linha (uma por nota
 * onde foi comprado); fica o VLR UNIT. da ÚLTIMA ocorrência no arquivo
 * (assume que o relatório vem ordenado cronologicamente, como todo
 * "Consulta NF-e" desses sistemas de PDV).
 *
 * Não mexe em estoque: QTD COM. é quantidade COMPRADA numa nota, não
 * estoque atual — tratar como estoque inflaria o número (parte já foi
 * vendida). Produto entra com preco_venda = preco_custo (sem margem, dado
 * não disponível nessa planilha) — precisa ajustar depois na tela de
 * produtos.
 */
#[Signature('app:importar-produtos-nfe-planilha {arquivo : Caminho do .xls} {loja_id : Loja dona do catálogo} {--dry-run : Só mostra o que faria, não grava nada}')]
#[Description('Importa produtos a partir de um relatório "Consulta NF-e" (.xls) exportado do sistema de PDV do cliente')]
class ImportarProdutosPlanilhaNfe extends Command
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

        $porCodigo = [];
        $lendoDados = false;

        foreach ($linhas as $linha) {
            if (! $lendoDados) {
                if (trim((string) ($linha['A'] ?? '')) === 'CÓD. PROD.') {
                    $lendoDados = true;
                }

                continue;
            }

            $codigo = trim((string) ($linha['A'] ?? ''));
            if ($codigo === '') {
                continue;
            }

            // Sobrescreve de propósito — última ocorrência no arquivo
            // vence (ver docblock da classe).
            $porCodigo[$codigo] = $linha;
        }

        $this->info(count($porCodigo).' produto(s) único(s) encontrado(s) na planilha.');

        $dryRun = (bool) $this->option('dry-run');
        $criados = 0;
        $atualizados = 0;
        $ignorados = 0;
        $falhas = [];

        foreach ($porCodigo as $codigo => $linha) {
            $descricao = trim((string) ($linha['B'] ?? ''));
            if ($descricao === '') {
                $ignorados++;

                continue;
            }

            $ean = trim((string) ($linha['C'] ?? ''));
            // "SEM GTIN" é texto da própria planilha (sem código de barras
            // de verdade) — não é dígito nenhum, ctype_digit já filtra isso
            // e qualquer outro texto não numérico junto.
            if (! ctype_digit($ean)) {
                $ean = '';
            }
            $unidade = trim((string) ($linha['F'] ?? '')) ?: 'UN';
            $custo = (float) str_replace(',', '.', (string) ($linha['H'] ?? 0));

            if ($dryRun) {
                $this->line("[preview] {$codigo} — {$descricao} — R$ {$custo}".($ean !== '' ? " — EAN {$ean}" : ''));

                continue;
            }

            $dadosProduto = [
                'descricao' => $descricao,
                'codigo_barras' => $ean !== '' ? $ean : null,
                'unidade' => $unidade,
                'preco_custo' => $custo,
                'preco_venda' => $custo,
                'ativo' => true,
            ];

            try {
                $produto = Produto::updateOrCreate(['codigo_interno' => (string) $codigo], $dadosProduto);
                $produto->wasRecentlyCreated ? $criados++ : $atualizados++;
            } catch (Throwable $e) {
                // Mesmo EAN em mais de um código interno dentro da MESMA
                // empresa (visto na prática: "PROMOCIONAL" reaproveitando o
                // código de barras do fabricante do produto normal) —
                // codigo_interno é o que identifica o produto aqui dentro,
                // então tenta de novo sem o código de barras em vez de
                // descartar o produto inteiro.
                if (str_contains($e->getMessage(), 'codigo_barras')) {
                    try {
                        $dadosProduto['codigo_barras'] = null;
                        $produto = Produto::updateOrCreate(['codigo_interno' => (string) $codigo], $dadosProduto);
                        $produto->wasRecentlyCreated ? $criados++ : $atualizados++;
                        $this->warn("{$codigo} ({$descricao}): EAN duplicado dentro da mesma empresa, salvo sem código de barras.");

                        continue;
                    } catch (Throwable $e2) {
                        $e = $e2;
                    }
                }

                $ignorados++;
                $falhas[] = "{$codigo} ({$descricao}): {$e->getMessage()}";
            }
        }

        if ($dryRun) {
            $this->info('Preview concluído — nada foi gravado (rode sem --dry-run pra gravar de verdade).');

            return self::SUCCESS;
        }

        $this->info("Importação concluída — {$criados} criado(s), {$atualizados} atualizado(s), {$ignorados} ignorado(s).");

        foreach ($falhas as $falha) {
            $this->warn($falha);
        }

        return self::SUCCESS;
    }
}
