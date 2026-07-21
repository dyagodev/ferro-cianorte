<?php

namespace App\Services;

use App\Models\Loja;
use App\Models\ManifestoTransporte;
use NFePHP\Common\Certificate;
use NFePHP\Common\UFList;
use NFePHP\MDFe\Common\Standardize;
use NFePHP\MDFe\Make;
use NFePHP\MDFe\Tools;
use RuntimeException;
use stdClass;
use Throwable;

/**
 * Emissão de MDF-e direto na SEFAZ via nfephp-org/sped-mdfe — diferente da
 * Spedy (NFC-e/NF-e/NFS-e), aqui NÃO existe gateway: o certificado A1 fica
 * guardado (criptografado) na própria Loja e é usado localmente pra assinar
 * o XML antes de mandar pro webservice da SEFAZ do estado.
 *
 * ESCOPO ATUAL — só cobre o caminho mais comum:
 * - Modal rodoviário (não aéreo/aquaviário/ferroviário)
 * - Um veículo de tração + reboques opcionais, frota própria (não cobre a
 *   tag <prop> pra veículo de terceiro)
 * - Um único município de descarga por manifesto (nItem sempre 1) — MDF-e
 *   com múltiplos destinos exigiria estender o schema de itens
 * - Emissão síncrona (MDFeRecepcaoSinc) — sem suporte a lote assíncrono
 * - NÃO implementa eventos ainda (encerramento, cancelamento, inclusão de
 *   condutor/DF-e posterior) — isso é o próximo passo depois que a emissão
 *   básica estiver validada contra o sandbox real
 *
 * IMPORTANTE: os nomes de campo abaixo foram verificados direto no código
 * fonte da biblioteca (vendor/nfephp-org/sped-mdfe/src/Make.php), não
 * adivinhados — mas o fluxo completo (assinatura + envio real pra SEFAZ)
 * só pode ser validado de ponta a ponta com certificado e ambiente de
 * homologação de verdade.
 */
class MdfeService
{
    public function emitir(ManifestoTransporte $manifesto): void
    {
        $loja = $manifesto->loja;
        $loja->loadMissing('empresa');

        if (! $loja->possuiMdfeConfigurado()) {
            throw new RuntimeException('Loja não tem certificado MDF-e configurado (ou ambiente simulado habilitado).');
        }

        $manifesto->loadMissing(['veiculoTracao', 'documentos', 'condutores', 'reboques']);

        $credenciais = $this->credenciais($loja);

        $make = $this->montar($manifesto, $loja, $credenciais);

        try {
            $xml = $make->getXML();
        } catch (Throwable $e) {
            $manifesto->update([
                'status' => 'rejeitado',
                'mensagem_retorno' => 'Erro ao montar XML: '.$e->getMessage().' | '.implode('; ', $make->getErrors()),
            ]);

            return;
        }

        $manifesto->chave_acesso = $make->getChave();

        if ($loja->mdfeEhSimulado()) {
            $this->emitirSimulado($manifesto, $xml);

            return;
        }

        $certificate = Certificate::readPfx($credenciais['certificado'], $credenciais['senha']);
        $tools = new Tools($this->configJson($loja, $credenciais), $certificate);

        try {
            $signedXml = $tools->signMDFe($xml);
        } catch (Throwable $e) {
            $manifesto->update([
                'status' => 'rejeitado',
                'xml_gerado' => $xml,
                'mensagem_retorno' => 'Erro ao assinar/validar XML: '.$e->getMessage(),
            ]);

            return;
        }

        $manifesto->xml_gerado = $signedXml;

        try {
            $resposta = $tools->sefazEnviaLote([$signedXml], (string) $manifesto->id, indSinc: 1);
        } catch (Throwable $e) {
            $manifesto->update([
                'status' => 'rejeitado',
                'xml_gerado' => $signedXml,
                'mensagem_retorno' => 'Falha na comunicação com a SEFAZ: '.$e->getMessage(),
            ]);

            return;
        }

        $this->processarResposta($manifesto, $resposta);
    }

    /**
     * Ambiente "simulado": monta o XML de verdade (então erro de dado
     * incompleto/inválido ainda aparece — ver montar()), mas NÃO assina nem
     * manda pra SEFAZ. Fabrica um protocolo de autorização só pra deixar o
     * fluxo (rascunho -> emitido -> autorizado) testável de ponta a ponta
     * sem precisar de certificado nem de conta na SEFAZ.
     */
    private function emitirSimulado(ManifestoTransporte $manifesto, string $xml): void
    {
        $manifesto->update([
            'status' => 'autorizado',
            'xml_gerado' => $xml,
            'protocolo' => 'SIMULADO-'.now()->format('YmdHis').'-'.$manifesto->id,
            'codigo_retorno' => '100',
            'mensagem_retorno' => 'Autorizado o uso do MDF-e — SIMULADO, não foi enviado à SEFAZ de verdade.',
            'dh_emissao' => now(),
        ]);
    }

    private function processarResposta(ManifestoTransporte $manifesto, string $respostaXml): void
    {
        $std = (new Standardize($respostaXml))->toStd();

        // Envio síncrono devolve o protocolo direto (protMDFe/infProt) —
        // não precisa de sefazConsultaRecibo separado.
        $infProt = $std->protMDFe->infProt ?? null;

        if ($infProt) {
            $autorizado = ($infProt->cStat ?? null) == '100';
            $manifesto->update([
                'status' => $autorizado ? 'autorizado' : 'rejeitado',
                'protocolo' => $infProt->nProt ?? null,
                'codigo_retorno' => $infProt->cStat ?? null,
                'mensagem_retorno' => $infProt->xMotivo ?? null,
                'dh_emissao' => now(),
            ]);

            return;
        }

        $manifesto->update([
            'status' => 'rejeitado',
            'codigo_retorno' => $std->cStat ?? null,
            'mensagem_retorno' => $std->xMotivo ?? 'Resposta da SEFAZ em formato inesperado — ver xml_gerado/resposta bruta nos logs.',
            'dh_emissao' => now(),
        ]);
    }

    /**
     * Config própria da loja tem prioridade; sem ela (e só quando a loja
     * usa o mesmo CNPJ da empresa — ver Loja::usaMesmoCnpjDaEmpresa), cai
     * pra config da empresa. Uma loja com CNPJ próprio diferente nunca cai
     * aqui, ela é obrigada a ter certificado dela mesma.
     */
    private function credenciais(Loja $loja): array
    {
        if ($loja->temMdfeProprio()) {
            return [
                'certificado' => $loja->certificado,
                'senha' => $loja->certificado_senha,
                'ambiente' => $loja->mdfe_ambiente ?? 'sandbox',
                'rntrc' => $loja->mdfe_rntrc,
            ];
        }

        $empresa = $loja->empresa;

        return [
            'certificado' => $empresa?->certificado,
            'senha' => $empresa?->certificado_senha,
            'ambiente' => $loja->mdfe_ambiente ?? $empresa?->mdfe_ambiente ?? 'sandbox',
            'rntrc' => $loja->mdfe_rntrc ?? $empresa?->mdfe_rntrc,
        ];
    }

    private function configJson(Loja $loja, array $credenciais): string
    {
        return json_encode([
            'tpAmb' => $credenciais['ambiente'] === 'producao' ? 1 : 2,
            'razaosocial' => $loja->razao_social ?? $loja->nome,
            'siglaUF' => $loja->uf,
            'cnpj' => $loja->cnpjEmissor(),
            'versao' => '3.00',
        ]);
    }

    private function montar(ManifestoTransporte $manifesto, Loja $loja, array $credenciais): Make
    {
        $make = new Make;
        $veiculo = $manifesto->veiculoTracao;

        $ide = new stdClass;
        $ide->cUF = UFList::getCodeByUF($loja->uf);
        $ide->tpAmb = $credenciais['ambiente'] === 'producao' ? 1 : 2;
        $ide->tpEmit = $manifesto->tp_emitente;
        $ide->mod = '58';
        $ide->serie = $manifesto->serie;
        $ide->nMDF = $manifesto->numero;
        $ide->cMDF = $manifesto->codigo_numerico;
        $ide->cDV = 0;
        $ide->modal = '1';
        $ide->dhEmi = now()->format('Y-m-d\TH:i:sP');
        $ide->tpEmis = 1;
        $ide->procEmi = 0;
        $ide->verProc = '1.0.0';
        $ide->UFIni = $manifesto->uf_ini;
        $ide->UFFim = $manifesto->uf_fim;
        if ($manifesto->dh_inicio_viagem) {
            $ide->dhIniViagem = $manifesto->dh_inicio_viagem->format('Y-m-d\TH:i:sP');
        }
        $make->tagide($ide);

        $munCarrega = new stdClass;
        $munCarrega->cMunCarrega = $manifesto->municipio_carregamento_codigo;
        $munCarrega->xMunCarrega = $manifesto->municipio_carregamento_nome;
        $make->taginfMunCarrega($munCarrega);

        $emit = new stdClass;
        $emit->CNPJ = $loja->cnpjEmissor();
        $emit->IE = $loja->inscricao_estadual;
        $emit->xNome = $loja->razao_social ?? $loja->nome;
        $emit->xFant = $loja->nome;
        $make->tagemit($emit);

        $ender = new stdClass;
        $ender->xLgr = $loja->logradouro;
        $ender->nro = $loja->numero;
        $ender->xCpl = $loja->complemento;
        $ender->xBairro = $loja->bairro;
        $ender->cMun = $loja->codigo_municipio;
        $ender->xMun = $loja->cidade;
        $ender->CEP = preg_replace('/\D/', '', (string) $loja->cep);
        $ender->UF = $loja->uf;
        $make->tagenderEmit($ender);

        if (filled($credenciais['rntrc'])) {
            $antt = new stdClass;
            $antt->RNTRC = $credenciais['rntrc'];
            $make->taginfANTT($antt);
        }

        $tracao = new stdClass;
        $tracao->placa = $veiculo->placa;
        $tracao->RENAVAM = $veiculo->renavam;
        $tracao->tara = $veiculo->tara_kg;
        $tracao->capKG = $veiculo->capacidade_kg;
        $tracao->capM3 = $veiculo->capacidade_m3;
        $tracao->tpRod = $veiculo->tipo_rodado;
        $tracao->tpCar = $veiculo->tipo_carroceria;
        $tracao->UF = $veiculo->uf;
        $tracao->condutor = $manifesto->condutores->map(fn ($condutor) => (object) [
            'xNome' => $condutor->nome,
            'CPF' => preg_replace('/\D/', '', $condutor->cpf),
        ])->all();
        $make->tagveicTracao($tracao);

        foreach ($manifesto->reboques as $reboque) {
            $tagReboque = new stdClass;
            $tagReboque->placa = $reboque->placa;
            $tagReboque->RENAVAM = $reboque->renavam;
            $tagReboque->tara = $reboque->tara_kg;
            $tagReboque->capKG = $reboque->capacidade_kg;
            $tagReboque->capM3 = $reboque->capacidade_m3;
            $tagReboque->tpCar = $reboque->tipo_carroceria;
            $tagReboque->UF = $reboque->uf;
            $make->tagveicReboque($tagReboque);
        }

        $munDescarga = new stdClass;
        $munDescarga->cMunDescarga = $manifesto->municipio_descarga_codigo;
        $munDescarga->xMunDescarga = $manifesto->municipio_descarga_nome;
        $munDescarga->nItem = 1;
        $make->taginfMunDescarga($munDescarga);

        foreach ($manifesto->documentos as $documento) {
            if ($documento->tipo === 'cte') {
                $doc = new stdClass;
                $doc->chCTe = $documento->chave;
                $doc->nItem = 1;
                $make->taginfCTe($doc);
            } else {
                $doc = new stdClass;
                $doc->chNFe = $documento->chave;
                $doc->nItem = 1;
                $make->taginfNFe($doc);
            }
        }

        $prodPred = new stdClass;
        $prodPred->tpCarga = $manifesto->tipo_carga;
        $prodPred->xProd = $manifesto->descricao_produto;
        $prodPred->NCM = $manifesto->ncm;
        $make->tagprodPred($prodPred);

        $tot = new stdClass;
        $tot->vCarga = (float) $manifesto->valor_carga;
        $tot->cUnid = '01'; // KG
        $tot->qCarga = (float) $manifesto->peso_carga_kg;
        $make->tagtot($tot);

        return $make;
    }
}
