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

            @if ($empresa->exists)
                <div class="checkbox-row">
                    <input type="checkbox" id="ativo" name="ativo" value="1" @checked(old('ativo', $empresa->ativo))>
                    <label for="ativo" style="margin:0;">Empresa ativa</label>
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
@endsection
