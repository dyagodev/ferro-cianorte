<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\User;
use App\Services\SpedyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\View\View;
use NFePHP\Common\Certificate;
use Throwable;

/**
 * Só super_admin acessa (ver rota) — provisiona empresa cliente nova. Cria
 * junto o primeiro usuário admin dela: sem isso a empresa nasceria sem
 * ninguém capaz de logar (Empresa não tem ligação nenhuma com quem a
 * criou, é um tenant novo do zero).
 */
class EmpresaController extends Controller
{
    public function index(): View
    {
        $empresas = Empresa::withCount(['lojas', 'users'])->orderBy('nome')->get();

        return view('admin.empresas.index', compact('empresas'));
    }

    public function create(): View
    {
        return view('admin.empresas.form', ['empresa' => new Empresa]);
    }

    /**
     * Consulta CNPJ na BrasilAPI (pública, sem chave) pra preencher razão
     * social e endereço automaticamente no formulário — usada via fetch()
     * no JS do form.blade.php, não é navegação de página.
     */
    public function consultarCnpj(string $cnpj): JsonResponse
    {
        $cnpjLimpo = preg_replace('/\D/', '', $cnpj);

        if (strlen($cnpjLimpo) !== 14) {
            return response()->json(['message' => 'CNPJ inválido.'], 422);
        }

        $resposta = Http::timeout(10)->get("https://brasilapi.com.br/api/cnpj/v1/{$cnpjLimpo}");

        if (! $resposta->ok()) {
            return response()->json(['message' => 'CNPJ não encontrado.'], 404);
        }

        $dados = $resposta->json();
        $endereco = trim(sprintf(
            '%s, %s%s - %s, %s/%s - CEP %s',
            $dados['logradouro'] ?? '',
            $dados['numero'] ?? 's/n',
            $dados['complemento'] ? " ({$dados['complemento']})" : '',
            $dados['bairro'] ?? '',
            $dados['municipio'] ?? '',
            $dados['uf'] ?? '',
            $dados['cep'] ?? '',
        ), ', -/ ');

        return response()->json([
            'razao_social' => $dados['razao_social'] ?? null,
            'endereco' => $endereco,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cnpj' => ['nullable', 'string', 'max:18', 'unique:empresas,cnpj'],
            'razao_social' => ['nullable', 'string', 'max:255'],
            'endereco' => ['nullable', 'string', 'max:255'],
            'admin_nome' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'admin_password' => ['required', 'string', 'min:6'],
        ]);

        $empresa = Empresa::create([
            'nome' => $data['nome'],
            'cnpj' => $data['cnpj'] ?? null,
            'razao_social' => $data['razao_social'] ?? null,
            'endereco' => $data['endereco'] ?? null,
            'ativo' => true,
        ]);

        // empresa_id explícito (não passa pelo fillable de propósito) —
        // TenantContext::id() aqui resolveria pra empresa do super_admin
        // logado (DM Tecnologia), não pra empresa nova que acabou de criar.
        $admin = new User([
            'name' => $data['admin_nome'],
            'email' => $data['admin_email'],
            'password' => Hash::make($data['admin_password']),
            'role' => 'admin',
        ]);
        $admin->empresa_id = $empresa->id;
        $admin->save();

        return redirect()->route('admin.empresas.index')->with('sucesso', "Empresa \"{$empresa->nome}\" criada, com {$admin->email} como administrador.");
    }

    public function edit(Empresa $empresa): View
    {
        return view('admin.empresas.form', compact('empresa'));
    }

    public function update(Request $request, Empresa $empresa): RedirectResponse
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cnpj' => ['nullable', 'string', 'max:18', 'unique:empresas,cnpj,'.$empresa->id],
            'razao_social' => ['nullable', 'string', 'max:255'],
            'endereco' => ['nullable', 'string', 'max:255'],
            'ativo' => ['boolean'],
            'regime_tributario' => ['required', 'in:simples_nacional,lucro_presumido,lucro_real'],
            // Config da Spedy — em branco fica como está (não sobrescreve
            // uma chave já salva com vazio só porque o campo mascarado do
            // form não a reexibe, ver spedyValorOuNulo()).
            'spedy_ambiente' => ['required', 'in:sandbox,producao'],
            'spedy_company_id' => ['nullable', 'string', 'max:255'],
            'spedy_api_key' => ['nullable', 'string'],
            'spedy_token_id' => ['nullable', 'string', 'max:255'],
            'spedy_csc' => ['nullable', 'string', 'max:255'],
            'spedy_serie_nfce' => ['nullable', 'string', 'max:255'],
            // Config padrão de MDF-e/NFC-e direta pras lojas que usam o
            // mesmo CNPJ da empresa (ver Loja::usaMesmoCnpjDaEmpresa) — o
            // certificado em si sobe pelo botão de upload, não por aqui.
            'mdfe_ambiente' => ['nullable', 'in:sandbox,producao,simulado'],
            'mdfe_rntrc' => ['nullable', 'string', 'max:20'],
            'nfce_ambiente' => ['nullable', 'in:sandbox,producao'],
            'nfce_csc' => ['nullable', 'string'],
            'nfce_csc_id' => ['nullable', 'string', 'max:20'],
            'nfce_serie' => ['nullable', 'string', 'max:3'],
            'nfe_ambiente' => ['nullable', 'in:sandbox,producao'],
            'nfe_serie' => ['nullable', 'string', 'max:3'],
        ]);
        $data['ativo'] = $request->boolean('ativo');

        foreach (['spedy_api_key', 'spedy_token_id', 'spedy_csc', 'spedy_serie_nfce', 'nfce_csc'] as $campo) {
            $data[$campo] = $this->valorOuAtual($data[$campo] ?? null, $empresa, $campo);
        }

        $empresa->update($data);

        return redirect()->route('admin.empresas.index')->with('sucesso', 'Empresa atualizada com sucesso.');
    }

    /**
     * Campos sensíveis (api_key, csc) não voltam preenchidos pro form (ver
     * form.blade.php) — se vier vazio no submit, é porque o operador não
     * mexeu neles, não que ele queira apagar o que já tava salvo.
     */
    private function valorOuAtual(?string $novoValor, Empresa $empresa, string $campo): ?string
    {
        return filled($novoValor) ? $novoValor : $empresa->{$campo};
    }

    /**
     * Sobe o certificado A1 (.pfx) direto pra Spedy via API dela — não
     * guardamos o arquivo aqui, só repassamos (ver SpedyService::enviarCertificadoEmpresa).
     */
    public function enviarCertificado(Request $request, Empresa $empresa, SpedyService $spedy): RedirectResponse
    {
        $data = $request->validate([
            'certificado' => ['required', 'file', 'max:5120'],
            'senha_certificado' => ['required', 'string'],
        ]);

        try {
            $spedy->enviarCertificadoEmpresa($empresa, $data['certificado'], $data['senha_certificado']);
        } catch (Throwable $e) {
            return redirect()->route('admin.empresas.edit', $empresa)->with('erro', 'Falha ao enviar certificado: '.$e->getMessage());
        }

        return redirect()->route('admin.empresas.edit', $empresa)->with('sucesso', 'Certificado enviado com sucesso.');
    }

    /**
     * MDF-e/NFC-e/NF-e emitidos direto na SEFAZ — sem gateway guardando o
     * certificado pra gente, ele precisa ficar aqui (criptografado, ver
     * Empresa::casts). É o MESMO arquivo pros três tipos de documento
     * (mesmo CNPJ assinando), um upload só. Serve de fallback pras lojas
     * com o mesmo CNPJ da empresa (ver Loja::usaMesmoCnpjDaEmpresa).
     */
    public function enviarCertificadoFiscal(Request $request, Empresa $empresa): RedirectResponse
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
            return redirect()->route('admin.empresas.edit', $empresa)->with('erro', 'Certificado ou senha inválidos: '.$e->getMessage());
        }

        $empresa->update([
            'certificado' => file_get_contents($data['certificado']->getRealPath()),
            'certificado_senha' => $data['senha_certificado'],
        ]);

        return redirect()->route('admin.empresas.edit', $empresa)->with('sucesso', 'Certificado salvo com sucesso.');
    }

    public function destroy(Empresa $empresa): RedirectResponse
    {
        if ($empresa->users()->exists() || $empresa->lojas()->exists()) {
            return redirect()->route('admin.empresas.index')->with('erro', 'Não é possível excluir uma empresa com lojas ou usuários cadastrados — desative em vez de excluir.');
        }

        $empresa->delete();

        return redirect()->route('admin.empresas.index')->with('sucesso', 'Empresa excluída com sucesso.');
    }
}
