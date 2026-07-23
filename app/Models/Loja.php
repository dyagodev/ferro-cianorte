<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'nome',
    'cnpj',
    'inscricao_estadual',
    'razao_social',
    'endereco',
    'cep',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'cidade',
    'codigo_municipio',
    'uf',
    'ativo',
    'spedy_ambiente',
    'spedy_company_id',
    'spedy_api_key',
    'spedy_token_id',
    'spedy_csc',
    'spedy_serie_nfce',
    'certificado',
    'certificado_senha',
    'mdfe_ambiente',
    'mdfe_rntrc',
    'mdfe_proximo_numero',
    'emissao_fiscal_modo',
    'nfce_ambiente',
    'nfce_csc',
    'nfce_csc_id',
    'nfce_serie',
    'nfce_proximo_numero',
    'nfe_ambiente',
    'nfe_serie',
    'nfe_proximo_numero',
])]
class Loja extends Model
{
    use BelongsToEmpresa, HasFactory;

    /**
     * GET /api/lojas é usado por qualquer usuário logado (admin e vendedor,
     * pro seletor de loja do PDV) — segredo nenhum pode ir nessa resposta,
     * mesmo estando no model (ver possui_spedy_proprio/possui_mdfe_configurado/
     * possui_nfce_configurado como substitutos seguros pro front saber "tem
     * config" sem ver a chave).
     */
    protected $hidden = [
        'spedy_api_key', 'spedy_token_id', 'spedy_csc',
        'certificado', 'certificado_senha', 'nfce_csc',
    ];

    protected $appends = [
        'possui_spedy_proprio', 'possui_mdfe_configurado', 'possui_nfce_configurado', 'possui_nfe_configurado',
        'possui_certificado', 'possui_nfce_csc', 'possui_emissao_fiscal_configurada',
    ];

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'spedy_api_key' => 'encrypted',
            'spedy_csc' => 'encrypted',
            // Certificado A1 (.pfx) inteiro, base64 — diferente da Spedy, o
            // MDF-e/NFC-e/NF-e direta é emitida direto na SEFAZ, então o
            // certificado precisa estar aqui pra assinar o XML (ver
            // MdfeService/NfceService/NfeService). É o MESMO certificado
            // pros três tipos de documento (mesmo CNPJ assinando), por isso
            // um campo só em vez de um por tipo.
            'certificado' => 'encrypted',
            'certificado_senha' => 'encrypted',
            'nfce_csc' => 'encrypted',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function produtoEstoques(): HasMany
    {
        return $this->hasMany(ProdutoEstoque::class);
    }

    public function vendas(): HasMany
    {
        return $this->hasMany(Venda::class);
    }

    public function manifestosTransporte(): HasMany
    {
        return $this->hasMany(ManifestoTransporte::class);
    }

    /**
     * Loja pode ter CNPJ e credenciamento fiscal próprio (filial que emite
     * nota com CNPJ diferente da matriz) — quando não tem, o SpedyService
     * usa a config da empresa (ver SpedyService::resolverCredenciais).
     */
    public function temSpedyProprio(): bool
    {
        return filled($this->spedy_api_key) && filled($this->spedy_token_id) && filled($this->spedy_csc);
    }

    public function getPossuiSpedyProprioAttribute(): bool
    {
        return $this->temSpedyProprio();
    }

    public function possuiSpedyConfigurado(): bool
    {
        return $this->temSpedyProprio() || (bool) $this->empresa?->possuiSpedyConfigurado();
    }

    /**
     * Certificado da empresa só serve de fallback quando a loja de fato usa
     * o mesmo CNPJ (sem CNPJ próprio definido, ou explicitamente igual ao
     * da empresa) — uma loja com CNPJ PRÓPRIO e diferente nunca pode herdar
     * certificado de outro CNPJ, ele simplesmente não seria válido pra
     * assinar em nome dela.
     */
    public function usaMesmoCnpjDaEmpresa(): bool
    {
        $cnpjLoja = preg_replace('/\D/', '', (string) $this->cnpj);
        $cnpjEmpresa = preg_replace('/\D/', '', (string) $this->empresa?->cnpj);

        return blank($cnpjLoja) || (filled($cnpjEmpresa) && $cnpjLoja === $cnpjEmpresa);
    }

    /**
     * CNPJ de verdade usado pra identificar o emitente no XML (config.json
     * e tag emit) — quando a loja não tem CNPJ próprio, ela está usando a
     * identidade da empresa (ver usaMesmoCnpjDaEmpresa), então o CNPJ pra
     * emissão também precisa vir de lá, senão a SEFAZ recebe um CNPJ vazio.
     */
    public function cnpjEmissor(): ?string
    {
        $cnpj = filled($this->cnpj) ? $this->cnpj : $this->empresa?->cnpj;

        return $cnpj ? preg_replace('/\D/', '', $cnpj) : null;
    }

    /**
     * Certificado próprio da loja — vale pra MDF-e/NFC-e/NF-e (mesmo
     * arquivo, um campo só, ver casts()). Sem exceção "simulado" aqui
     * porque isso é característica do MDF-e, não do certificado em si.
     */
    public function temCertificadoProprio(): bool
    {
        return filled($this->certificado) && filled($this->certificado_senha);
    }

    public function temMdfeProprio(): bool
    {
        return $this->temCertificadoProprio();
    }

    /**
     * Diferente de temCertificadoProprio() (só olha a própria loja), isso
     * já considera o fallback pra empresa — é o que a tela de Lojas usa pra
     * dizer com precisão o que falta configurar em cada seção (MDF-e/NFC-e/
     * NF-e), em vez de uma mensagem genérica "sem certificado" que podia
     * estar errada (ex.: certificado ok, só faltando o CSC da NFC-e).
     */
    public function possuiCertificado(): bool
    {
        return $this->temCertificadoProprio()
            || ($this->usaMesmoCnpjDaEmpresa() && (bool) $this->empresa?->temCertificadoProprio());
    }

    public function getPossuiCertificadoAttribute(): bool
    {
        return $this->possuiCertificado();
    }

    /**
     * CSC/CSC ID (exclusivos da NFC-e, pro QR Code) considerando o mesmo
     * fallback pra empresa — usado junto com possui_certificado pra apontar
     * exatamente o que falta em "NFC-e direta (falta ...)" na tela de
     * Lojas.
     */
    public function possuiNfceCsc(): bool
    {
        $temProprio = filled($this->nfce_csc) && filled($this->nfce_csc_id);

        return $temProprio
            || ($this->usaMesmoCnpjDaEmpresa() && filled($this->empresa?->nfce_csc) && filled($this->empresa?->nfce_csc_id));
    }

    public function getPossuiNfceCscAttribute(): bool
    {
        return $this->possuiNfceCsc();
    }

    /**
     * Ambiente "simulado" é exceção de propósito: não sai da nossa
     * aplicação, não precisa de certificado real — serve pra testar o
     * fluxo inteiro (cadastro, manifesto, emissão) antes do cliente ter
     * certificado/credenciamento de verdade.
     */
    public function possuiMdfeConfigurado(): bool
    {
        return $this->mdfe_ambiente === 'simulado'
            || $this->temMdfeProprio()
            || ($this->usaMesmoCnpjDaEmpresa() && (bool) $this->empresa?->possuiMdfeConfigurado());
    }

    public function mdfeEhSimulado(): bool
    {
        return $this->mdfe_ambiente === 'simulado';
    }

    public function getPossuiMdfeConfiguradoAttribute(): bool
    {
        return $this->possuiMdfeConfigurado();
    }

    public function emiteNfceDireto(): bool
    {
        return $this->emissao_fiscal_modo === 'direta';
    }

    public function temNfceProprio(): bool
    {
        return $this->temCertificadoProprio() && filled($this->nfce_csc) && filled($this->nfce_csc_id);
    }

    /**
     * Certificado + CSC/CSCid são obrigatórios pra NFC-e de verdade (o QR
     * Code do cupom depende do CSC) — sem exceção "simulado" aqui como no
     * MDF-e porque NFC-e roda no caixa em produção o tempo todo, testar
     * sem nenhuma credencial teria pouco valor prático.
     */
    public function possuiNfceConfigurado(): bool
    {
        return $this->temNfceProprio()
            || ($this->usaMesmoCnpjDaEmpresa() && (bool) $this->empresa?->possuiNfceConfigurado());
    }

    public function getPossuiNfceConfiguradoAttribute(): bool
    {
        return $this->possuiNfceConfigurado();
    }

    /**
     * Sinal único pro PDV decidir se vale a pena perguntar "emitir nota
     * fiscal?" no fechamento de caixa — cobre tanto NFC-e direta quanto
     * Spedy (serviço ainda depende da Spedy pra NFS-e, ver
     * VendaController::emitirNotaSeConfigurado), sempre desta loja
     * específica (com fallback pro CNPJ da empresa quando aplicável), nunca
     * "alguma loja da empresa" — cada loja pode estar configurada de forma
     * diferente.
     */
    public function possuiEmissaoFiscalConfigurada(): bool
    {
        return $this->possuiNfceConfigurado() || $this->possuiSpedyConfigurado();
    }

    public function getPossuiEmissaoFiscalConfiguradaAttribute(): bool
    {
        return $this->possuiEmissaoFiscalConfigurada();
    }

    /**
     * NF-e (mod 55, venda de atacado/revenda) segue o mesmo
     * emissao_fiscal_modo da NFC-e — é uma decisão por loja, não por tipo
     * de documento (ver emiteNfceDireto). Usa o mesmo certificado do
     * MDF-e/NFC-e (não depende de CSC/CSCid, isso é exclusivo da NFC-e).
     */
    public function temNfeProprio(): bool
    {
        return $this->temCertificadoProprio();
    }

    public function possuiNfeConfigurado(): bool
    {
        return $this->temNfeProprio()
            || ($this->usaMesmoCnpjDaEmpresa() && (bool) $this->empresa?->possuiNfeConfigurado());
    }

    public function getPossuiNfeConfiguradoAttribute(): bool
    {
        return $this->possuiNfeConfigurado();
    }
}
