<?php

namespace App\Services;

use App\Models\Loja;
use App\Models\NotaFiscalTerceiro;
use App\Models\NotaFiscalTerceiroItem;
use Illuminate\Support\Facades\Log;
use NFePHP\Common\Certificate;
use NFePHP\NFe\Common\Standardize;
use NFePHP\NFe\Tools;
use RuntimeException;
use SimpleXMLElement;
use Throwable;

/**
 * Consulta a Distribuição de DF-e da SEFAZ (mesmo certificado usado pra
 * emissão direta de NFC-e/NF-e, ver NfceService/NfeService) pra descobrir
 * notas fiscais que FORNECEDORES emitiram contra o CNPJ da loja/empresa —
 * o inverso do que o resto do sistema faz (emitir), aqui só lemos.
 *
 * Cobre NF-e/NFC-e/CT-e/MDF-e (documentos estaduais/federais). NFS-e (nota
 * de serviço) é municipal e não passa por esse webservice — não tem como
 * aparecer aqui.
 *
 * Fluxo por chamada de sincronizar():
 * 1. sefazDistDFe(ultNSU) devolve um lote de <docZip> — cada um é gzip+
 *    base64 de um XML menor, cujo tipo é indicado pelo atributo `schema`
 *    (schema começando com "resNFe" = resumo, "procNFe" ou "nfeProc" =
 *    documento completo já autorizado, "resEvento" = evento — ignorado
 *    por ora).
 * 2. Resumo novo vira uma linha `situacao=resumo` e, na sequência, tenta
 *    manifestar Ciência da Operação (passo mínimo pra liberar o XML
 *    completo em várias UFs) — falha de manifestação só é logada, não
 *    interrompe o resto do lote.
 * 3. Documento completo vira `situacao=completa`, guarda o XML e faz o
 *    parse dos itens (<det>) em notas_fiscais_terceiros_itens.
 * 4. loja.nfe_dist_ult_nsu avança pro maior NSU visto, pra próxima chamada
 *    partir dali (sem isso a SEFAZ manda tudo de novo desde o início).
 */
class DistribuicaoDfeService
{
    public function sincronizar(Loja $loja): array
    {
        $loja->loadMissing('empresa');
        $credenciais = $this->credenciais($loja);

        if (blank($credenciais['certificado']) || blank($credenciais['senha'])) {
            throw new RuntimeException('Loja não tem certificado digital configurado.');
        }

        $certificate = Certificate::readPfx($credenciais['certificado'], $credenciais['senha']);
        $tools = new Tools($this->configJson($loja, $credenciais), $certificate);

        $resumo = ['novas' => 0, 'atualizadas' => 0, 'erros' => 0];
        $ultNsu = (int) ($loja->nfe_dist_ult_nsu ?? 0);

        // A SEFAZ devolve no máximo um lote por chamada e sinaliza se ainda
        // há mais documentos além do lote atual — repete até esvaziar ou
        // até um limite de segurança pra nunca girar pra sempre num caso
        // inesperado de resposta mal formada.
        for ($tentativa = 0; $tentativa < 50; $tentativa++) {
            try {
                $respostaXml = $tools->sefazDistDFe($ultNsu);

                // sefazDistDFe() devolve o envelope SOAP inteiro, não só o
                // <retDistDFeInt> — Standardize::whichIs() acha esse nó em
                // qualquer profundidade (busca por getElementsByTagName, não
                // só na raiz) e extrai só ele via __toString(), removendo o
                // SOAP por cima. Dali pra frente usamos SimpleXMLElement
                // puro (não Standardize::toStd()) porque
                // json_encode(SimpleXMLElement) PERDE o texto de um nó
                // folha que também tem atributo — exatamente o caso de
                // <docZip NSU="..." schema="...">base64</docZip>.
                $extrator = new Standardize($respostaXml);
                $extrator->whichIs();
                $envelope = new SimpleXMLElement((string) $extrator);
            } catch (Throwable $e) {
                Log::error('Falha ao consultar Distribuição DFe', ['loja_id' => $loja->id, 'erro' => $e->getMessage()]);
                $resumo['erros']++;
                break;
            }

            $cStat = (string) $envelope->cStat;

            if ($cStat === '137') {
                // 137 = "Nenhum documento localizado" — não é erro, só não
                // tem nada novo desde o último NSU.
                break;
            }

            if ($cStat !== '138') {
                Log::error('Distribuição DFe: resposta inesperada da SEFAZ', [
                    'loja_id' => $loja->id,
                    'cStat' => $cStat,
                    'xMotivo' => (string) $envelope->xMotivo,
                ]);
                $resumo['erros']++;
                break;
            }

            $docs = $envelope->loteDistDFeInt->docZip ?? [];

            foreach ($docs as $doc) {
                $this->processarDocumento($loja, $tools, $doc, $resumo);
            }

            $novoUltNsu = (int) ((string) $envelope->ultNSU) ?: $ultNsu;
            $maxNsu = (int) ((string) $envelope->maxNSU) ?: $novoUltNsu;

            $ultNsu = max($ultNsu, $novoUltNsu);
            $loja->update(['nfe_dist_ult_nsu' => (string) $ultNsu]);

            if (count($docs) === 0 || $ultNsu >= $maxNsu) {
                break;
            }
        }

        return $resumo;
    }

    private function processarDocumento(Loja $loja, Tools $tools, SimpleXMLElement $doc, array &$resumo): void
    {
        $conteudo = $this->descompactar((string) $doc);
        $schema = (string) $doc['schema'];
        $nsu = (string) $doc['NSU'];

        if (str_starts_with($schema, 'resNFe')) {
            $this->salvarResumo($loja, $tools, $conteudo, $nsu, $resumo);
        } elseif (str_starts_with($schema, 'procNFe') || str_starts_with($schema, 'nfeProc')) {
            $this->salvarCompleta($loja, $conteudo, $resumo);
        }
        // resEvento_*/procEventoNFe_* (confirmação dos nossos próprios
        // eventos de manifestação) — nada a fazer, ignorado de propósito.
    }

    private function salvarResumo(Loja $loja, Tools $tools, string $xml, string $nsu, array &$resumo): void
    {
        $std = (new Standardize($xml))->toStd();
        $chave = (string) ($std->chNFe ?? '');
        if (blank($chave)) {
            return;
        }

        $nota = NotaFiscalTerceiro::where('chave_acesso', $chave)->first();
        $dados = [
            'loja_id' => $loja->id,
            'chave_acesso' => $chave,
            'nsu' => $nsu,
            'emitente_cnpj' => (string) ($std->CNPJ ?? $std->CPF ?? ''),
            'emitente_nome' => (string) ($std->xNome ?? ''),
            'valor_total' => (float) ($std->vNF ?? 0),
            'data_emissao' => (string) ($std->dhEmi ?? null),
        ];

        if ($nota) {
            $nota->update($dados);
            $resumo['atualizadas']++;
        } else {
            $nota = NotaFiscalTerceiro::create($dados + ['situacao' => 'resumo']);
            $resumo['novas']++;
        }

        if (! $nota->manifestada) {
            $this->manifestarCiencia($tools, $nota);
        }
    }

    private function manifestarCiencia(Tools $tools, NotaFiscalTerceiro $nota): void
    {
        try {
            $tools->sefazManifesta($nota->chave_acesso, Tools::EVT_CIENCIA);
            $nota->update(['manifestada' => true]);
        } catch (Throwable $e) {
            Log::error('Falha ao manifestar Ciência da Operação', [
                'nota_fiscal_terceiro_id' => $nota->id,
                'chave_acesso' => $nota->chave_acesso,
                'erro' => $e->getMessage(),
            ]);
        }
    }

    private function salvarCompleta(Loja $loja, string $xmlNfeProc, array &$resumo): void
    {
        $std = (new Standardize($xmlNfeProc))->toStd();
        $infNFe = $std->NFe->infNFe ?? $std->infNFe ?? null;
        // Id vem como atributo (<infNFe Id="NFe...">) — Standardize renomeia
        // "@attributes" pra "attributes" na hora de desserializar.
        $chave = $infNFe ? (string) str_replace('NFe', '', $infNFe->attributes->Id ?? '') : null;
        if (blank($chave)) {
            return;
        }

        $nota = NotaFiscalTerceiro::updateOrCreate(
            ['chave_acesso' => $chave],
            [
                'loja_id' => $loja->id,
                'situacao' => 'completa',
                'xml' => $xmlNfeProc,
                'emitente_cnpj' => (string) ($infNFe->emit->CNPJ ?? $infNFe->emit->CPF ?? ''),
                'emitente_nome' => (string) ($infNFe->emit->xNome ?? ''),
                'valor_total' => (float) ($infNFe->total->ICMSTot->vNF ?? 0),
                'data_emissao' => (string) ($infNFe->ide->dhEmi ?? null),
            ],
        );

        $itens = $infNFe->det ?? [];
        $itens = is_array($itens) ? $itens : [$itens];

        foreach ($itens as $det) {
            $prod = $det->prod ?? null;
            if (! $prod) {
                continue;
            }

            NotaFiscalTerceiroItem::updateOrCreate(
                ['nota_fiscal_terceiro_id' => $nota->id, 'codigo_produto_fornecedor' => (string) ($prod->cProd ?? '')],
                [
                    'ean' => (string) ($prod->cEAN ?? '') ?: null,
                    'descricao' => (string) ($prod->xProd ?? ''),
                    'ncm' => (string) ($prod->NCM ?? '') ?: null,
                    'cfop' => (string) ($prod->CFOP ?? '') ?: null,
                    'unidade' => (string) ($prod->uCom ?? '') ?: null,
                    'quantidade' => (float) ($prod->qCom ?? 0),
                    'valor_unitario' => (float) ($prod->vUnCom ?? 0),
                    'valor_total' => (float) ($prod->vProd ?? 0),
                ],
            );
        }

        $resumo['atualizadas']++;
    }

    /**
     * docZip vem gzip (zlib deflate) + base64 — gzuncompress (não gzdecode,
     * que espera o formato de arquivo .gz completo com cabeçalho) é o que
     * bate com o que a SEFAZ manda.
     */
    private function descompactar(string $base64): string
    {
        $binario = base64_decode($base64);
        $xml = @gzuncompress($binario);

        return $xml !== false ? $xml : $binario;
    }

    /**
     * Mesmo fallback loja→empresa já usado em NfceService/NfeService —
     * Distribuição DFe só precisa de certificado válido pro CNPJ
     * consultado, sem CSC/série (isso é exclusivo de NFC-e).
     */
    private function credenciais(Loja $loja): array
    {
        if ($loja->temCertificadoProprio()) {
            return [
                'certificado' => $loja->certificado,
                'senha' => $loja->certificado_senha,
                'ambiente' => $loja->nfe_ambiente ?? 'sandbox',
            ];
        }

        $empresa = $loja->empresa;

        return [
            'certificado' => $empresa?->certificado,
            'senha' => $empresa?->certificado_senha,
            'ambiente' => $loja->nfe_ambiente ?? $empresa?->nfe_ambiente ?? 'sandbox',
        ];
    }

    private function configJson(Loja $loja, array $credenciais): string
    {
        return json_encode([
            'tpAmb' => $credenciais['ambiente'] === 'producao' ? 1 : 2,
            'razaosocial' => $loja->razao_social ?? $loja->nome,
            'siglaUF' => $loja->uf,
            'cnpj' => $loja->cnpjEmissor(),
            'versao' => '4.00',
            'schemes' => 'PL_009_V4',
        ]);
    }
}
