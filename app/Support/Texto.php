<?php

namespace App\Support;

/**
 * Normalização de texto pra busca — usado em qualquer lugar que precisa
 * achar "agua" quando o cadastro tem "Água" (produto, cliente, município
 * etc.), sem depender de quem digitou acertar o acento.
 */
class Texto
{
    private const MAPA_ACENTOS = [
        'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
        'ç' => 'c', 'ñ' => 'n',
    ];

    /**
     * Sem acento e minúsculo. Mapa manual em vez de
     * iconv('...//TRANSLIT') de propósito: o comportamento do TRANSLIT
     * varia entre a libc do macOS (dev) e do Linux (produção) — em teste
     * local ele devolveu "mour~ao" em vez de "mourao", o que quebraria a
     * busca justamente pra quem não digita acento.
     */
    public static function normalizar(string $texto): string
    {
        $minusculo = mb_strtolower(trim($texto));

        return strtr($minusculo, self::MAPA_ACENTOS);
    }
}
