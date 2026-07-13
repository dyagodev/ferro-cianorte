@extends('admin.layout')

@section('titulo', $conexao->exists ? 'Editar conexão' : 'Nova conexão')

@section('conteudo')
    <h1 style="font-size: 20px;">{{ $conexao->exists ? 'Editar conexão' : 'Nova conexão' }}</h1>

    <div class="card">
        <form method="POST" action="{{ $conexao->exists ? route('admin.sync-conexoes.update', $conexao) : route('admin.sync-conexoes.store') }}">
            @csrf
            @if ($conexao->exists)
                @method('PUT')
            @endif

            <label for="nome">Nome (identificação interna)</label>
            <input type="text" id="nome" name="nome" value="{{ old('nome', $conexao->nome) }}" required>
            @error('nome') <div class="erro">{{ $message }}</div> @enderror

            <label for="loja_id">Loja (destino no Ferro Cianorte)</label>
            <select id="loja_id" name="loja_id" required>
                <option value="">Selecione...</option>
                @foreach ($lojas as $loja)
                    <option value="{{ $loja->id }}" @selected(old('loja_id', $conexao->loja_id) == $loja->id)>{{ $loja->nome }}</option>
                @endforeach
            </select>
            @error('loja_id') <div class="erro">{{ $message }}</div> @enderror

            <div class="grid-2">
                <div>
                    <label for="host">Host</label>
                    <input type="text" id="host" name="host" value="{{ old('host', $conexao->host) }}" required>
                    @error('host') <div class="erro">{{ $message }}</div> @enderror
                </div>
                <div>
                    <label for="porta">Porta</label>
                    <input type="number" id="porta" name="porta" value="{{ old('porta', $conexao->porta ?? 5432) }}" required>
                    @error('porta') <div class="erro">{{ $message }}</div> @enderror
                </div>
            </div>

            <label for="database">Banco de dados</label>
            <input type="text" id="database" name="database" value="{{ old('database', $conexao->database) }}" required>
            @error('database') <div class="erro">{{ $message }}</div> @enderror

            <div class="grid-2">
                <div>
                    <label for="usuario">Usuário</label>
                    <input type="text" id="usuario" name="usuario" value="{{ old('usuario', $conexao->usuario) }}" required>
                    @error('usuario') <div class="erro">{{ $message }}</div> @enderror
                </div>
                <div>
                    <label for="senha">Senha @if ($conexao->exists) <span class="ajuda">(deixe em branco para manter a atual)</span> @endif</label>
                    <input type="password" id="senha" name="senha" autocomplete="new-password" {{ $conexao->exists ? '' : 'required' }}>
                    @error('senha') <div class="erro">{{ $message }}</div> @enderror
                </div>
            </div>

            <div class="checkbox-row">
                <input type="checkbox" id="ssl" name="ssl" value="1" @checked(old('ssl', $conexao->ssl))>
                <label for="ssl" style="margin:0;">Exigir SSL</label>
            </div>
            <div class="checkbox-row">
                <input type="checkbox" id="ativo" name="ativo" value="1" @checked(old('ativo', $conexao->ativo ?? true))>
                <label for="ativo" style="margin:0;">Ativa (participa da sincronização)</label>
            </div>

            <label for="sync_desde">Sincronizar vendas a partir de</label>
            <input type="date" id="sync_desde" name="sync_desde" value="{{ old('sync_desde', $conexao->sync_desde?->format('Y-m-d')) }}">
            <div class="ajuda">Vendas anteriores a esta data nunca são trazidas (evita replicar histórico antigo). Deixe em branco para usar a data de hoje na primeira sincronização.</div>
            @error('sync_desde') <div class="erro">{{ $message }}</div> @enderror

            <label>Horários de funcionamento (janelas em que o command deve sincronizar)</label>
            <div class="ajuda" style="margin-top:-2px;">
                Sem nenhuma janela, sincroniza o dia todo. Com janelas, só roda dentro delas
                — ex.: loja abre 07:30, fecha pro almoço às 11:30, reabre 13:30, fecha 17:30
                (duas linhas: 07:30–11:30 e 13:30–17:30).
            </div>
            <div id="janelas" style="margin-top:10px;">
                @php
                    $janelasExistentes = old('janela_inicio')
                        ? collect(old('janela_inicio'))->map(fn ($inicio, $i) => ['inicio' => $inicio, 'fim' => old('janela_fim')[$i] ?? ''])->values()->all()
                        : ($conexao->janelas_funcionamento ?? []);
                @endphp
                @foreach ($janelasExistentes as $janela)
                    <div class="janela-linha" style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
                        <input type="time" name="janela_inicio[]" value="{{ $janela['inicio'] ?? '' }}" style="width:auto;">
                        <span>até</span>
                        <input type="time" name="janela_fim[]" value="{{ $janela['fim'] ?? '' }}" style="width:auto;">
                        <button type="button" class="btn btn-danger btn-sm remover-janela">Remover</button>
                    </div>
                @endforeach
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-janela">+ Adicionar janela de horário</button>
            @error('janela_inicio.*') <div class="erro">{{ $message }}</div> @enderror
            @error('janela_fim.*') <div class="erro">{{ $message }}</div> @enderror

            <label for="mapa_formas_pagamento">Mapeamento de formas de pagamento (JSON, opcional)</label>
            <textarea id="mapa_formas_pagamento" name="mapa_formas_pagamento" rows="3" placeholder='{"Dinheiro":"dinheiro","Pix":"pix","Cartao":"cartao"}'>{{ old('mapa_formas_pagamento', $conexao->mapa_formas_pagamento ? json_encode($conexao->mapa_formas_pagamento, JSON_UNESCAPED_UNICODE) : '') }}</textarea>
            @error('mapa_formas_pagamento') <div class="erro">{{ $message }}</div> @enderror

            <div style="margin-top: 24px; display:flex; gap: 10px; align-items:center;">
                <button type="submit" class="btn">Salvar</button>
                <button type="button" class="btn btn-secondary" id="btn-testar">Testar conexão</button>
                <a href="{{ route('admin.sync-conexoes.index') }}" style="color:#6b7280; font-size:14px;">Cancelar</a>
            </div>
            <div id="resultado-teste"></div>
        </form>
    </div>

    <script>
        document.getElementById('btn-add-janela').addEventListener('click', function () {
            const container = document.getElementById('janelas');
            const linha = document.createElement('div');
            linha.className = 'janela-linha';
            linha.style.cssText = 'display:flex; gap:10px; align-items:center; margin-bottom:8px;';
            linha.innerHTML = `
                <input type="time" name="janela_inicio[]" style="width:auto;">
                <span>até</span>
                <input type="time" name="janela_fim[]" style="width:auto;">
                <button type="button" class="btn btn-danger btn-sm remover-janela">Remover</button>
            `;
            container.appendChild(linha);
        });

        document.getElementById('janelas').addEventListener('click', function (evento) {
            if (evento.target.classList.contains('remover-janela')) {
                evento.target.closest('.janela-linha').remove();
            }
        });

        document.getElementById('btn-testar').addEventListener('click', async function () {
            const resultado = document.getElementById('resultado-teste');
            resultado.textContent = 'Testando...';
            resultado.style.color = '#6b7280';

            try {
                const resposta = await fetch(@json(route('admin.sync-conexoes.testar')), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': @json(csrf_token()),
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        id: @json($conexao->id),
                        host: document.getElementById('host').value,
                        porta: Number(document.getElementById('porta').value),
                        database: document.getElementById('database').value,
                        usuario: document.getElementById('usuario').value,
                        senha: document.getElementById('senha').value,
                        ssl: document.getElementById('ssl').checked,
                    }),
                });
                const dados = await resposta.json();
                resultado.textContent = dados.mensagem;
                resultado.style.color = dados.sucesso ? '#166534' : '#dc2626';
            } catch (erro) {
                resultado.textContent = 'Falha ao testar: ' + erro.message;
                resultado.style.color = '#dc2626';
            }
        });
    </script>
@endsection
