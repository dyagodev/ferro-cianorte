<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\View\View;

/**
 * Só super_admin acessa (ver rota) — provisiona empresa cliente nova. Cria
 * junto o primeiro usuário admin dela: sem isso a empresa nasceria sem
 * ninguém capaz de logar (Empresa não tem ligação nenhuma com quem a
 * criou, é um tenant novo do zero).
 */
class EmpresaController extends Controller
{
    public function index(): View
    {
        $empresas = Empresa::withCount(['lojas', 'users'])->orderBy('nome')->get();

        return view('admin.empresas.index', compact('empresas'));
    }

    public function create(): View
    {
        return view('admin.empresas.form', ['empresa' => new Empresa]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'admin_nome' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'admin_password' => ['required', 'string', 'min:6'],
        ]);

        $empresa = Empresa::create(['nome' => $data['nome'], 'ativo' => true]);

        // empresa_id explícito (não passa pelo fillable de propósito) —
        // TenantContext::id() aqui resolveria pra empresa do super_admin
        // logado (DM Tecnologia), não pra empresa nova que acabou de criar.
        $admin = new User([
            'name' => $data['admin_nome'],
            'email' => $data['admin_email'],
            'password' => Hash::make($data['admin_password']),
            'role' => 'admin',
        ]);
        $admin->empresa_id = $empresa->id;
        $admin->save();

        return redirect()->route('admin.empresas.index')->with('sucesso', "Empresa \"{$empresa->nome}\" criada, com {$admin->email} como administrador.");
    }

    public function edit(Empresa $empresa): View
    {
        return view('admin.empresas.form', compact('empresa'));
    }

    public function update(Request $request, Empresa $empresa): RedirectResponse
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'ativo' => ['boolean'],
            'regime_tributario' => ['required', 'in:simples_nacional,lucro_presumido,lucro_real'],
        ]);
        $data['ativo'] = $request->boolean('ativo');

        $empresa->update($data);

        return redirect()->route('admin.empresas.index')->with('sucesso', 'Empresa atualizada com sucesso.');
    }

    public function destroy(Empresa $empresa): RedirectResponse
    {
        if ($empresa->users()->exists() || $empresa->lojas()->exists()) {
            return redirect()->route('admin.empresas.index')->with('erro', 'Não é possível excluir uma empresa com lojas ou usuários cadastrados — desative em vez de excluir.');
        }

        $empresa->delete();

        return redirect()->route('admin.empresas.index')->with('sucesso', 'Empresa excluída com sucesso.');
    }
}
