<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class FuncionarioController extends Controller
{
    public function index()
    {
        return User::with('loja')->orderBy('name')->get()
            ->map(fn (User $user) => $user->only(['id', 'name', 'email', 'role', 'loja_id']));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'in:admin,vendedor'],
            'loja_id' => ['required_if:role,vendedor', 'nullable', 'exists:lojas,id'],
        ]);

        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'loja_id']), 201);
    }

    public function show(User $funcionario)
    {
        return $funcionario->only(['id', 'name', 'email', 'role', 'loja_id']);
    }

    public function update(Request $request, User $funcionario)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'unique:users,email,'.$funcionario->id],
            'password' => ['nullable', 'string', 'min:6'],
            'role' => ['sometimes', 'required', 'in:admin,vendedor'],
            'loja_id' => ['required_if:role,vendedor', 'nullable', 'exists:lojas,id'],
        ]);

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $funcionario->update($data);

        return $funcionario->only(['id', 'name', 'email', 'role', 'loja_id']);
    }

    public function destroy(User $funcionario)
    {
        $funcionario->delete();

        return response()->json(null, 204);
    }
}
