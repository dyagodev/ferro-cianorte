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

    // Guarda contra recursão infinita: resolver auth()->user() pela primeira
    // vez numa sessão web dispara uma query em User (retrieveById), que
    // passa pelo EmpresaScope do próprio model User, que chama id() de novo
    // pra saber o filtro — e auth()->user() ainda não terminou de resolver
    // (só memoiza DEPOIS que a query volta), reentra aqui, e por aí vai até
    // estourar a pilha do PHP (sem log nenhum, só um 500 mudo). Enquanto já
    // estamos no meio de resolver o usuário autenticado, não tem "empresa
    // atual" ainda pra usar mesmo — devolve null e deixa essa query
    // específica (a de buscar o próprio usuário da sessão) sem filtro.
    private static bool $resolvendo = false;

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

        if (self::$resolvendo) {
            return null;
        }

        self::$resolvendo = true;

        try {
            if (! auth()->check()) {
                return null;
            }

            $usuario = auth()->user();

            // super_admin é da DM Tecnologia (dona do produto), não de uma
            // empresa cliente — o empresa_id dele só existe pra satisfazer a
            // coluna obrigatória, não representa "a empresa dele" de verdade.
            // Sem essa exceção, o EmpresaScope filtraria TUDO pela empresa
            // interna da DM Tecnologia e o super_admin nunca veria os dados
            // de nenhum cliente real (contagem de lojas/usuários na lista de
            // empresas, por exemplo, sempre daria zero).
            if (method_exists($usuario, 'isSuperAdmin') && $usuario->isSuperAdmin()) {
                return null;
            }

            return $usuario->empresa_id;
        } finally {
            self::$resolvendo = false;
        }
    }
}
