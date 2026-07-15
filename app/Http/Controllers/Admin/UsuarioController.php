<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\View\View;

class UsuarioController extends Controller
{
    public function index(): View
    {
        $usuarios = User::with('loja')->orderBy('name')->get();

        return view('admin.usuarios.index', compact('usuarios'));
    }

    public function create(): View
    {
        $lojas = Loja::orderBy('nome')->get();

        return view('admin.usuarios.form', [
            'usuario' => new User,
            'lojas' => $lojas,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validarDados($request);
        $data['password'] = Hash::make($data['password']);

        User::create($data);

        return redirect()->route('admin.usuarios.index')->with('sucesso', 'Usuário criado com sucesso.');
    }

    public function edit(User $usuario): View
    {
        $lojas = Loja::orderBy('nome')->get();

        return view('admin.usuarios.form', [
            'usuario' => $usuario,
            'lojas' => $lojas,
        ]);
    }

    public function update(Request $request, User $usuario): RedirectResponse
    {
        $data = $this->validarDados($request, atualizando: true, usuario: $usuario);

        // Senha em branco na edição = manter a senha já salva (não sobrescrever com vazio).
        if (($data['password'] ?? '') === '') {
            unset($data['password']);
        } else {
            $data['password'] = Hash::make($data['password']);
        }

        // Sem isso, o próprio admin logado poderia se rebaixar a vendedor e
        // ficar trancado fora da área admin (nenhum outro admin pra
        // reverter, se for o único).
        if ($usuario->id === $request->user()->id && ($data['role'] ?? $usuario->role) !== 'admin') {
            return back()->withErrors(['role' => 'Você não pode remover seu próprio acesso de administrador.'])->withInput();
        }

        $usuario->update($data);

        return redirect()->route('admin.usuarios.index')->with('sucesso', 'Usuário atualizado com sucesso.');
    }

    public function destroy(Request $request, User $usuario): RedirectResponse
    {
        if ($usuario->id === $request->user()->id) {
            return redirect()->route('admin.usuarios.index')->with('erro', 'Você não pode excluir seu próprio usuário.');
        }

        if ($usuario->role === 'admin' && User::where('role', 'admin')->count() <= 1) {
            return redirect()->route('admin.usuarios.index')->with('erro', 'Não é possível excluir o último administrador do sistema.');
        }

        $usuario->delete();

        return redirect()->route('admin.usuarios.index')->with('sucesso', 'Usuário excluído com sucesso.');
    }

    private function validarDados(Request $request, bool $atualizando = false, ?User $usuario = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,'.($usuario?->id ?? 'NULL').',id'],
            'password' => [$atualizando ? 'nullable' : 'required', 'string', 'min:6'],
            'role' => ['required', 'in:admin,vendedor'],
            'loja_id' => ['required_if:role,vendedor', 'nullable', 'exists:lojas,id'],
        ]);

        // Admin não fica preso a uma loja (pode ver/vender em qualquer uma
        // na tela de PDV) — só vendedor tem loja fixa.
        if ($data['role'] === 'admin') {
            $data['loja_id'] = null;
        }

        return $data;
    }
}
