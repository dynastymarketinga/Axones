<?php

namespace App\Support;

/**
 * @deprecated Use {@see ScrapSubstrateCatalog}; mantiene constantes para compatibilidad.
 */
final class ScrapSubstrateGroup
{
    public const POLIETILENO = 'polietileno';

    /** @deprecated Typo histórico en API y planilla; se normaliza a polietileno. */
    public const POLIETILENO_LEGACY = 'politerlero';

    /**
     * @return list<string>
     */
    public static function allowedInput(): array
    {
        return ScrapSubstrateCatalog::allowedInput();
    }

    /**
     * @return list<string>
     */
    public static function allowedCanonical(): array
    {
        return ScrapSubstrateCatalog::allowedCanonical();
    }

    public static function normalize(?string $value): string
    {
        return ScrapSubstrateCatalog::normalizeGroupId($value);
    }

    public static function isPolietileno(?string $value): bool
    {
        return ScrapSubstrateCatalog::isPolietileno($value);
    }

    public static function normalizeSubstrateToken(?string $value): ?string
    {
        return ScrapSubstrateCatalog::normalizeSubstrateToken($value);
    }
}
