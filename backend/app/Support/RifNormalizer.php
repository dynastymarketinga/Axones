<?php

namespace App\Support;

final class RifNormalizer
{
    /**
     * Normaliza el RIF al formato canónico del sistema (special_j):
     * - J: con guiones -> J-12345678-9
     * - V/E/G/P/C: sin guiones -> V123456789
     *
     * Acepta entradas con/ sin guiones, puntos, espacios, etc.
     */
    public static function normalize(?string $rif): ?string
    {
        $raw = strtoupper(trim((string) ($rif ?? '')));
        if ($raw === '') {
            return null;
        }

        // Quitar espacios y separadores comunes, conservar letra inicial si existe.
        $raw = preg_replace('/\s+/', '', $raw) ?? $raw;
        $raw = str_replace(['.', '-', '_'], '', $raw);

        // Extraer letra y dígitos.
        if (! preg_match('/^([JVEGPC])(\d{7,9})$/', $raw, $m)) {
            // Si no coincide, devolver el texto tal cual (la validación decidirá).
            return $rif;
        }

        $letter = $m[1];
        $digits = $m[2];

        // Para 8 o 9 dígitos: últimos es verificador.
        if (strlen($digits) < 8) {
            return $rif;
        }

        $main = substr($digits, 0, -1);
        $dv = substr($digits, -1);

        if ($letter === 'J') {
            return sprintf('J-%s-%s', $main, $dv);
        }

        return $letter.$main.$dv;
    }
}

