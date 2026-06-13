<?php

namespace App\Services\Assistant;

use App\Models\User;
use App\Support\BossAccess;

/**
 * Reglas de quién puede usar el asistente, además del feature flag global.
 * Es la fuente de verdad para el backend; el frontend (canUseAxonesAssistant)
 * debe espejar estas reglas para mostrar/ocultar el botón.
 */
final class AssistantAccess
{
    public static function isEnabled(): bool
    {
        return (bool) config('axones.assistant.enabled', false);
    }

    public static function allowedRoles(): array
    {
        $roles = config('axones.assistant.allowed_roles', []);
        if (! is_array($roles)) {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn ($r): string => strtolower(trim((string) $r)),
            $roles,
        )));
    }

    public static function allows(?User $user): bool
    {
        if (! self::isEnabled() || $user === null) {
            return false;
        }
        if (BossAccess::allows($user)) {
            return true;
        }
        $role = strtolower(trim((string) ($user->role ?? '')));

        return in_array($role, self::allowedRoles(), true);
    }
}
