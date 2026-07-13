<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('titulo', 'Admin') — Ferro Cianorte</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f4f5f7;
            color: #1f2328;
        }
        header {
            background: #1f2937;
            color: #fff;
            padding: 14px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        header a { color: #fff; text-decoration: none; font-weight: 600; }
        header form button {
            background: transparent;
            border: 1px solid #4b5563;
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
        }
        main { max-width: 960px; margin: 32px auto; padding: 0 20px; }
        .card { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 14px; }
        th { color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 12px; }
        .btn {
            display: inline-block;
            background: #2563eb;
            color: #fff;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }
        .btn-secondary { background: #6b7280; }
        .btn-danger { background: #dc2626; }
        .btn-sm { padding: 4px 10px; font-size: 13px; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .alert { padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; }
        .alert-sucesso { background: #dcfce7; color: #166534; }
        .alert-erro { background: #fee2e2; color: #991b1b; }
        .badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .badge-ativo { background: #dcfce7; color: #166534; }
        .badge-inativo { background: #f3f4f6; color: #6b7280; }
        form.inline { display: inline; }
        label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 4px; }
        input[type=text], input[type=email], input[type=password], input[type=number], input[type=date], textarea, select {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
        }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
        .checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
        .checkbox-row input { width: auto; }
        .erro { color: #dc2626; font-size: 13px; margin-top: 4px; }
        .ajuda { color: #6b7280; font-size: 12px; margin-top: 4px; }
        #resultado-teste { margin-top: 12px; font-size: 14px; }
    </style>
</head>
<body>
    <header>
        <a href="{{ route('admin.sync-conexoes.index') }}">Admin — Sincronização de lojas</a>
        @auth
            <form method="POST" action="{{ route('admin.logout') }}">
                @csrf
                <button type="submit">Sair ({{ auth()->user()->name }})</button>
            </form>
        @endauth
    </header>
    <main>
        @if (session('sucesso'))
            <div class="alert alert-sucesso">{{ session('sucesso') }}</div>
        @endif
        @if (session('erro'))
            <div class="alert alert-erro">{{ session('erro') }}</div>
        @endif
        @yield('conteudo')
    </main>
</body>
</html>
