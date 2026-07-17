@extends('admin.layout')

@section('titulo', 'Empresas')

@section('conteudo')
    <div class="toolbar">
        <h1 style="font-size: 20px; margin: 0;">Empresas</h1>
        <a href="{{ route('admin.empresas.create') }}" class="btn">+ Nova empresa</a>
    </div>

    <div class="card">
        <table>
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Lojas</th>
                    <th>Usuários</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                @forelse ($empresas as $empresa)
                    <tr>
                        <td>{{ $empresa->nome }}</td>
                        <td>{{ $empresa->lojas_count }}</td>
                        <td>{{ $empresa->users_count }}</td>
                        <td>
                            <span class="badge {{ $empresa->ativo ? 'badge-ativo' : 'badge-inativo' }}">
                                {{ $empresa->ativo ? 'Ativa' : 'Inativa' }}
                            </span>
                        </td>
                        <td style="text-align:right; white-space: nowrap;">
                            <a href="{{ route('admin.empresas.edit', $empresa) }}" class="btn btn-secondary btn-sm">Editar</a>
                            <form class="inline" method="POST" action="{{ route('admin.empresas.destroy', $empresa) }}" onsubmit="return confirm('Excluir a empresa {{ $empresa->nome }}?');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger btn-sm">Excluir</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" style="text-align:center; color:#6b7280; padding: 24px;">
                            Nenhuma empresa cadastrada ainda.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
