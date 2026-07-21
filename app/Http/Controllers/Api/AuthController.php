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
     * possui_spedy_configurado informa o front se vale a pena mostrar a
     * pergunta "emitir nota fiscal?" no fechamento da venda — sem config
     * nenhuma (Spedy OU NFC-e direta, nem na loja nem na empresa) nunca
     * emite mesmo, então nem mostramos a opção. O nome do campo ficou de
     * quando só existia a Spedy — hoje cobre os dois caminhos de emissão
     * de NFC-e (ver Loja::emissao_fiscal_modo), não só a Spedy.
     *
     * Vendedor tem loja fixa (checa só ela); admin pode trocar de loja no
     * PDV, então basta UMA loja da empresa (ou a empresa em si) ter config
     * pra valer a pena mostrar — a confirmação exata (config da loja
     * escolhida especificamente) acontece de qualquer forma na emissão.
     */
    private function dadosUsuario(User $user): array
    {
        $dados = $user->only(['id', 'name', 'email', 'role', 'loja_id']);
        $dados['possui_spedy_configurado'] = $this->possuiEmissaoNfceConfigurada($user);

        return $dados;
    }

    private function possuiEmissaoNfceConfigurada(User $user): bool
    {
        if ($user->isSuperAdmin()) {
            return false;
        }

        if (! $user->isAdmin()) {
            $loja = $user->loja;

            return (bool) $loja?->possuiSpedyConfigurado() || (bool) $loja?->possuiNfceConfigurado();
        }

        if ($user->empresa?->possuiSpedyConfigurado() || $user->empresa?->possuiNfceConfigurado()) {
            return true;
        }

        return $user->empresa?->lojas()->get()
            ->contains(fn ($loja) => $loja->temSpedyProprio() || $loja->temNfceProprio()) ?? false;
    }
}
