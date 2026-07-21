<?php

namespace App\Services;

use App\Models\Loja;
use App\Models\NotaFiscal;
use App\Models\Venda;
use App\Services\Concerns\MontaImpostosNotaFiscal;
use NFePHP\Common\Certificate;
use NFePHP\Common\UFList;
use NFePHP\NFe\Common\Standardize;
use NFePHP\DA\NFe\Danfce;
use NFePHP\NFe\Complements;
use NFePHP\NFe\Make;
use NFePHP\NFe\Tools;
use RuntimeException;
use stdClass;
use Throwable;

/**
 * Emissão de NFC-e (modelo 65) direto na SEFAZ via nfephp-org/sped-nfe —
 * alternativa à Spedy pra quem não quer pagar por documento (ver
 * Loja::emissao_fiscal_modo). Mesmo princípio do MDF-e: certificado A1
 * fica guardado (criptografado) na Loja, é usado localmente pra assinar,
 * sem gateway no meio.
 *
 * ESCOPO ATUAL:
 * - Só os casos mais comuns de tributação foram implementados e verificados
 *   contra o XSD oficial:
 *     ICMS: CSOSN 101/102/103/300/400 (Simples Nacional) e CST 00/40/41/50
 *     (regime normal) — outros códigos caem num fallback best-effort
 *     (comentado abaixo) que NÃO foi testado contra casos reais.
 *     PIS/COFINS: CST 01/02 (com alíquota) e 04-09 (isenta/não tributada).
 * - IBS/CBS (Reforma Tributária, NT 2025.002): só emitido pra Regime Normal
 *   (CRT=3), que é quem tem corte de produção em 03/08/2026 — Simples
 *   Nacional (CRT=1) só entra em produção em 04/01/2027, então por ora
 *   segue sem esse grupo. Dentro do Regime Normal, só o CST 000 (tributação
 *   integral) calcula valor de verdade, usando as alíquotas de teste
 *   nacionais de 2026 (0,9% CBS + 0,05% IBS-UF + 0,05% IBS-Mun, apuração
 *   informativa) — outros CST (isenção, monofásico etc.) emitem só
 *   CST+cClassTrib sem o grupo de valores, não testado contra caso real.
 *   (A montagem em si é compartilhada com NfeService, ver
 *   Concerns\MontaImpostosNotaFiscal.)
 * - Sem contingência (SEFAZ fora do ar) — se a SEFAZ não responder, a nota
 *   fica "rejeitada" com o erro, sem fallback offline.
 * - Sem carta de correção ainda (cancelamento via evento já existe, ver
 *   cancelar()).
 *
 * IMPORTANTE: nomes de campo verificados direto no código fonte
 * (vendor/nfephp-org/sped-nfe/src/Traits/*.php), não adivinhados — mas o
 * fluxo completo só pode ser validado de ponta a ponta com certificado e
 * ambiente de homologação de verdade.
 */
class NfceService
{
    use MontaImpostosNotaFiscal;

    private const MAPA_FORMA_PAGAMENTO = [
        'dinheiro' => '01',
        'cheque' => '02',
        'cartao' => '03',
        'cartao_debito' => '04',
        'boleto' => '15',
        'pix' => '17',
        'crediario' => '99',
        'a_prazo' => '99',
        'outros' => '99',
    ];

    public function emitir(Venda $venda): NotaFiscal
    {
        $loja = $venda->loja;
        $loja->loadMissing('empresa');

        if (! $loja->possuiNfceConfigurado()) {
            throw new RuntimeException('Loja não tem certificado/CSC de NFC-e configurado pra emissão direta.');
        }

        $venda->loadMissing(['itens.produto.grupoFiscal', 'pagamentos', 'cliente', 'loja.empresa']);

        $crt = $this->crt($loja);
        $credenciais = $this->credenciais($loja);
        $make = $this->montar($venda, $loja, $credenciais, $crt);

        try {
            $xml = $make->getXML();
        } catch (Throwable $e) {
            throw new RuntimeException('Erro ao montar XML da NFC-e: '.$e->getMessage().' | '.implode('; ', $make->getErrors()));
        }

        $certificate = Certificate::readPfx($credenciais['certificado'], $credenciais['senha']);
        $tools = new Tools($this->configJson($loja, $credenciais, $crt), $certificate);
        // Tools atende NF-e (55) e NFC-e (65) — sem isso ele assume 55 por
        // padrão e rejeita nosso XML (mod=65) como "modelo incorreto".
        $tools->model(65);

        try {
            $signedXml = $tools->signNFe($xml);
        } catch (Throwable $e) {
            return $this->salvarNota($venda, [
                'status' => 'rejected',
                'chave_acesso' => $make->getChave(),
                'xml_gerado' => $xml,
                'mensagem_retorno' => 'Erro ao assinar/validar XML: '.$e->getMessage(),
            ]);
        }

        try {
            $resposta = $tools->sefazEnviaLote([$signedXml], (string) $venda->id, indSinc: 1);
        } catch (Throwable $e) {
            return $this->salvarNota($venda, [
                'status' => 'rejected',
                'chave_acesso' => $make->getChave(),
                'xml_gerado' => $signedXml,
                'mensagem_retorno' => 'Falha na comunicação com a SEFAZ: '.$e->getMessage(),
            ]);
        }

        return $this->processarResposta($venda, $make->getChave(), $signedXml, $resposta);
    }

    private function processarResposta(Venda $venda, string $chave, string $xml, string $respostaXml): NotaFiscal
    {
        $std = (new Standardize($respostaXml))->toStd();

        // Envio síncrono devolve o protocolo direto — mesmo padrão do MDF-e.
        $infProt = $std->protNFe->infProt ?? null;

        if ($infProt) {
            $autorizada = ($infProt->cStat ?? null) == '100';

            // "nfeProc" = XML assinado + protocolo da SEFAZ grudados num só
            // documento — é o formato padrão do "autorizado", e o que o
            // gerador de DANFE (Danfce::class) exige pra funcionar (ele lê
            // o <infProt> de dentro do nfeProc pra imprimir protocolo/data).
            $xmlProtocolado = $autorizada ? Complements::toAuthorize($xml, $respostaXml) : $xml;

            return $this->salvarNota($venda, [
                'status' => $autorizada ? 'authorized' : 'rejected',
                'chave_acesso' => $infProt->chNFe ?? $chave,
                'numero' => $infProt->nProt ?? null,
                'codigo_retorno' => $infProt->cStat ?? null,
                'mensagem_retorno' => $infProt->xMotivo ?? null,
                'xml_gerado' => $xmlProtocolado,
                'url_danfe' => $autorizada ? $this->extrairUrlConsulta($xml) : null,
                'resposta_bruta' => json_decode(json_encode($std), true),
            ]);
        }

        return $this->salvarNota($venda, [
            'status' => 'rejected',
            'chave_acesso' => $chave,
            'codigo_retorno' => $std->cStat ?? null,
            'mensagem_retorno' => $std->xMotivo ?? 'Resposta da SEFAZ em formato inesperado.',
            'xml_gerado' => $xml,
            'resposta_bruta' => json_decode(json_encode($std), true),
        ]);
    }

    /**
     * O XML assinado traz <qrCode> com a URL de consulta oficial da SEFAZ
     * pra essa nota (é o mesmo QR Code que iria impresso no cupom) —
     * extrai daqui em vez de remontar na mão, evita duplicar a lógica de
     * geração de hash que já está dentro do XML.
     */
    private function extrairUrlConsulta(string $xml): ?string
    {
        if (preg_match('/<qrCode>(.*?)<\/qrCode>/', $xml, $matches)) {
            return html_entity_decode($matches[1]);
        }

        return null;
    }

    /**
     * Cancelamento de verdade na SEFAZ (evento, não é só apagar/marcar
     * aqui) — a nota continua existindo, só muda de status. SEFAZ exige
     * justificativa com pelo menos 15 caracteres e normalmente só aceita
     * cancelar dentro de uma janela de tempo depois da autorização (varia
     * por estado, costuma ser algo entre 30min e 24h pra NFC-e) — se
     * passou do prazo, a SEFAZ rejeita e a mensagem de erro dela explica.
     */
    public function cancelar(NotaFiscal $nota, string $justificativa): NotaFiscal
    {
        if (! $nota->autorizada()) {
            throw new RuntimeException('Só é possível cancelar uma NFC-e autorizada.');
        }

        $venda = $nota->venda;
        $venda->loadMissing('loja.empresa');
        $loja = $venda->loja;

        $credenciais = $this->credenciais($loja);
        $certificate = Certificate::readPfx($credenciais['certificado'], $credenciais['senha']);
        $tools = new Tools($this->configJson($loja, $credenciais, $this->crt($loja)), $certificate);
        $tools->model(65);

        $resposta = $tools->sefazCancela($nota->chave_acesso, $justificativa, $nota->numero);
        $std = (new Standardize($resposta))->toStd();

        $infEvento = $std->retEvento->infEvento ?? $std->infEvento ?? null;
        $cStat = $infEvento->cStat ?? $std->cStat ?? null;
        // 135 = evento registrado e vinculado à NFC-e (cancelamento aceito).
        $cancelado = $cStat == '135';

        if (! $cancelado) {
            throw new RuntimeException('SEFAZ recusou o cancelamento: '.($infEvento->xMotivo ?? $std->xMotivo ?? 'motivo não informado').' (código '.$cStat.')');
        }

        $nota->update([
            'status' => 'canceled',
            'codigo_retorno' => $cStat,
            'mensagem_retorno' => $infEvento->xMotivo ?? $std->xMotivo ?? 'Cancelamento registrado.',
            'resposta_bruta' => json_decode(json_encode($std), true),
        ]);

        return $nota;
    }

    /**
     * Gera o PDF do cupom (DANFE NFC-e, formato 80mm de bobina) a partir do
     * XML protocolado — ver nfephp-org/sped-da. Só funciona pra nota
     * autorizada (xml_gerado só vira "nfeProc" completo nesse caso, ver
     * processarResposta).
     */
    public function gerarDanfe(NotaFiscal $nota): string
    {
        if (! $nota->autorizada() || blank($nota->xml_gerado)) {
            throw new RuntimeException('Só é possível gerar o DANFE de uma NFC-e autorizada.');
        }

        $danfce = new Danfce($nota->xml_gerado);

        return $danfce->render();
    }

    private function salvarNota(Venda $venda, array $dados): NotaFiscal
    {
        return NotaFiscal::updateOrCreate(
            ['venda_id' => $venda->id, 'tipo' => 'nfce'],
            $dados,
        );
    }

    /**
     * Config própria da loja tem prioridade; sem ela (e só quando a loja
     * usa o mesmo CNPJ da empresa — ver Loja::usaMesmoCnpjDaEmpresa), cai
     * pra config da empresa. Uma loja com CNPJ próprio diferente nunca cai
     * aqui, ela é obrigada a ter certificado/CSC dela mesma.
     */
    private function credenciais(Loja $loja): array
    {
        if ($loja->temNfceProprio()) {
            return [
                'certificado' => $loja->certificado,
                'senha' => $loja->certificado_senha,
                'ambiente' => $loja->nfce_ambiente ?? 'sandbox',
                'csc' => $loja->nfce_csc,
                'cscId' => $loja->nfce_csc_id,
                'serie' => $loja->nfce_serie ?? '1',
            ];
        }

        $empresa = $loja->empresa;

        return [
            'certificado' => $empresa?->certificado,
            'senha' => $empresa?->certificado_senha,
            'ambiente' => $loja->nfce_ambiente ?? $empresa?->nfce_ambiente ?? 'sandbox',
            'csc' => $empresa?->nfce_csc,
            'cscId' => $empresa?->nfce_csc_id,
            'serie' => $loja->nfce_serie ?? $empresa?->nfce_serie ?? '1',
        ];
    }

    private function configJson(Loja $loja, array $credenciais, string $crt): string
    {
        return json_encode([
            'tpAmb' => $credenciais['ambiente'] === 'producao' ? 1 : 2,
            'razaosocial' => $loja->razao_social ?? $loja->nome,
            'siglaUF' => $loja->uf,
            'cnpj' => $loja->cnpjEmissor(),
            'versao' => '4.00',
            // Exigido pela validação do config.json mesmo sendo sobrescrito
            // internamente a partir de "versao" (ver Tools::version) — sem
            // isso a Config::validate() já rejeita antes de chegar lá. O
            // pacote de schemas PL_010_V1.30 é quem tem o XSD com o grupo
            // IBS/CBS (NT 2025.002) — PL_009_V4 (o que sempre usamos, já
            // validado contra SEFAZ de verdade) não tem esse grupo, então
            // só troca pra Regime Normal (CRT=3).
            'schemes' => $crt === '3' ? 'PL_010_V1.30' : 'PL_009_V4',
            'CSC' => $credenciais['csc'],
            'CSCid' => $credenciais['cscId'],
        ]);
    }

    private function montar(Venda $venda, Loja $loja, array $credenciais, string $crt): Make
    {
        // Make aceita o "schema" (pacote de XSD/regras) no construtor — sem
        // isso ele assume PL_009 (schema=9) por padrão e nunca monta o
        // grupo <IBSCBS>, mesmo se a gente chamar tagIBSCBS() (ver
        // Make::montaNFe, "somente para PL_010 em diante"). Tem que bater
        // com o "schemes" usado no config.json do Tools (ver configJson).
        $make = new Make($crt === '3' ? 'PL_010_V1.30' : null);

        $ide = new stdClass;
        $ide->cUF = UFList::getCodeByUF($loja->uf);
        $ide->natOp = 'Venda';
        $ide->mod = '65';
        $ide->serie = $credenciais['serie'];
        $ide->nNF = $venda->id;
        $ide->dhEmi = now()->format('Y-m-d\TH:i:sP');
        $ide->tpNF = 1;
        $ide->idDest = 1;
        $ide->cMunFG = $loja->codigo_municipio;
        $ide->tpImp = 4;
        $ide->tpEmis = 1;
        $ide->tpAmb = $credenciais['ambiente'] === 'producao' ? 1 : 2;
        $ide->finNFe = 1;
        $ide->indFinal = 1;
        $ide->indPres = 1;
        // Obrigatório pela SEFAZ (rejeição 434 sem isso, mesmo sendo
        // "false"/opcional no XSD) — 0 = venda sem intermediador/marketplace,
        // sempre o caso aqui (venda direta no PDV, não passa por plataforma
        // terceira).
        $ide->indIntermed = 0;
        $ide->procEmi = 0;
        $ide->verProc = '1.0.0';
        $make->tagide($ide);

        $emit = new stdClass;
        $emit->CNPJ = $loja->cnpjEmissor();
        $emit->xNome = $loja->razao_social ?? $loja->nome;
        $emit->xFant = $loja->nome;
        $emit->IE = $loja->inscricao_estadual;
        $emit->CRT = $crt;
        $make->tagEmit($emit);

        $ender = new stdClass;
        $ender->xLgr = $loja->logradouro;
        $ender->nro = $loja->numero;
        $ender->xCpl = $loja->complemento;
        $ender->xBairro = $loja->bairro;
        $ender->cMun = $loja->codigo_municipio;
        $ender->xMun = $loja->cidade;
        $ender->UF = $loja->uf;
        $ender->CEP = preg_replace('/\D/', '', (string) $loja->cep);
        $make->tagenderEmit($ender);

        $vBcIcmsTotal = 0.0;
        $vIcmsTotal = 0.0;
        $vPisTotal = 0.0;
        $vCofinsTotal = 0.0;

        foreach ($venda->itens as $indice => $item) {
            $nItem = $indice + 1;
            $grupo = $item->produto?->grupoFiscal;
            $totalItem = (float) $item->total;

            $prod = new stdClass;
            $prod->item = $nItem;
            $prod->cProd = $item->produto?->codigo_interno ?? (string) $item->produto_id;
            $prod->cEAN = $item->produto?->codigo_barras ?: 'SEM GTIN';
            $prod->xProd = $item->produto?->descricao;
            $prod->NCM = $grupo?->ncm ?? '00000000';
            $prod->CFOP = $grupo?->cfop_dentro_estado ?? '5102';
            $prod->uCom = $item->produto?->unidade ?? 'UN';
            $prod->qCom = (float) $item->quantidade;
            $prod->vUnCom = (float) $item->preco_unitario;
            $prod->vProd = $totalItem;
            $prod->cEANTrib = $prod->cEAN;
            $prod->uTrib = $prod->uCom;
            $prod->qTrib = $prod->qCom;
            $prod->vUnTrib = $prod->vUnCom;
            $prod->indTot = 1;
            $make->tagprod($prod);

            $imposto = new stdClass;
            $imposto->item = $nItem;
            $make->tagimposto($imposto);

            [$icms, $vBcIcmsItem, $vIcmsItem] = $this->montarIcms($nItem, $grupo, $crt, $totalItem);
            if ($crt === '1') {
                $make->tagICMSSN($icms);
            } else {
                $make->tagICMS($icms);
            }
            $vBcIcmsTotal += $vBcIcmsItem;
            $vIcmsTotal += $vIcmsItem;

            [$pis, $vPisItem] = $this->montarPis($nItem, $grupo, $totalItem);
            $make->tagPIS($pis);
            $vPisTotal += $vPisItem;

            [$cofins, $vCofinsItem] = $this->montarCofins($nItem, $grupo, $totalItem);
            $make->tagCOFINS($cofins);
            $vCofinsTotal += $vCofinsItem;

            // IBS/CBS só pra Regime Normal por enquanto — ver ESCOPO ATUAL
            // na doc da classe.
            if ($crt === '3') {
                $make->tagIBSCBS($this->montarIbsCbs($nItem, $grupo, $totalItem));
            }
        }

        $subtotal = (float) $venda->subtotal;
        $desconto = (float) $venda->desconto;
        $total = (float) $venda->total;

        $icmsTot = new stdClass;
        $icmsTot->vBC = $vBcIcmsTotal;
        $icmsTot->vICMS = $vIcmsTotal;
        $icmsTot->vICMSDeson = 0;
        $icmsTot->vBCST = 0;
        $icmsTot->vST = 0;
        $icmsTot->vProd = $subtotal;
        $icmsTot->vFrete = 0;
        $icmsTot->vSeg = 0;
        $icmsTot->vDesc = $desconto;
        $icmsTot->vII = 0;
        $icmsTot->vIPI = 0;
        $icmsTot->vPIS = $vPisTotal;
        $icmsTot->vCOFINS = $vCofinsTotal;
        $icmsTot->vOutro = 0;
        $icmsTot->vNF = $total;
        $make->tagICMSTot($icmsTot);

        if ($crt === '3') {
            // Sem parâmetro: tagIBSCBS() já acumulou os totais internamente
            // (Make::$stdIBSCBSTot) a cada chamada por item, tagIBSCBSTot()
            // usa esse acumulado quando o std passado vem vazio.
            $make->tagIBSCBSTot(new stdClass);
        }

        $transp = new stdClass;
        $transp->modFrete = 9;
        $make->tagtransp($transp);

        $pagTotal = 0.0;
        foreach ($venda->pagamentos as $pagamento) {
            $detPag = new stdClass;
            $detPag->tPag = self::MAPA_FORMA_PAGAMENTO[$pagamento->forma_pagamento] ?? '99';
            $detPag->vPag = (float) $pagamento->valor;
            $make->tagdetPag($detPag);
            $pagTotal += (float) $pagamento->valor;
        }
        $pag = new stdClass;
        $pag->vTroco = max(0, $pagTotal - $total);
        $make->tagpag($pag);

        $infNFe = new stdClass;
        $infNFe->versao = '4.00';
        $make->taginfNFe($infNFe);

        return $make;
    }
}
