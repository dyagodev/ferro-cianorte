@extends('admin.layout')

@section('titulo', 'Conexões de sincronização')

@section('conteudo')
    <div class="toolbar">
        <h1 style="font-size: 20px; margin: 0;">Conexões de sincronização (Link Pro)</h1>
        <a href="{{ route('admin.sync-conexoes.create') }}" class="btn">+ Nova conexão</a>
    </div>

    <div class="card">
        <table>
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Loja</th>
                    <th>Host</th>
                    <th>Banco</th>
                    <th>Horários</th>
                    <th>Status</th>
                    <th>Última sincronização</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                @forelse ($conexoes as $conexao)
                    <tr>
                        <td>{{ $conexao->nome }}</td>
                        <td>{{ $conexao->loja->nome ?? '—' }}</td>
                        <td>{{ $conexao->host }}:{{ $conexao->porta }}</td>
                        <td>{{ $conexao->database }}</td>
                        <td style="font-size:13px;">
                            @forelse ($conexao->janelas_funcionamento ?? [] as $janela)
                                <div>{{ $janela['inicio'] }}–{{ $janela['fim'] }}</div>
                            @empty
                                <span style="color:#6b7280;">dia todo</span>
                            @endforelse
                        </td>
                        <td>
                            <span class="badge {{ $conexao->ativo ? 'badge-ativo' : 'badge-inativo' }}">
                                {{ $conexao->ativo ? 'Ativa' : 'Inativa' }}
                            </span>
                        </td>
                        <td>
                            {{ $conexao->ultima_sincronizacao_em?->format('d/m/Y H:i') ?? 'nunca' }}
                            @if ($conexao->ultimo_erro)
                                <div style="color:#dc2626; font-size:12px;" title="{{ $conexao->ultimo_erro }}">⚠ último erro</div>
                            @endif
                        </td>
                        <td style="text-align:right; white-space: nowrap;">
                            <form class="inline" method="POST" action="{{ route('admin.sync-conexoes.sincronizar', $conexao) }}">
                                @csrf
                                <button type="submit" class="btn btn-sm">Sincronizar agora</button>
                            </form>
                            <a href="{{ route('admin.sync-conexoes.execucoes', $conexao) }}" class="btn btn-secondary btn-sm">Execuções</a>
                            <a href="{{ route('admin.sync-conexoes.edit', $conexao) }}" class="btn btn-secondary btn-sm">Editar</a>
                            <form class="inline" method="POST" action="{{ route('admin.sync-conexoes.destroy', $conexao) }}" onsubmit="return confirm('Remover esta conexão?');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger btn-sm">Excluir</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="8" style="text-align:center; color:#6b7280; padding: 24px;">
                            Nenhuma conexão cadastrada ainda.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
