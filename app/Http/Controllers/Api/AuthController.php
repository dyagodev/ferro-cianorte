<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Auth::getProvider()->validateCredentials($user, ['password' => $credentials['password']])) {
            throw ValidationException::withMessages([
                'email' => ['Credenciais inválidas.'],
            ]);
        }

        $token = $user->createToken($credentials['device_name'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->dadosUsuario($user),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logout realizado.']);
    }

    public function me(Request $request)
    {
        return $this->dadosUsuario($request->user());
    }

    /**
     * A pergunta "emitir nota fiscal?" no fechamento da venda depende da
     * config fiscal da loja escolhida no momento — não do usuário — então
     * o PDV resolve isso sozinho a partir de GET /lojas (ver
     * Loja::possui_emissao_fiscal_configurada), sem precisar de nada aqui.
     */
    private function dadosUsuario(User $user): array
    {
        return $user->only(['id', 'name', 'email', 'role', 'loja_id']);
    }
}
