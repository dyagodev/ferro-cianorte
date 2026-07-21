<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use App\Services\SpedyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use NFePHP\Common\Certificate;
use Throwable;

class LojaController extends Controller
{
    public function index()
    {
        return Loja::orderBy('nome')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data = $this->comCredenciaisSpedy($data, null);
        $data = $this->comCredenciaisNfce($data, null);

        return response()->json(Loja::create($data), 201);
    }

    public function show(Loja $loja)
    {
        return $loja;
    }

    public function update(Request $request, Loja $loja)
    {
        $data = $this->validated($request, sometimes: true);
        $data = $this->comCredenciaisSpedy($data, $loja);
        $data = $this->comCredenciaisNfce($data, $loja);

        $loja->update($data);

        return $loja;
    }

    public function destroy(Loja $loja)
    {
        $loja->delete();

        return response()->json(null, 204);
    }

    /**
     * Sobe o certificado A1 (.pfx) direto pra Spedy via API dela — não
     * guardamos o arquivo aqui (ver SpedyService::enviarCertificadoLoja).
     */
    public function enviarCertificado(Request $request, Loja $loja, SpedyService $spedy): JsonResponse
    {
        $data = $request->validate([
            'certificado' => ['required', 'file', 'max:5120'],
            'senha_certificado' => ['required', 'string'],
        ]);

        try {
            $spedy->enviarCertificadoLoja($loja, $data['certificado'], $data['senha_certificado']);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Falha ao enviar certificado: '.$e->getMessage()], 422);
        }

        return response()->json(['message' => 'Certificado enviado com sucesso.']);
    }

    /**
     * Diferente do certificado da Spedy (que fica guardado lá), MDF-e/
     * NFC-e/NF-e emitidos direto na SEFAZ precisam do certificado aqui,
     * salvo criptografado (ver Loja::casts) — é o MESMO arquivo pros três
     * tipos de documento (mesmo CNPJ assinando), por isso um upload só em
     * vez de um por tipo.
     */
    public function enviarCertificadoFiscal(Request $request, Loja $loja): JsonResponse
    {
        $data = $request->validate([
            'certificado' => ['required', 'file', 'max:5120'],
            'senha_certificado' => ['required', 'string'],
        ]);

        try {
            Certificate::readPfx(
                file_get_contents($data['certificado']->getRealPath()),
                $data['senha_certificado'],
            );
        } catch (Throwable $e) {
            return response()->json(['message' => 'Certificado ou senha inválidos: '.$e->getMessage()], 422);
        }

        $loja->update([
            'certificado' => file_get_contents($data['certificado']->getRealPath()),
            'certificado_senha' => $data['senha_certificado'],
        ]);

        return response()->json(['message' => 'Certificado salvo com sucesso.']);
    }

    private function validated(Request $request, bool $sometimes = false): array
    {
        $regraNome = $sometimes ? ['sometimes', 'required'] : ['required'];

        return $request->validate([
            'nome' => [...$regraNome, 'string', 'max:255'],
            'cnpj' => ['nullable', 'string', 'max:18'],
            'inscricao_estadual' => ['nullable', 'string', 'max:20'],
            'razao_social' => ['nullable', 'string', 'max:255'],
            'endereco' => ['nullable', 'string', 'max:255'],
            'cep' => ['nullable', 'string', 'max:9'],
            'logradouro' => ['nullable', 'string', 'max:255'],
            'numero' => ['nullable', 'string', 'max:20'],
            'complemento' => ['nullable', 'string', 'max:255'],
            'bairro' => ['nullable', 'string', 'max:255'],
            'cidade' => ['nullable', 'string', 'max:255'],
            'codigo_municipio' => ['nullable', 'string', 'max:7'],
            'uf' => ['nullable', 'string', 'size:2'],
            'ativo' => ['boolean'],
            // CNPJ próprio (opcional) permite emissão fiscal com identidade
            // diferente da matriz — ver Loja::possuiSpedyConfigurado.
            'spedy_ambiente' => ['nullable', 'in:sandbox,producao'],
            'spedy_company_id' => ['nullable', 'string', 'max:255'],
            'spedy_api_key' => ['nullable', 'string'],
            'spedy_token_id' => ['nullable', 'string', 'max:255'],
            'spedy_csc' => ['nullable', 'string', 'max:255'],
            'spedy_serie_nfce' => ['nullable', 'string', 'max:255'],
            'mdfe_ambiente' => ['nullable', 'in:sandbox,producao,simulado'],
            'mdfe_rntrc' => ['nullable', 'string', 'max:20'],
            // 'spedy' (gateway) ou 'direta' (nfephp-org/sped-nfe, sem
            // gateway — ver NfceService).
            'emissao_fiscal_modo' => ['nullable', 'in:spedy,direta'],
            'nfce_ambiente' => ['nullable', 'in:sandbox,producao'],
            'nfce_csc' => ['nullable', 'string'],
            'nfce_csc_id' => ['nullable', 'string', 'max:20'],
            'nfce_serie' => ['nullable', 'string', 'max:3'],
            'nfe_ambiente' => ['nullable', 'in:sandbox,producao'],
            'nfe_serie' => ['nullable', 'string', 'max:3'],
        ]);
    }

    /**
     * Campos sensíveis (api_key, csc) não voltam preenchidos pro form — se
     * vier vazio no submit é porque o operador não mexeu, não que ele quer
     * apagar o que já tava salvo (mesmo padrão do EmpresaController).
     */
    private function comCredenciaisSpedy(array $data, ?Loja $loja): array
    {
        foreach (['spedy_api_key', 'spedy_token_id', 'spedy_csc'] as $campo) {
            if (empty($data[$campo] ?? null)) {
                $data[$campo] = $loja?->{$campo};
            }
        }

        return $data;
    }

    private function comCredenciaisNfce(array $data, ?Loja $loja): array
    {
        if (empty($data['nfce_csc'] ?? null)) {
            $data['nfce_csc'] = $loja?->nfce_csc;
        }

        return $data;
    }
}
