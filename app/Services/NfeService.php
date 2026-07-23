<?php

namespace App\Services;

use App\Models\Loja;
use App\Models\NotaFiscal;
use App\Models\TransferenciaEstoque;
use App\Models\Venda;
use App\Services\Concerns\MontaImpostosNotaFiscal;
use NFePHP\Common\Certificate;
use NFePHP\Common\UFList;
use NFePHP\NFe\Common\Standardize;
use NFePHP\DA\NFe\Danfe;
use NFePHP\NFe\Complements;
use NFePHP\NFe\Make;
use NFePHP\NFe\Tools;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use stdClass;
use Throwable;

/**
 * Emissão de NF-e (modelo 55, venda de atacado/revenda pra outro CNPJ)
 * direto na SEFAZ via nfephp-org/sped-nfe — mesmo princípio da NFC-e
 * (NfceService), inclusive reaproveitando a mesma montagem de
 * ICMS/PIS/COFINS/IBS-CBS (ver Concerns\MontaImpostosNotaFiscal). Config
 * (certificado, ambiente, série) é independente da NFC-e — ver
 * Loja::emiteNfceDireto/temNfeProprio — mas segue o mesmo toggle
 * emissao_fiscal_modo ('spedy'|'direta') por loja.
 *
 * ESCOPO ATUAL (além das limitações já documentadas em NfceService pra
 * ICMS/PIS/COFINS/IBS-CBS, que se aplicam igual aqui):
 * - indFinal deriva de o cliente ter IE ou não (ver $clienteEhContribuinte
 *   em montar()): sem IE, a SEFAZ exige indFinal=1 (consumidor final) —
 *   rejeita com "não contribuinte deve indicar consumidor final" senão,
 *   mesmo sendo uma venda de atacado/revenda. indPres fixo em 9 (não
 *   presencial, outros) — não dá pra saber se foi balcão ou por telefone/
 *   pedido, então usamos o valor mais neutro.
 * - CFOP escolhido comparando UF da loja com UF do cliente (dentro/fora do
 *   estado) — mesma lógica já usada no SpedyService::emitirNfe.
 * - Não temos DANFE em modo "contingência" nem carta de correção.
 */
class NfeService
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

        if (! $loja->possuiNfeConfigurado()) {
            throw new RuntimeException('Loja não tem certificado de NF-e configurado pra emissão direta.');
        }

        $venda->loadMissing(['itens.produto.grupoFiscal', 'pagamentos', 'cliente', 'loja.empresa']);

        $cliente = $venda->cliente;
        if (! $cliente || ! $cliente->possuiEnderecoCompletoParaNfe()) {
            throw new RuntimeException('Cliente sem CNPJ/endereço completo cadastrado — obrigatório para emitir NF-e.');
        }

        $crt = $this->crt($loja);
        $credenciais = $this->credenciais($loja);
        // Aloca o número antes de montar o XML — trava/incrementa numa
        // transação curta, separada da chamada pra SEFAZ (chamada HTTP
        // externa não deve segurar lock de DB, mesmo padrão do resto do
        // sistema).
        $numero = $this->proximoNumeroNfe($loja);
        $make = $this->montar($venda, $loja, $cliente, $credenciais, $crt, $numero);

        try {
            $xml = $make->getXML();
        } catch (Throwable $e) {
            throw new RuntimeException('Erro ao montar XML da NF-e: '.$e->getMessage().' | '.implode('; ', $make->getErrors()));
        }

        $certificate = Certificate::readPfx($credenciais['certificado'], $credenciais['senha']);
        $tools = new Tools($this->configJson($loja, $credenciais, $crt), $certificate);
        $tools->model(55);

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

    /**
     * NF-e de transferência de mercadoria entre lojas da MESMA empresa
     * (natOp "Transferência", CFOP 5152/6152) — usada por
     * TransferenciaEstoqueService, não passa pelo carrinho do PDV nem tem
     * Venda por trás (destinatário é a loja de destino, não um Cliente).
     */
    public function emitirTransferencia(TransferenciaEstoque $transferencia): NotaFiscal
    {
        $lojaOrigem = $transferencia->lojaOrigem;
        $lojaOrigem->loadMissing('empresa');
        $lojaDestino = $transferencia->lojaDestino;

        if (! $lojaOrigem->possuiNfeConfigurado()) {
            throw new RuntimeException('Loja de origem não tem certificado de NF-e configurado pra emissão direta.');
        }

        $transferencia->loadMissing(['itens.produto.grupoFiscal']);
        if ($transferencia->itens->isEmpty()) {
            throw new RuntimeException('Transferência sem itens — adicione ao menos um produto antes de emitir.');
        }

        $crt = $this->crt($lojaOrigem);
        $credenciais = $this->credenciais($lojaOrigem);
        $numero = $this->proximoNumeroNfe($lojaOrigem);
        $make = $this->montarTransferencia($transferencia, $lojaOrigem, $lojaDestino, $credenciais, $crt, $numero);

        try {
            $xml = $make->getXML();
        } catch (Throwable $e) {
            throw new RuntimeException('Erro ao montar XML da NF-e de transferência: '.$e->getMessage().' | '.implode('; ', $make->getErrors()));
        }

        $certificate = Certificate::readPfx($credenciais['certificado'], $credenciais['senha']);
        $tools = new Tools($this->configJson($lojaOrigem, $credenciais, $crt), $certificate);
        $tools->model(55);

        try {
            $signedXml = $tools->signNFe($xml);
        } catch (Throwable $e) {
            return $this->salvarNotaTransferencia($transferencia, [
                'status' => 'rejected',
                'chave_acesso' => $make->getChave(),
                'xml_gerado' => $xml,
                'mensagem_retorno' => 'Erro ao assinar/validar XML: '.$e->getMessage(),
            ]);
        }

        try {
            $resposta = $tools->sefazEnviaLote([$signedXml], 'transf-'.$transferencia->id, indSinc: 1);
        } catch (Throwable $e) {
            return $this->salvarNotaTransferencia($transferencia, [
                'status' => 'rejected',
                'chave_acesso' => $make->getChave(),
                'xml_gerado' => $signedXml,
                'mensagem_retorno' => 'Falha na comunicação com a SEFAZ: '.$e->getMessage(),
            ]);
        }

        return $this->processarRespostaTransferencia($transferencia, $make->getChave(), $signedXml, $resposta);
    }

    private function processarResposta(Venda $venda, string $chave, string $xml, string $respostaXml): NotaFiscal
    {
        $std = (new Standardize($respostaXml))->toStd();

        $infProt = $std->protNFe->infProt ?? null;

        if ($infProt) {
            $autorizada = ($infProt->cStat ?? null) == '100';

            // "nfeProc" = XML assinado + protocolo da SEFAZ grudados — é o
            // que o gerador de DANFE (Danfe::class) precisa pra imprimir
            // protocolo/data de autorização.
            $xmlProtocolado = $autorizada ? Complements::toAuthorize($xml, $respostaXml) : $xml;

            return $this->salvarNota($venda, [
                'status' => $autorizada ? 'authorized' : 'rejected',
                'chave_acesso' => $infProt->chNFe ?? $chave,
                'numero' => $infProt->nProt ?? null,
                'codigo_retorno' => $infProt->cStat ?? null,
                'mensagem_retorno' => $infProt->xMotivo ?? null,
                'xml_gerado' => $xmlProtocolado,
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

    private function processarRespostaTransferencia(TransferenciaEstoque $transferencia, string $chave, string $xml, string $respostaXml): NotaFiscal
    {
        $std = (new Standardize($respostaXml))->toStd();

        $infProt = $std->protNFe->infProt ?? null;

        if ($infProt) {
            $autorizada = ($infProt->cStat ?? null) == '100';
            $xmlProtocolado = $autorizada ? Complements::toAuthorize($xml, $respostaXml) : $xml;

            return $this->salvarNotaTransferencia($transferencia, [
                'status' => $autorizada ? 'authorized' : 'rejected',
                'chave_acesso' => $infProt->chNFe ?? $chave,
                'numero' => $infProt->nProt ?? null,
                'codigo_retorno' => $infProt->cStat ?? null,
                'mensagem_retorno' => $infProt->xMotivo ?? null,
                'xml_gerado' => $xmlProtocolado,
                'resposta_bruta' => json_decode(json_encode($std), true),
            ]);
        }

        return $this->salvarNotaTransferencia($transferencia, [
            'status' => 'rejected',
            'chave_acesso' => $chave,
            'codigo_retorno' => $std->cStat ?? null,
            'mensagem_retorno' => $std->xMotivo ?? 'Resposta da SEFAZ em formato inesperado.',
            'xml_gerado' => $xml,
            'resposta_bruta' => json_decode(json_encode($std), true),
        ]);
    }

    private function salvarNotaTransferencia(TransferenciaEstoque $transferencia, array $dados): NotaFiscal
    {
        return NotaFiscal::updateOrCreate(
            ['transferencia_estoque_id' => $transferencia->id, 'tipo' => 'nfe'],
            $dados,
        );
    }

    /**
     * Trava a linha da loja pra alocar o próximo número sem risco de duas
     * emissões simultâneas pegarem o mesmo — numa transação curta e
     * separada da chamada pra SEFAZ (chamada HTTP externa não deve segurar
     * lock de DB). Mesmo padrão já usado pra mdfe_proximo_numero/
     * nfce_proximo_numero.
     */
    private function proximoNumeroNfe(Loja $loja): int
    {
        return DB::transaction(function () use ($loja) {
            $lojaTravada = Loja::whereKey($loja->id)->lockForUpdate()->first();
            $numero = $lojaTravada->nfe_proximo_numero;
            $lojaTravada->increment('nfe_proximo_numero');

            return $numero;
        });
    }

    /**
     * Mesmo princípio do NfceService::cancelar — evento de verdade na
     * SEFAZ, a nota continua existindo, só muda de status. Nota pode ser de
     * venda-atacado (tem Venda) ou de transferência (tem
     * TransferenciaEstoque) — a loja emissora vem de qualquer um dos dois
     * que estiver preenchido.
     */
    public function cancelar(NotaFiscal $nota, string $justificativa): NotaFiscal
    {
        if (! $nota->autorizada()) {
            throw new RuntimeException('Só é possível cancelar uma NF-e autorizada.');
        }

        $nota->loadMissing(['venda.loja.empresa', 'transferenciaEstoque.lojaOrigem.empresa']);
        $loja = $nota->venda?->loja ?? $nota->transferenciaEstoque?->lojaOrigem;

        $credenciais = $this->credenciais($loja);
        $certificate = Certificate::readPfx($credenciais['certificado'], $credenciais['senha']);
        $tools = new Tools($this->configJson($loja, $credenciais, $this->crt($loja)), $certificate);
        $tools->model(55);

        $resposta = $tools->sefazCancela($nota->chave_acesso, $justificativa, $nota->numero);
        $std = (new Standardize($resposta))->toStd();

        $infEvento = $std->retEvento->infEvento ?? $std->infEvento ?? null;
        $cStat = $infEvento->cStat ?? $std->cStat ?? null;
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
     * Gera o PDF do DANFE (formato retrato A4, diferente do cupom 80mm da
     * NFC-e) a partir do XML protocolado — ver nfephp-org/sped-da.
     */
    public function gerarDanfe(NotaFiscal $nota): string
    {
        if (! $nota->autorizada() || blank($nota->xml_gerado)) {
            throw new RuntimeException('Só é possível gerar o DANFE de uma NF-e autorizada.');
        }

        $danfe = new Danfe($nota->xml_gerado);

        return $danfe->render();
    }

    private function salvarNota(Venda $venda, array $dados): NotaFiscal
    {
        return NotaFiscal::updateOrCreate(
            ['venda_id' => $venda->id, 'tipo' => 'nfe'],
            $dados,
        );
    }

    /**
     * Mesmo padrão de fallback do NfceService::credenciais — config própria
     * da loja tem prioridade, senão cai pra empresa (só quando usa o mesmo
     * CNPJ). NF-e não usa CSC/CSCid (isso é exclusivo do QR Code da NFC-e).
     */
    private function credenciais(Loja $loja): array
    {
        if ($loja->temNfeProprio()) {
            return [
                'certificado' => $loja->certificado,
                'senha' => $loja->certificado_senha,
                'ambiente' => $loja->nfe_ambiente ?? 'sandbox',
                'serie' => $loja->nfe_serie ?? '1',
            ];
        }

        $empresa = $loja->empresa;

        return [
            'certificado' => $empresa?->certificado,
            'senha' => $empresa?->certificado_senha,
            'ambiente' => $loja->nfe_ambiente ?? $empresa?->nfe_ambiente ?? 'sandbox',
            'serie' => $loja->nfe_serie ?? $empresa?->nfe_serie ?? '1',
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
            // Ver comentário equivalente em NfceService::configJson — só
            // troca de pacote de schema quando precisa do grupo IBS/CBS
            // (Regime Normal).
            'schemes' => $crt === '3' ? 'PL_010_V1.30' : 'PL_009_V4',
        ]);
    }

    private function montar(Venda $venda, Loja $loja, $cliente, array $credenciais, string $crt, int $numero): Make
    {
        $make = new Make($crt === '3' ? 'PL_010_V1.30' : null);

        $foraEstado = $loja->uf && $cliente->uf && $loja->uf !== $cliente->uf;

        // SEFAZ rejeita (cStat 217/erro "não contribuinte deve indicar
        // consumidor final") se indFinal=0 (não consumidor final) pra um
        // destinatário sem IE — quem não é contribuinte de ICMS é sempre
        // tratado como consumidor final pra essa regra, mesmo numa venda de
        // atacado/revenda. Só quando o cliente tem IE própria (é
        // contribuinte, vai revender de novo) que dá pra marcar indFinal=0.
        $clienteEhContribuinte = filled($cliente->inscricao_estadual);

        $ide = new stdClass;
        $ide->cUF = UFList::getCodeByUF($loja->uf);
        $ide->natOp = 'Venda';
        $ide->mod = '55';
        $ide->serie = $credenciais['serie'];
        $ide->nNF = $numero;
        $ide->dhEmi = now()->format('Y-m-d\TH:i:sP');
        $ide->tpNF = 1;
        $ide->idDest = $foraEstado ? 2 : 1;
        $ide->cMunFG = $loja->codigo_municipio;
        $ide->tpImp = 1;
        $ide->tpEmis = 1;
        $ide->tpAmb = $credenciais['ambiente'] === 'producao' ? 1 : 2;
        $ide->finNFe = 1;
        // Ver $clienteEhContribuinte acima — não dá pra saber se foi
        // presencial ou não, então indPres usa o valor mais neutro (ver
        // ESCOPO ATUAL na doc).
        $ide->indFinal = $clienteEhContribuinte ? 0 : 1;
        $ide->indPres = 9;
        // Obrigatório pela SEFAZ (rejeição 434 sem isso, mesmo sendo
        // "false"/opcional no XSD) — 0 = venda sem intermediador/marketplace,
        // sempre o caso aqui (venda direta pra outro CNPJ, não passa por
        // plataforma terceira).
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

        $documento = preg_replace('/\D/', '', (string) $cliente->cpf_cnpj);

        $dest = new stdClass;
        if (strlen($documento) > 11) {
            $dest->CNPJ = $documento;
        } else {
            $dest->CPF = $documento;
        }
        $dest->xNome = $cliente->nome;
        $dest->indIEDest = $clienteEhContribuinte ? 1 : 9;
        $dest->IE = $cliente->inscricao_estadual;
        $make->tagdest($dest);

        $enderDest = new stdClass;
        $enderDest->xLgr = $cliente->logradouro;
        $enderDest->nro = $cliente->numero;
        $enderDest->xCpl = $cliente->complemento;
        $enderDest->xBairro = $cliente->bairro;
        $enderDest->cMun = $cliente->codigo_municipio;
        $enderDest->xMun = $cliente->cidade;
        $enderDest->UF = $cliente->uf;
        $enderDest->CEP = preg_replace('/\D/', '', (string) $cliente->cep);
        $make->tagenderDest($enderDest);

        $vBcIcmsTotal = 0.0;
        $vIcmsTotal = 0.0;
        $vPisTotal = 0.0;
        $vCofinsTotal = 0.0;

        // NF-e (mod 55) de venda só carrega item de mercadoria — serviço vai
        // numa NFS-e à parte (ver SpedyService::emitirNfse()); sem esse
        // filtro, um carrinho misto geraria uma linha de produto vazia
        // (produto null) pro item de serviço.
        foreach ($venda->itens->filter(fn ($item) => ! $item->ehServico())->values() as $indice => $item) {
            $nItem = $indice + 1;
            $grupo = $item->produto?->grupoFiscal;
            $totalItem = (float) $item->total;

            $prod = new stdClass;
            $prod->item = $nItem;
            $prod->cProd = $item->produto?->codigo_interno ?? (string) $item->produto_id;
            $prod->cEAN = $item->produto?->codigo_barras ?: 'SEM GTIN';
            $prod->xProd = $item->produto?->descricao;
            $prod->NCM = $grupo?->ncm ?? '00000000';
            $prod->CFOP = ($foraEstado ? $grupo?->cfop_fora_estado : $grupo?->cfop_dentro_estado)
                ?? ($foraEstado ? '6102' : '5102');
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

    /**
     * NF-e de transferência entre lojas — mesma estrutura de montar(), mas
     * o destinatário é a loja de destino (não um Cliente) e o CFOP é
     * sempre o de transferência (5152/6152), nunca o de venda do grupo
     * fiscal do produto. Sem pagamento de verdade (mesmo titular nos dois
     * lados) — usa tPag "90" (Sem pagamento, ver NT vigente).
     */
    private function montarTransferencia(
        TransferenciaEstoque $transferencia,
        Loja $lojaOrigem,
        Loja $lojaDestino,
        array $credenciais,
        string $crt,
        int $numero,
    ): Make {
        $make = new Make($crt === '3' ? 'PL_010_V1.30' : null);

        $foraEstado = $lojaOrigem->uf && $lojaDestino->uf && $lojaOrigem->uf !== $lojaDestino->uf;

        // Mesma regra de validação da SEFAZ documentada em montar() — a
        // loja de destino, na prática, sempre tem IE própria (é um
        // estabelecimento comercial de verdade), mas deriva dinâmico por
        // segurança em vez de assumir.
        $destinoEhContribuinte = filled($lojaDestino->inscricao_estadual);

        $ide = new stdClass;
        $ide->cUF = UFList::getCodeByUF($lojaOrigem->uf);
        $ide->natOp = 'Transferência de mercadorias';
        $ide->mod = '55';
        $ide->serie = $credenciais['serie'];
        $ide->nNF = $numero;
        $ide->dhEmi = now()->format('Y-m-d\TH:i:sP');
        $ide->tpNF = 1;
        $ide->idDest = $foraEstado ? 2 : 1;
        $ide->cMunFG = $lojaOrigem->codigo_municipio;
        $ide->tpImp = 1;
        $ide->tpEmis = 1;
        $ide->tpAmb = $credenciais['ambiente'] === 'producao' ? 1 : 2;
        $ide->finNFe = 1;
        $ide->indFinal = $destinoEhContribuinte ? 0 : 1;
        $ide->indPres = 9;
        $ide->indIntermed = 0;
        $ide->procEmi = 0;
        $ide->verProc = '1.0.0';
        $make->tagide($ide);

        $emit = new stdClass;
        $emit->CNPJ = $lojaOrigem->cnpjEmissor();
        $emit->xNome = $lojaOrigem->razao_social ?? $lojaOrigem->nome;
        $emit->xFant = $lojaOrigem->nome;
        $emit->IE = $lojaOrigem->inscricao_estadual;
        $emit->CRT = $crt;
        $make->tagEmit($emit);

        $ender = new stdClass;
        $ender->xLgr = $lojaOrigem->logradouro;
        $ender->nro = $lojaOrigem->numero;
        $ender->xCpl = $lojaOrigem->complemento;
        $ender->xBairro = $lojaOrigem->bairro;
        $ender->cMun = $lojaOrigem->codigo_municipio;
        $ender->xMun = $lojaOrigem->cidade;
        $ender->UF = $lojaOrigem->uf;
        $ender->CEP = preg_replace('/\D/', '', (string) $lojaOrigem->cep);
        $make->tagenderEmit($ender);

        $dest = new stdClass;
        $dest->CNPJ = $lojaDestino->cnpjEmissor();
        $dest->xNome = $lojaDestino->razao_social ?? $lojaDestino->nome;
        $dest->indIEDest = $destinoEhContribuinte ? 1 : 9;
        $dest->IE = $lojaDestino->inscricao_estadual;
        $make->tagdest($dest);

        $enderDest = new stdClass;
        $enderDest->xLgr = $lojaDestino->logradouro;
        $enderDest->nro = $lojaDestino->numero;
        $enderDest->xCpl = $lojaDestino->complemento;
        $enderDest->xBairro = $lojaDestino->bairro;
        $enderDest->cMun = $lojaDestino->codigo_municipio;
        $enderDest->xMun = $lojaDestino->cidade;
        $enderDest->UF = $lojaDestino->uf;
        $enderDest->CEP = preg_replace('/\D/', '', (string) $lojaDestino->cep);
        $make->tagenderDest($enderDest);

        $vBcIcmsTotal = 0.0;
        $vIcmsTotal = 0.0;
        $vPisTotal = 0.0;
        $vCofinsTotal = 0.0;

        foreach ($transferencia->itens as $indice => $item) {
            $nItem = $indice + 1;
            $grupo = $item->produto?->grupoFiscal;
            $totalItem = (float) $item->quantidade * (float) $item->preco_unitario;

            $prod = new stdClass;
            $prod->item = $nItem;
            $prod->cProd = $item->produto?->codigo_interno ?? (string) $item->produto_id;
            $prod->cEAN = $item->produto?->codigo_barras ?: 'SEM GTIN';
            $prod->xProd = $item->produto?->descricao;
            $prod->NCM = $grupo?->ncm ?? '00000000';
            // CFOP de transferência (5152/6152) — nunca o de venda do grupo
            // fiscal (5102/6102/5405 etc.), a operação é outra.
            $prod->CFOP = $foraEstado ? '6152' : '5152';
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

            if ($crt === '3') {
                $make->tagIBSCBS($this->montarIbsCbs($nItem, $grupo, $totalItem));
            }
        }

        $total = (float) $transferencia->itens->sum(fn ($item) => $item->quantidade * $item->preco_unitario);

        $icmsTot = new stdClass;
        $icmsTot->vBC = $vBcIcmsTotal;
        $icmsTot->vICMS = $vIcmsTotal;
        $icmsTot->vICMSDeson = 0;
        $icmsTot->vBCST = 0;
        $icmsTot->vST = 0;
        $icmsTot->vProd = $total;
        $icmsTot->vFrete = 0;
        $icmsTot->vSeg = 0;
        $icmsTot->vDesc = 0;
        $icmsTot->vII = 0;
        $icmsTot->vIPI = 0;
        $icmsTot->vPIS = $vPisTotal;
        $icmsTot->vCOFINS = $vCofinsTotal;
        $icmsTot->vOutro = 0;
        $icmsTot->vNF = $total;
        $make->tagICMSTot($icmsTot);

        if ($crt === '3') {
            $make->tagIBSCBSTot(new stdClass);
        }

        $transp = new stdClass;
        $transp->modFrete = 9;
        $make->tagtransp($transp);

        // Sem pagamento de verdade — mesmo titular nos dois lados (só uma
        // transferência de patrimônio entre estabelecimentos), não uma
        // venda. tPag "90" = Sem pagamento.
        $detPag = new stdClass;
        $detPag->tPag = '90';
        $detPag->vPag = 0;
        $make->tagdetPag($detPag);

        $pag = new stdClass;
        $pag->vTroco = 0;
        $make->tagpag($pag);

        $infNFe = new stdClass;
        $infNFe->versao = '4.00';
        $make->taginfNFe($infNFe);

        return $make;
    }
}
