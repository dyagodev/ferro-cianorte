@extends('admin.layout')

@section('titulo', $usuario->exists ? 'Editar usuário' : 'Novo usuário')

@section('conteudo')
    <h1 style="font-size: 20px;">{{ $usuario->exists ? 'Editar usuário' : 'Novo usuário' }}</h1>

    <div class="card">
        <form method="POST" action="{{ $usuario->exists ? route('admin.usuarios.update', $usuario) : route('admin.usuarios.store') }}">
            @csrf
            @if ($usuario->exists)
                @method('PUT')
            @endif

            <label for="name">Nome</label>
            <input type="text" id="name" name="name" value="{{ old('name', $usuario->name) }}" required autofocus>
            @error('name') <div class="erro">{{ $message }}</div> @enderror

            <label for="email">E-mail</label>
            <input type="email" id="email" name="email" value="{{ old('email', $usuario->email) }}" required>
            @error('email') <div class="erro">{{ $message }}</div> @enderror

            <label for="password">Senha @if ($usuario->exists) <span class="ajuda">(deixe em branco para manter a atual)</span> @endif</label>
            <input type="password" id="password" name="password" autocomplete="new-password" {{ $usuario->exists ? '' : 'required' }}>
            <div class="ajuda">Mínimo de 6 caracteres.</div>
            @error('password') <div class="erro">{{ $message }}</div> @enderror

            <label for="role">Papel</label>
            <select id="role" name="role" required onchange="alternarLoja(this.value)">
                <option value="vendedor" @selected(old('role', $usuario->role) === 'vendedor')>Vendedor</option>
                <option value="admin" @selected(old('role', $usuario->role) === 'admin')>Admin</option>
            </select>
            @error('role') <div class="erro">{{ $message }}</div> @enderror

            <div id="campo-loja">
                <label for="loja_id">Loja</label>
                <select id="loja_id" name="loja_id">
                    <option value="">Selecione...</option>
                    @foreach ($lojas as $loja)
                        <option value="{{ $loja->id }}" @selected(old('loja_id', $usuario->loja_id) == $loja->id)>{{ $loja->nome }}</option>
                    @endforeach
                </select>
                <div class="ajuda">Obrigatório para vendedor — fica preso a essa loja no PDV. Admin não precisa (vê/vende em qualquer loja).</div>
                @error('loja_id') <div class="erro">{{ $message }}</div> @enderror
            </div>

            <div style="margin-top: 24px; display:flex; gap: 10px; align-items:center;">
                <button type="submit" class="btn">Salvar</button>
                <a href="{{ route('admin.usuarios.index') }}" style="color:#6b7280; font-size:14px;">Cancelar</a>
            </div>
        </form>
    </div>

    <script>
        function alternarLoja(papel) {
            document.getElementById('campo-loja').style.display = papel === 'admin' ? 'none' : 'block';
        }
        alternarLoja(document.getElementById('role').value);
    </script>
@endsection
