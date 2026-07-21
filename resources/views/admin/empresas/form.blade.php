@extends('admin.layout')

@section('titulo', $empresa->exists ? 'Editar empresa' : 'Nova empresa')

@section('conteudo')
    <h1 style="font-size: 20px;">{{ $empresa->exists ? 'Editar empresa' : 'Nova empresa' }}</h1>

    <div class="card">
        <form method="POST" action="{{ $empresa->exists ? route('admin.empresas.update', $empresa) : route('admin.empresas.store') }}">
            @csrf
            @if ($empresa->exists)
                @method('PUT')
            @endif

            <label for="nome">Nome da empresa</label>
            <input type="text" id="nome" name="nome" value="{{ old('nome', $empresa->nome) }}" required autofocus>
            @error('nome') <div class="erro">{{ $message }}</div> @enderror

            <label for="cnpj">CNPJ</label>
            <div style="display:flex; gap:8px; align-items:flex-start;">
                <input type="text" id="cnpj" name="cnpj" value="{{ old('cnpj', $empresa->cnpj) }}" placeholder="00.000.000/0001-00" style="flex:1;">
                <button type="button" class="btn btn-secondary" id="btn-buscar-cnpj" style="white-space:nowrap;">Buscar CNPJ</button>
            </div>
            <div class="ajuda">Preenche razão social e endereço automaticamente (consulta pública na Receita).</div>
            @error('cnpj') <div class="erro">{{ $message }}</div> @enderror

            <label for="razao_social">Razão social</label>
            <input type="text" id="razao_social" name="razao_social" value="{{ old('razao_social', $empresa->razao_social) }}">
            @error('razao_social') <div class="erro">{{ $message }}</div> @enderror

            <label for="endereco">Endereço</label>
            <input type="text" id="endereco" name="endereco" value="{{ old('endereco', $empresa->endereco) }}">
            @error('endereco') <div class="erro">{{ $message }}</div> @enderror

            <div id="resultado-cnpj" class="ajuda"></div>

            @if ($empresa->exists)
                <label for="regime_tributario">Regime tributário</label>
                <select id="regime_tributario" name="regime_tributario">
                    <option value="simples_nacional" @selected(old('regime_tributario', $empresa->regime_tributario) === 'simples_nacional')>Simples Nacional</option>
                    <option value="lucro_presumido" @selected(old('regime_tributario', $empresa->regime_tributario) === 'lucro_presumido')>Lucro Presumido</option>
                    <option value="lucro_real" @selected(old('regime_tributario', $empresa->regime_tributario) === 'lucro_real')>Lucro Real</option>
                </select>
                <div class="ajuda">Define se os grupos fiscais dela usam CSOSN (Simples) ou CST (Presumido/Real).</div>
                @error('regime_tributario') <div class="erro">{{ $message }}</div> @enderror

                <div class="checkbox-row">
                    <input type="checkbox" id="ativo" name="ativo" value="1" @checked(old('ativo', $empresa->ativo))>
                    <label for="ativo" style="margin:0;">Empresa ativa</label>
                </div>

                <h2 style="font-size:16px; margin-top:28px;">Integração fiscal (Spedy)</h2>
                <p class="ajuda">Emissão de NFC-e/NF-e/NFS-e pra essa empresa. Deixe os campos sensíveis em branco pra manter o valor já salvo.</p>

                <label for="spedy_ambiente">Ambiente</label>
                <select id="spedy_ambiente" name="spedy_ambiente">
                    <option value="sandbox" @selected(old('spedy_ambiente', $empresa->spedy_ambiente) === 'sandbox')>Sandbox (testes)</option>
                    <option value="producao" @selected(old('spedy_ambiente', $empresa->spedy_ambiente) === 'producao')>Produção</option>
                </select>
                @error('spedy_ambiente') <div class="erro">{{ $message }}</div> @enderror

                <label for="spedy_company_id">Company ID (Spedy)</label>
                <input type="text" id="spedy_company_id" name="spedy_company_id" value="{{ old('spedy_company_id', $empresa->spedy_company_id) }}">
                <div class="ajuda">ID da empresa dentro do painel da Spedy — diferente da API Key, é usado pra apontar o envio do certificado digital (abaixo).</div>
                @error('spedy_company_id') <div class="erro">{{ $message }}</div> @enderror

                <div class="grid-2">
                    <div>
                        <label for="spedy_api_key">API Key</label>
                        <input type="password" id="spedy_api_key" name="spedy_api_key" autocomplete="off" placeholder="{{ $empresa->spedy_api_key ? '••••••••• (já configurada)' : 'não configurada' }}">
                        @error('spedy_api_key') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                    <div>
                        <label for="spedy_csc">CSC</label>
                        <input type="password" id="spedy_csc" name="spedy_csc" autocomplete="off" placeholder="{{ $empresa->spedy_csc ? '••••••••• (já configurado)' : 'não configurado' }}">
                        @error('spedy_csc') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                </div>

                <div class="grid-2">
                    <div>
                        <label for="spedy_token_id">Token ID</label>
                        <input type="text" id="spedy_token_id" name="spedy_token_id" value="{{ old('spedy_token_id', $empresa->spedy_token_id) }}">
                        @error('spedy_token_id') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                    <div>
                        <label for="spedy_serie_nfce">Série NFC-e</label>
                        <input type="text" id="spedy_serie_nfce" name="spedy_serie_nfce" value="{{ old('spedy_serie_nfce', $empresa->spedy_serie_nfce) }}">
                        @error('spedy_serie_nfce') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                </div>

                <h2 style="font-size:16px; margin-top:28px;">MDF-e (padrão pras lojas)</h2>
                <p class="ajuda">
                    Emitido direto na SEFAZ, sem gateway. Vale como padrão só pras lojas que usam o mesmo CNPJ da
                    empresa (loja com CNPJ próprio precisa do certificado dela mesma) — ver cadastro de cada loja.
                    Use <strong>Simulado</strong> pra testar sem certificado nem conta na SEFAZ ainda.
                </p>

                <div class="grid-2">
                    <div>
                        <label for="mdfe_ambiente">Ambiente</label>
                        <select id="mdfe_ambiente" name="mdfe_ambiente">
                            <option value="simulado" @selected(old('mdfe_ambiente', $empresa->mdfe_ambiente) === 'simulado')>Simulado (teste sem SEFAZ)</option>
                            <option value="sandbox" @selected(old('mdfe_ambiente', $empresa->mdfe_ambiente) === 'sandbox')>Homologação (SEFAZ real)</option>
                            <option value="producao" @selected(old('mdfe_ambiente', $empresa->mdfe_ambiente) === 'producao')>Produção</option>
                        </select>
                        @error('mdfe_ambiente') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                    <div>
                        <label for="mdfe_rntrc">RNTRC</label>
                        <input type="text" id="mdfe_rntrc" name="mdfe_rntrc" value="{{ old('mdfe_rntrc', $empresa->mdfe_rntrc) }}">
                        @error('mdfe_rntrc') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                </div>

                <h2 style="font-size:16px; margin-top:28px;">NFC-e direta (padrão pras lojas)</h2>
                <p class="ajuda">
                    Alternativa à Spedy sem taxa por documento (ver <code>emissao_fiscal_modo</code> de cada loja).
                    CSC e CSC ID vêm do credenciamento na SEFAZ do estado, não são gerados por nós.
                </p>

                <div class="grid-2">
                    <div>
                        <label for="nfce_ambiente">Ambiente</label>
                        <select id="nfce_ambiente" name="nfce_ambiente">
                            <option value="sandbox" @selected(old('nfce_ambiente', $empresa->nfce_ambiente) === 'sandbox')>Homologação (SEFAZ real)</option>
                            <option value="producao" @selected(old('nfce_ambiente', $empresa->nfce_ambiente) === 'producao')>Produção</option>
                        </select>
                        @error('nfce_ambiente') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                    <div>
                        <label for="nfce_serie">Série NFC-e</label>
                        <input type="text" id="nfce_serie" name="nfce_serie" value="{{ old('nfce_serie', $empresa->nfce_serie) }}">
                        @error('nfce_serie') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                </div>

                <div class="grid-2">
                    <div>
                        <label for="nfce_csc_id">CSC ID</label>
                        <input type="text" id="nfce_csc_id" name="nfce_csc_id" value="{{ old('nfce_csc_id', $empresa->nfce_csc_id) }}">
                        @error('nfce_csc_id') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                    <div>
                        <label for="nfce_csc">CSC</label>
                        <input type="password" id="nfce_csc" name="nfce_csc" autocomplete="off" placeholder="{{ $empresa->nfce_csc ? '••••••••• (já configurado)' : 'não configurado' }}">
                        @error('nfce_csc') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                </div>

                <h2 style="font-size:16px; margin-top:28px;">NF-e direta (padrão pras lojas)</h2>
                <p class="ajuda">
                    Venda de atacado/revenda pra outro CNPJ — segue o mesmo <code>emissao_fiscal_modo</code> da NFC-e,
                    mas com certificado e série próprios.
                </p>

                <div class="grid-2">
                    <div>
                        <label for="nfe_ambiente">Ambiente</label>
                        <select id="nfe_ambiente" name="nfe_ambiente">
                            <option value="sandbox" @selected(old('nfe_ambiente', $empresa->nfe_ambiente) === 'sandbox')>Homologação (SEFAZ real)</option>
                            <option value="producao" @selected(old('nfe_ambiente', $empresa->nfe_ambiente) === 'producao')>Produção</option>
                        </select>
                        @error('nfe_ambiente') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                    <div>
                        <label for="nfe_serie">Série NF-e</label>
                        <input type="text" id="nfe_serie" name="nfe_serie" value="{{ old('nfe_serie', $empresa->nfe_serie) }}">
                        @error('nfe_serie') <div class="erro">{{ $message }}</div> @enderror
                    </div>
                </div>
            @else
                <p class="ajuda" style="margin-top:20px;">O primeiro administrador da empresa — é quem ela vai usar pra logar e cadastrar o resto (lojas, produtos, outros usuários).</p>

                <label for="admin_nome">Nome do administrador</label>
                <input type="text" id="admin_nome" name="admin_nome" value="{{ old('admin_nome') }}" required>
                @error('admin_nome') <div class="erro">{{ $message }}</div> @enderror

                <label for="admin_email">E-mail do administrador</label>
                <input type="email" id="admin_email" name="admin_email" value="{{ old('admin_email') }}" required>
                @error('admin_email') <div class="erro">{{ $message }}</div> @enderror

                <label for="admin_password">Senha</label>
                <input type="password" id="admin_password" name="admin_password" autocomplete="new-password" required>
                <div class="ajuda">Mínimo de 6 caracteres.</div>
                @error('admin_password') <div class="erro">{{ $message }}</div> @enderror
            @endif

            <div style="margin-top: 24px; display:flex; gap: 10px; align-items:center;">
                <button type="submit" class="btn">Salvar</button>
                <a href="{{ route('admin.empresas.index') }}" style="color:#6b7280; font-size:14px;">Cancelar</a>
            </div>
        </form>
    </div>

    @if ($empresa->exists)
        <div class="card" style="margin-top:20px;">
            <h2 style="font-size:16px; margin:0 0 4px;">Certificado digital (A1)</h2>
            <p class="ajuda">Sobe o arquivo .pfx direto pra Spedy — ela guarda e usa pra assinar as notas, não fica salvo aqui. Precisa do Company ID e da API Key configurados acima antes de enviar.</p>

            <form method="POST" action="{{ route('admin.empresas.spedy-certificado', $empresa) }}" enctype="multipart/form-data">
                @csrf
                <label for="certificado">Arquivo (.pfx)</label>
                <input type="file" id="certificado" name="certificado" accept=".pfx,.p12" required>
                @error('certificado') <div class="erro">{{ $message }}</div> @enderror

                <label for="senha_certificado">Senha do certificado</label>
                <input type="password" id="senha_certificado" name="senha_certificado" autocomplete="off" required>
                @error('senha_certificado') <div class="erro">{{ $message }}</div> @enderror

                <div style="margin-top: 16px;">
                    <button type="submit" class="btn btn-secondary">Enviar certificado</button>
                </div>
            </form>
        </div>

        <div class="card" style="margin-top:20px;">
            <h2 style="font-size:16px; margin:0 0 4px;">Certificado digital (A1) — MDF-e / NFC-e / NF-e</h2>
            <p class="ajuda">Fica guardado aqui, criptografado — é o MESMO arquivo usado pra assinar MDF-e, NFC-e e NF-e emitidos direto na SEFAZ (mesmo CNPJ assinando os três), não precisa subir de novo por tipo. Serve de padrão pras lojas com o mesmo CNPJ da empresa.</p>

            <form method="POST" action="{{ route('admin.empresas.certificado-fiscal', $empresa) }}" enctype="multipart/form-data">
                @csrf
                <label for="certificado_fiscal">Arquivo (.pfx)</label>
                <input type="file" id="certificado_fiscal" name="certificado" accept=".pfx,.p12" required>

                <label for="senha_certificado_fiscal">Senha do certificado</label>
                <input type="password" id="senha_certificado_fiscal" name="senha_certificado" autocomplete="off" required>

                <div style="margin-top: 16px;">
                    <button type="submit" class="btn btn-secondary">Enviar certificado</button>
                </div>
            </form>
        </div>
    @endif

    <script>
        document.getElementById('btn-buscar-cnpj').addEventListener('click', async function () {
            const cnpjInput = document.getElementById('cnpj');
            const resultado = document.getElementById('resultado-cnpj');
            const cnpjLimpo = cnpjInput.value.replace(/\D/g, '');

            if (cnpjLimpo.length !== 14) {
                resultado.textContent = 'Digite um CNPJ válido (14 dígitos).';
                resultado.style.color = '#dc2626';
                return;
            }

            resultado.textContent = 'Buscando...';
            resultado.style.color = '#6b7280';

            try {
                const resposta = await fetch(`{{ url('admin/empresas/consulta-cnpj') }}/${cnpjLimpo}`, {
                    headers: { 'Accept': 'application/json' },
                });
                const dados = await resposta.json();

                if (!resposta.ok) {
                    resultado.textContent = dados.message ?? 'Não foi possível consultar o CNPJ.';
                    resultado.style.color = '#dc2626';
                    return;
                }

                document.getElementById('razao_social').value = dados.razao_social ?? '';
                document.getElementById('endereco').value = dados.endereco ?? '';
                resultado.textContent = 'Dados preenchidos a partir do CNPJ.';
                resultado.style.color = '#166534';
            } catch (erro) {
                resultado.textContent = 'Falha ao consultar: ' + erro.message;
                resultado.style.color = '#dc2626';
            }
        });
    </script>
@endsection
