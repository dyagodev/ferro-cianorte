<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Login — Admin</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f4f5f7;
        }
        .card { background: #fff; padding: 32px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.08); width: 340px; }
        h1 { font-size: 18px; margin: 0 0 20px; }
        label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 4px; }
        input { width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
        button { margin-top: 20px; width: 100%; background: #2563eb; color: #fff; border: none; padding: 10px; border-radius: 6px; font-size: 14px; cursor: pointer; }
        .erro { color: #dc2626; font-size: 13px; margin-top: 4px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Admin — Sincronização de lojas</h1>
        <form method="POST" action="{{ route('admin.login.attempt') }}">
            @csrf
            <label for="email">E-mail</label>
            <input type="email" id="email" name="email" value="{{ old('email') }}" required autofocus>

            <label for="password">Senha</label>
            <input type="password" id="password" name="password" required>

            @error('email')
                <div class="erro">{{ $message }}</div>
            @enderror

            <button type="submit">Entrar</button>
        </form>
    </div>
</body>
</html>
