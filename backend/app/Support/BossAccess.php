<?php

namespace App\Support;

use App\Models\User;

/**
 * Misma regla que acceso amplio a alertas operativas (jefatura / admin).
 */
class BossAccess
{
    private const FULL_ACCESS_ROLES = ['boss', 'admin', 'jefe_supremo', 'superadmin'];

    public static function allows(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return in_array(strtolower(trim((string) ($user->role ?? ''))), self::FULL_ACCESS_ROLES, true);
    }
}
