<?php

namespace App\Support;

/**
 * Catálogo configurable de grupos de sustrato para reportes de desperdicio.
 *
 * @phpstan-type ScrapSubstrateGroupConfig array{
 *   id: string,
 *   label: string,
 *   structure_patterns: list<string>,
 *   aliases?: list<string>
 * }
 */
final class ScrapSubstrateCatalog
{
    /** @var list<ScrapSubstrateGroupConfig>|null */
    private static ?array $groupsCache = null;

    /**
     * @return list<ScrapSubstrateGroupConfig>
     */
    public static function groups(): array
    {
        if (self::$groupsCache !== null) {
            return self::$groupsCache;
        }

        /** @var list<ScrapSubstrateGroupConfig> $configured */
        $configured = config('axones.scrap_substrate_groups', []);
        $normalized = [];
        foreach ($configured as $group) {
            // No usar normalizeGroupId() aquí: aún no hay caché y ese método llama a groups().
            $id = strtolower(trim((string) ($group['id'] ?? '')));
            if ($id === '' || $id === 'all') {
                continue;
            }
            $patterns = [];
            foreach ((array) ($group['structure_patterns'] ?? []) as $pat) {
                $p = strtolower(trim((string) $pat));
                if ($p !== '') {
                    $patterns[] = $p;
                }
            }
            $aliases = [];
            foreach ((array) ($group['aliases'] ?? []) as $alias) {
                $a = strtolower(trim((string) $alias));
                if ($a !== '') {
                    $aliases[] = $a;
                }
            }
            $normalized[] = [
                'id' => $id,
                'label' => trim((string) ($group['label'] ?? $id)),
                'structure_patterns' => $patterns,
                'aliases' => $aliases,
            ];
        }

        self::$groupsCache = $normalized;

        return self::$groupsCache;
    }

    /**
     * @return list<string>
     */
    public static function canonicalIds(): array
    {
        return array_map(fn (array $g): string => $g['id'], self::groups());
    }

    /**
     * @return list<string>
     */
    public static function allowedInput(): array
    {
        $ids = self::canonicalIds();
        $legacy = [];
        foreach (self::groups() as $group) {
            foreach ($group['aliases'] as $alias) {
                $legacy[] = $alias;
            }
        }

        return array_values(array_unique(array_merge(['all'], $ids, $legacy)));
    }

    /**
     * @return list<string>
     */
    public static function allowedCanonical(): array
    {
        return array_values(array_unique(array_merge(['all'], self::canonicalIds())));
    }

    public static function normalizeGroupId(?string $value): string
    {
        $v = strtolower(trim((string) $value));
        if ($v === '') {
            return '';
        }
        foreach (self::groups() as $group) {
            if ($v === $group['id']) {
                return $group['id'];
            }
            if (in_array($v, $group['aliases'], true)) {
                return $group['id'];
            }
        }

        return $v;
    }

    public static function isPolietileno(?string $value): bool
    {
        return self::normalizeGroupId($value) === 'polietileno';
    }

    public static function normalizeSubstrateToken(?string $value): ?string
    {
        $v = strtolower(trim((string) $value));
        if ($v === '') {
            return null;
        }
        $normalized = self::normalizeGroupId($v);
        if (in_array($normalized, self::canonicalIds(), true)) {
            return $normalized;
        }

        return $v;
    }

    public static function labelFor(string $groupId): string
    {
        $id = self::normalizeGroupId($groupId);
        foreach (self::groups() as $group) {
            if ($group['id'] === $id) {
                return $group['label'] !== '' ? $group['label'] : $id;
            }
        }

        return $groupId;
    }

    public static function structureMatches(?string $structure, string $groupId): bool
    {
        $id = self::normalizeGroupId($groupId);
        $s = strtolower((string) ($structure ?? ''));
        if ($s === '') {
            return false;
        }
        foreach (self::groups() as $group) {
            if ($group['id'] !== $id) {
                continue;
            }
            foreach ($group['structure_patterns'] as $pat) {
                if (str_contains($s, $pat)) {
                    return true;
                }
            }

            return false;
        }

        return false;
    }

    /**
     * Grupos cuya estructura coincide con el texto del producto (puede ser más de uno).
     *
     * @return list<string>
     */
    public static function structureMatchedGroupIds(?string $structure): array
    {
        $matched = [];
        foreach (self::canonicalIds() as $id) {
            if (self::structureMatches($structure, $id)) {
                $matched[] = $id;
            }
        }

        return $matched;
    }

    public static function structureInferenceIsAmbiguous(?string $structure): bool
    {
        return count(self::structureMatchedGroupIds($structure)) > 1;
    }

    /**
     * Inferencia por estructura solo si hay un único grupo coincidente.
     */
    public static function structureInferenceMatchesGroup(?string $structure, string $groupId): bool
    {
        $matched = self::structureMatchedGroupIds($structure);
        $id = self::normalizeGroupId($groupId);

        return count($matched) === 1 && $matched[0] === $id;
    }

    /**
     * @return list<array{id: string, label: string, structure_patterns: list<string>}>
     */
    public static function publicConfig(): array
    {
        $out = [];
        foreach (self::groups() as $group) {
            $out[] = [
                'id' => $group['id'],
                'label' => $group['label'],
                'structure_patterns' => $group['structure_patterns'],
            ];
        }

        return $out;
    }
}
