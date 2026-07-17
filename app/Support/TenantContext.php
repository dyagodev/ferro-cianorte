<?php

namespace App\Support;

/**
 * Resolve a empresa "atual" pra multi-tenancy. Em request HTTP normal, isso
 * é sempre a empresa do usuário autenticado — não precisa setar nada à mão.
 * Fora de request (comando artisan, sincronização em background), não tem
 * usuário autenticado pra herdar, então quem estiver processando dado de
 * uma empresa específica (ex.: LinkProSyncService, uma conexão por vez)
 * precisa chamar TenantContext::set() explicitamente antes e clear() depois.
 */
class TenantContext
{
    private static ?int $empresaIdForcado = null;

    public static function set(?int $empresaId): void
    {
        self::$empresaIdForcado = $empresaId;
    }

    public static function clear(): void
    {
        self::$empresaIdForcado = null;
    }

    public static function id(): ?int
    {
        if (self::$empresaIdForcado !== null) {
            return self::$empresaIdForcado;
        }

        return auth()->check() ? auth()->user()->empresa_id : null;
    }
}
