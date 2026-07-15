@extends('admin.layout')

@section('titulo', 'Usuários')

@section('conteudo')
    <div class="toolbar">
        <h1 style="font-size: 20px; margin: 0;">Usuários</h1>
        <a href="{{ route('admin.usuarios.create') }}" class="btn">+ Novo usuário</a>
    </div>

    <div class="card">
        <table>
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Papel</th>
                    <th>Loja</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                @forelse ($usuarios as $usuario)
                    <tr>
                        <td>
                            {{ $usuario->name }}
                            @if ($usuario->id === auth()->id())
                                <span class="badge badge-ativo">você</span>
                            @endif
                        </td>
                        <td>{{ $usuario->email }}</td>
                        <td>
                            <span class="badge {{ $usuario->role === 'admin' ? 'badge-ativo' : 'badge-inativo' }}">
                                {{ $usuario->role === 'admin' ? 'Admin' : 'Vendedor' }}
                            </span>
                        </td>
                        <td>{{ $usuario->loja->nome ?? '—' }}</td>
                        <td style="text-align:right; white-space: nowrap;">
                            <a href="{{ route('admin.usuarios.edit', $usuario) }}" class="btn btn-secondary btn-sm">Editar</a>
                            @if ($usuario->id !== auth()->id())
                                <form class="inline" method="POST" action="{{ route('admin.usuarios.destroy', $usuario) }}" onsubmit="return confirm('Excluir o usuário {{ $usuario->name }}?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="btn btn-danger btn-sm">Excluir</button>
                                </form>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" style="text-align:center; color:#6b7280; padding: 24px;">
                            Nenhum usuário cadastrado ainda.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
