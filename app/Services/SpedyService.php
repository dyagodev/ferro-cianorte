<?php

namespace App\Services;

use App\Models\Empresa;
use App\Models\Loja;
use App\Models\NotaFiscal;
use App\Models\Venda;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Integração com a Spedy (api.spedy.com.br) — emissão de NFC-e, NF-e e
 * NFS-e a partir de uma Venda já concluída. Credenciais são resolvidas por
 * LOJA, não por empresa: uma loja pode ter CNPJ e credenciamento fiscal
 * próprio (filial que emite nota com CNPJ diferente da matriz), e nesse
 * caso usa a config dela (ver Loja::possuiSpedyConfigurado); sem config
 * própria, cai pra config da empresa (Empresa::possuiSpedyConfigurado()).
 * Sem nenhuma das duas, simplesmente não emite — a venda continua
 * funcionando normal (emissão fiscal é opt-in, não trava o caixa, ver
 * VendaController::emitirNotaSeConfigurado).
 *
 * IMPORTANTE: o formato exato dos payloads abaixo foi montado a partir do
 * resumo em https://api.spedy.com.br/llms.txt (não tivemos acesso à
 * especificação OpenAPI completa ainda) — os NOMES dos campos de imposto
 * (icms.*, pis.*, cofins.*, iss.*) são um mapeamento razoável dos conceitos
 * documentados, mas precisam ser confirmados contra o sandbox assim que
 * tivermos uma API key de teste.
 */
class SpedyService
{
    private const BASE_URL_PRODUCAO = 'https://api.spedy.com.br/v1';

    private const BASE_URL_SANDBOX = 'https://sandbox-api.spedy.com.br/v1';

    /**
     * NFC-e (retail, consumidor final presencial) — só os itens que são
     * produto (serviço vai numa NFS-e à parte, ver emitirNfse()).
     */
    public function emitirNfce(Venda $venda): NotaFiscal
    {
        $venda->loadMissing(['itens.produto.grupoFiscal', 'pagamentos', 'cliente', 'loja.empresa']);
        $credenciais = $this->credenciaisObrigatorias($venda->loja);

        $itensProduto = $venda->itens->filter(fn ($item) => ! $item->ehServico());

        if ($itensProduto->isEmpty()) {
            throw new RuntimeException('Venda não tem itens de produto para emitir NFC-e.');
        }

        $payload = [
            'integrationId' => $venda->uuid,
            'tokenId' => $credenciais['tokenId'],
            'csc' => $credenciais['csc'],
            'series' => $credenciais['serie'],
            'customer' => $this->dadosClienteSimplificado($venda),
            'items' => $itensProduto->map(fn ($item) => $this->itemProduto($item, cfopForaEstado: false))->values()->all(),
            'payments' => $this->dadosPagamentos($venda),
            'discountAmount' => (float) $venda->desconto,
            'totalAmount' => (float) $itensProduto->sum('total'),
        ];

        return $this->enviar($credenciais, $venda, 'nfce', '/consumer-invoices', $payload);
    }

    /**
     * NF-e (venda de produto pra outro CNPJ — atacado/revenda). Diferente
     * da NFC-e, exige destinatário identificado com endereço completo e
     * decide o CFOP comparando o UF da loja emissora com o UF do cliente
     * (dentro ou fora do estado).
     */
    public function emitirNfe(Venda $venda): NotaFiscal
    {
        $venda->loadMissing(['itens.produto.grupoFiscal', 'pagamentos', 'cliente', 'loja.empresa']);
        $credenciais = $this->credenciaisObrigatorias($venda->loja);

        $cliente = $venda->cliente;

        if (! $cliente || ! $cliente->possuiEnderecoCompletoParaNfe()) {
            throw new RuntimeException('Cliente sem CNPJ/endereço completo cadastrado — obrigatório para emitir NF-e.');
        }

        $itensProduto = $venda->itens->filter(fn ($item) => ! $item->ehServico());
        if ($itensProduto->isEmpty()) {
            throw new RuntimeException('Venda não tem itens de produto para emitir NF-e.');
        }

        $foraEstado = $venda->loja->uf && $cliente->uf && $venda->loja->uf !== $cliente->uf;

        $payload = [
            'integrationId' => $venda->uuid,
            'customer' => $this->dadosClienteCompleto($cliente),
            'items' => $itensProduto->map(fn ($item) => $this->itemProduto($item, $foraEstado))->values()->all(),
            'payments' => $this->dadosPagamentos($venda),
            'discountAmount' => (float) $venda->desconto,
            'totalAmount' => (float) $itensProduto->sum('total'),
        ];

        return $this->enviar($credenciais, $venda, 'nfe', '/product-invoices', $payload);
    }

    /**
     * NFS-e (nota de serviço — frete, instalação, mão de obra). Só os itens
     * que vieram do catálogo de Serviço (ver VendaItem::ehServico()).
     */
    public function emitirNfse(Venda $venda): NotaFiscal
    {
        $venda->loadMissing(['itens.servico', 'pagamentos', 'cliente', 'loja.empresa']);
        $credenciais = $this->credenciaisObrigatorias($venda->loja);
        $itensServico = $venda->itens->filter(fn ($item) => $item->ehServico());

        if ($itensServico->isEmpty()) {
            throw new RuntimeException('Venda não tem itens de serviço para emitir NFS-e.');
        }

        $payload = [
            'integrationId' => $venda->uuid.'-nfse',
            'customer' => $this->dadosClienteSimplificado($venda),
            'services' => $itensServico->map(fn ($item) => [
                'description' => $item->servico->descricao,
                'cityServiceCode' => $item->servico->codigo_servico_municipal,
                'quantity' => (float) $item->quantidade,
                'unitAmount' => (float) $item->preco_unitario,
                'totalAmount' => (float) $item->total,
                'iss' => [
                    'rate' => $item->servico->aliquota_iss ? (float) $item->servico->aliquota_iss : null,
                ],
            ])->values()->all(),
            'totalAmount' => (float) $itensServico->sum('total'),
        ];

        return $this->enviar($credenciais, $venda, 'nfse', '/service-invoices', $payload);
    }

    /**
     * Atualiza o status da nota a partir de um evento de webhook da Spedy
     * (invoice.status_changed / invoice.authorized / invoice.rejected /
     * invoice.canceled — ver SpedyWebhookController). Casada pelo
     * spedy_invoice_id, não pelo id da venda (o webhook só sabe o id da
     * nota lá na Spedy, e uma venda pode ter mais de uma nota agora).
     */
    public function processarWebhook(array $payload): void
    {
        $invoiceId = $payload['invoiceId'] ?? $payload['id'] ?? null;
        if (! $invoiceId) {
            return;
        }

        $nota = NotaFiscal::withoutGlobalScopes()->where('spedy_invoice_id', $invoiceId)->first();
        if (! $nota) {
            return;
        }

        $detalhe = $payload['processingDetail'] ?? [];

        $nota->update([
            'status' => $payload['status'] ?? $nota->status,
            'chave_acesso' => $payload['accessKey'] ?? $nota->chave_acesso,
            'numero' => $payload['number'] ?? $nota->numero,
            'serie' => $payload['series'] ?? $nota->serie,
            'url_danfe' => $payload['danfeUrl'] ?? $nota->url_danfe,
            'url_xml' => $payload['xmlUrl'] ?? $nota->url_xml,
            'codigo_retorno' => $detalhe['code'] ?? $nota->codigo_retorno,
            'mensagem_retorno' => $detalhe['message'] ?? $nota->mensagem_retorno,
            'resposta_bruta' => $payload,
        ]);
    }

    /**
     * Envia o certificado A1 (.pfx) pra Spedy — é ela quem guarda e usa
     * pra assinar as notas antes de mandar pra SEFAZ, não guardamos o
     * certificado aqui. Exige spedy_company_id configurado (o ID da
     * empresa dentro do painel da Spedy, diferente da API key — ver
     * campo "Spedy Company ID" no form).
     *
     * IMPORTANTE: nomes dos campos ('certificate', 'password') e o
     * formato exato da resposta não foram confirmados contra o sandbox
     * ainda (a doc resumida só diz "multipart .pfx + password") —
     * ajustar assim que tivermos acesso de teste.
     */
    public function enviarCertificadoEmpresa(Empresa $empresa, UploadedFile $arquivo, string $senha): array
    {
        if (! filled($empresa->spedy_api_key) || ! filled($empresa->spedy_company_id)) {
            throw new RuntimeException('Configure a API Key e o Company ID da Spedy antes de enviar o certificado.');
        }

        return $this->enviarCertificadoComCredenciais([
            'ambiente' => $empresa->spedy_ambiente ?? 'sandbox',
            'apiKey' => $empresa->spedy_api_key,
            'companyId' => $empresa->spedy_company_id,
        ], $arquivo, $senha);
    }

    public function enviarCertificadoLoja(Loja $loja, UploadedFile $arquivo, string $senha): array
    {
        $empresa = $loja->empresa;
        $usaProprio = filled($loja->spedy_api_key) && filled($loja->spedy_company_id);

        $credenciais = $usaProprio ? [
            'ambiente' => $loja->spedy_ambiente ?? $empresa?->spedy_ambiente ?? 'sandbox',
            'apiKey' => $loja->spedy_api_key,
            'companyId' => $loja->spedy_company_id,
        ] : [
            'ambiente' => $empresa?->spedy_ambiente ?? 'sandbox',
            'apiKey' => $empresa?->spedy_api_key,
            'companyId' => $empresa?->spedy_company_id,
        ];

        if (! filled($credenciais['apiKey']) || ! filled($credenciais['companyId'])) {
            throw new RuntimeException('Configure a API Key e o Company ID da Spedy (na loja ou na empresa) antes de enviar o certificado.');
        }

        return $this->enviarCertificadoComCredenciais($credenciais, $arquivo, $senha);
    }

    private function enviarCertificadoComCredenciais(array $credenciais, UploadedFile $arquivo, string $senha): array
    {
        $baseUrl = $credenciais['ambiente'] === 'producao' ? self::BASE_URL_PRODUCAO : self::BASE_URL_SANDBOX;

        $resposta = Http::baseUrl($baseUrl)
            ->withHeaders(['X-Api-Key' => $credenciais['apiKey']])
            ->attach('certificate', file_get_contents($arquivo->getRealPath()), $arquivo->getClientOriginalName())
            ->post("/companies/{$credenciais['companyId']}/certificates", ['password' => $senha])
            ->throw();

        return $resposta->json();
    }

    private function enviar(array $credenciais, Venda $venda, string $tipo, string $endpoint, array $payload): NotaFiscal
    {
        $resposta = $this->cliente($credenciais)->post($endpoint, $payload)->throw();
        $dados = $resposta->json();

        return NotaFiscal::updateOrCreate(
            ['venda_id' => $venda->id, 'tipo' => $tipo],
            [
                'spedy_invoice_id' => $dados['id'] ?? null,
                'status' => $dados['status'] ?? 'enqueued',
                'payload_enviado' => $payload,
                'resposta_bruta' => $dados,
            ],
        );
    }

    /**
     * Config própria da loja tem prioridade; sem ela, cai pra config da
     * empresa. Lança se nenhuma das duas estiver completa (api key +
     * tokenId + csc) — caller decide se isso vira "não emite silenciosamente"
     * (checkout do PDV) ou erro visível (tela de NF-e).
     */
    public function credenciaisObrigatorias(Loja $loja): array
    {
        $empresa = $loja->empresa;

        $credenciais = $loja->temSpedyProprio() ? [
            'ambiente' => $loja->spedy_ambiente ?? $empresa?->spedy_ambiente ?? 'sandbox',
            'apiKey' => $loja->spedy_api_key,
            'tokenId' => $loja->spedy_token_id,
            'csc' => $loja->spedy_csc,
            'serie' => $loja->spedy_serie_nfce ?? $empresa?->spedy_serie_nfce,
        ] : [
            'ambiente' => $empresa?->spedy_ambiente ?? 'sandbox',
            'apiKey' => $empresa?->spedy_api_key,
            'tokenId' => $empresa?->spedy_token_id,
            'csc' => $empresa?->spedy_csc,
            'serie' => $empresa?->spedy_serie_nfce,
        ];

        if (! filled($credenciais['apiKey']) || ! filled($credenciais['tokenId']) || ! filled($credenciais['csc'])) {
            throw new RuntimeException('Nem a loja nem a empresa têm a integração com a Spedy configurada (API key, tokenId ou CSC faltando).');
        }

        return $credenciais;
    }

    private function cliente(array $credenciais): PendingRequest
    {
        $baseUrl = $credenciais['ambiente'] === 'producao' ? self::BASE_URL_PRODUCAO : self::BASE_URL_SANDBOX;

        return Http::baseUrl($baseUrl)
            ->withHeaders(['X-Api-Key' => $credenciais['apiKey']])
            ->acceptJson();
    }

    private function dadosClienteSimplificado(Venda $venda): ?array
    {
        return $venda->cliente ? [
            'name' => $venda->cliente->nome,
            'document' => $venda->cliente->cpf_cnpj,
        ] : null;
    }

    private function dadosClienteCompleto($cliente): array
    {
        return [
            'name' => $cliente->nome,
            'document' => $cliente->cpf_cnpj,
            'stateRegistration' => $cliente->inscricao_estadual,
            'address' => [
                'zipCode' => $cliente->cep,
                'street' => $cliente->logradouro,
                'number' => $cliente->numero,
                'complement' => $cliente->complemento,
                'district' => $cliente->bairro,
                'city' => $cliente->cidade,
                'cityCode' => $cliente->codigo_municipio,
                'state' => $cliente->uf,
            ],
        ];
    }

    private function dadosPagamentos(Venda $venda): array
    {
        return $venda->pagamentos->map(fn ($pagamento) => [
            'method' => $pagamento->forma_pagamento,
            'amount' => (float) $pagamento->valor,
        ])->all();
    }

    /**
     * NFC-e é sempre operação dentro do estado (venda presencial de
     * balcão) — cfopForaEstado só é relevante pra NF-e, onde a operação
     * pode cruzar estado dependendo de onde o cliente está.
     */
    private function itemProduto($item, bool $cfopForaEstado): array
    {
        $grupo = $item->produto?->grupoFiscal;
        $cfop = $cfopForaEstado ? $grupo?->cfop_fora_estado : $grupo?->cfop_dentro_estado;

        return [
            'description' => $item->produto?->descricao,
            'quantity' => (float) $item->quantidade,
            'unitAmount' => (float) $item->preco_unitario,
            'totalAmount' => (float) $item->total,
            'ncm' => $grupo?->ncm,
            'cfop' => $cfop ?? '5102',
            'icms' => [
                'csosn' => $grupo?->csosn,
                'cst' => $grupo?->cst_icms,
                'rate' => $grupo?->aliquota_icms ? (float) $grupo->aliquota_icms : null,
            ],
            'pis' => [
                'cst' => $grupo?->cst_pis,
                'rate' => $grupo?->aliquota_pis ? (float) $grupo->aliquota_pis : null,
            ],
            'cofins' => [
                'cst' => $grupo?->cst_cofins,
                'rate' => $grupo?->aliquota_cofins ? (float) $grupo->aliquota_cofins : null,
            ],
        ];
    }
}
