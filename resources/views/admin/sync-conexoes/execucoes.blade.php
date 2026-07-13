@extends('admin.layout')

@section('titulo', 'Execuções — '.$syncConexao->nome)

@section('conteudo')
    <div class="toolbar">
        <h1 style="font-size: 20px; margin: 0;">Execuções — {{ $syncConexao->nome }}</h1>
        <div style="display:flex; gap:10px;">
            <form method="POST" action="{{ route('admin.sync-conexoes.sincronizar', $syncConexao) }}">
                @csrf
                <button type="submit" class="btn">Sincronizar agora</button>
            </form>
            <form method="POST" action="{{ route('admin.sync-conexoes.reconciliar-estoque', $syncConexao) }}">
                @csrf
                <button type="submit" class="btn btn-secondary">Reconciliar estoque</button>
            </form>
            <a href="{{ route('admin.sync-conexoes.index') }}" class="btn btn-secondary">Voltar</a>
        </div>
    </div>

    <div class="card">
        <table>
            <thead>
                <tr>
                    <th>Início</th>
                    <th>Tipo</th>
                    <th>Duração</th>
                    <th>Status</th>
                    <th>Vendas</th>
                    <th>Estoque</th>
                    <th>Detalhes</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($execucoes as $execucao)
                    <tr>
                        <td>{{ $execucao->iniciado_em->timezone('America/Sao_Paulo')->format('d/m/Y H:i:s') }}</td>
                        <td style="font-size:13px;">{{ $execucao->tipo === 'reconciliacao_completa' ? 'reconciliação' : 'incremental' }}</td>
                        <td>
                            @if ($execucao->finalizado_em)
                                {{ $execucao->iniciado_em->diffInSeconds($execucao->finalizado_em) }}s
                            @else
                                —
                            @endif
                        </td>
                        <td>
                            @php
                                $cor = match ($execucao->status) {
                                    'sucesso' => 'badge-ativo',
                                    'erro' => 'badge-inativo',
                                    default => 'badge-inativo',
                                };
                            @endphp
                            <span class="badge {{ $cor }}" style="{{ $execucao->status === 'erro' ? 'background:#fee2e2;color:#991b1b;' : '' }}">
                                {{ $execucao->status }}
                            </span>
                        </td>
                        <td>{{ $execucao->vendas_sincronizadas }}</td>
                        <td>{{ $execucao->estoque_atualizado }}</td>
                        <td style="font-size:13px; max-width:420px;">
                            @if ($execucao->erro)
                                <div style="color:#dc2626;">{{ $execucao->erro }}</div>
                            @endif
                            @if (! empty($execucao->avisos))
                                <details>
                                    <summary style="cursor:pointer; color:#6b7280;">{{ count($execucao->avisos) }} aviso(s)</summary>
                                    <ul style="margin:6px 0 0; padding-left:18px;">
                                        @foreach ($execucao->avisos as $aviso)
                                            <li>{{ $aviso }}</li>
                                        @endforeach
                                    </ul>
                                </details>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="7" style="text-align:center; color:#6b7280; padding: 24px;">
                            Nenhuma execução registrada ainda.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
        <div style="margin-top:16px;">{{ $execucoes->links() }}</div>
    </div>
@endsection
