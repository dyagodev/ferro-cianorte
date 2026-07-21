<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'nome',
    'cnpj',
    'razao_social',
    'endereco',
    'ativo',
    'regime_tributario',
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
    'nfce_ambiente',
    'nfce_csc',
    'nfce_csc_id',
    'nfce_serie',
    'nfe_ambiente',
    'nfe_serie',
])]
class Empresa extends Model
{
    use HasFactory;

    /**
     * Empresa nunca é serializada pra API JSON (só aparece em views Blade
     * do super_admin) — ainda assim, defesa em profundidade: se algum dia
     * alguém chamar toArray()/toJson() nela, segredo nenhum vaza junto.
     */
    protected $hidden = [
        'spedy_api_key', 'spedy_token_id', 'spedy_csc',
        'certificado', 'certificado_senha', 'nfce_csc',
    ];

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            // Credencial de terceiro (Spedy) — criptografada em repouso.
            // "encrypted" já cuida de decriptar na leitura/criptografar na
            // escrita sozinho, não precisa fazer isso na mão em nenhum lugar.
            'spedy_api_key' => 'encrypted',
            'spedy_csc' => 'encrypted',
            // Certificado A1 único pra MDF-e/NFC-e/NF-e (mesmo CNPJ
            // assinando os três) — ver Loja::casts pro mesmo raciocínio.
            'certificado' => 'encrypted',
            'certificado_senha' => 'encrypted',
            'nfce_csc' => 'encrypted',
        ];
    }

    public function possuiSpedyConfigurado(): bool
    {
        return filled($this->spedy_api_key) && filled($this->spedy_token_id) && filled($this->spedy_csc);
    }

    public function temCertificadoProprio(): bool
    {
        return filled($this->certificado) && filled($this->certificado_senha);
    }

    public function possuiMdfeConfigurado(): bool
    {
        return $this->temCertificadoProprio();
    }

    public function possuiNfceConfigurado(): bool
    {
        return $this->temCertificadoProprio() && filled($this->nfce_csc) && filled($this->nfce_csc_id);
    }

    public function possuiNfeConfigurado(): bool
    {
        return $this->temCertificadoProprio();
    }

    public function lojas(): HasMany
    {
        return $this->hasMany(Loja::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function produtos(): HasMany
    {
        return $this->hasMany(Produto::class);
    }

    public function clientes(): HasMany
    {
        return $this->hasMany(Cliente::class);
    }

    public function fornecedores(): HasMany
    {
        return $this->hasMany(Fornecedor::class);
    }

    public function gruposFiscais(): HasMany
    {
        return $this->hasMany(GrupoFiscal::class);
    }
}
