<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function showLoginForm()
    {
        if (Auth::check()) {
            return redirect()->to($this->rotaInicial(Auth::user()));
        }

        return view('admin.auth.login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'Credenciais inválidas.'])->onlyInput('email');
        }

        $usuario = Auth::user();
        if (! $usuario->isAdmin() && ! $usuario->isSuperAdmin()) {
            Auth::logout();

            return back()->withErrors(['email' => 'Acesso restrito a administradores.'])->onlyInput('email');
        }

        $request->session()->regenerate();

        return redirect()->intended($this->rotaInicial($usuario));
    }

    // super_admin (DM Tecnologia) não tem acesso à tela de sincronização —
    // aquilo é operacional de uma empresa cliente específica.
    private function rotaInicial($usuario): string
    {
        return $usuario->isSuperAdmin() ? route('admin.empresas.index') : route('admin.sync-conexoes.index');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login');
    }
}
