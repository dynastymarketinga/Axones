<?php

namespace App\Support;

use App\Models\User;

/**
 * Gestión de cuentas (usuarios, contraseñas, auditoría): solo Víctor y Valeria.
 */
class AccountAdminAccess
{
    public static function allows(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return self::isVictor($user) || self::isValeria($user);
    }

    public static function isProtectedAccount(User $user): bool
    {
        return self::isVictor($user) || self::isValeria($user);
    }

    private static function isVictor(User $user): bool
    {
        if (strtolower(trim((string) ($user->role ?? ''))) !== 'boss') {
            return false;
        }

        $email = strtolower(trim((string) ($user->email ?? '')));
        $username = trim((string) ($user->username ?? ''));

        return $email === strtolower(AxonesUserCredentials::VICTOR_EMAIL)
            || $username === 'Desarrollador';
    }

    private static function isValeria(User $user): bool
    {
        if (strtolower(trim((string) ($user->role ?? ''))) !== 'admin') {
            return false;
        }

        return trim((string) ($user->username ?? '')) === 'admin';
    }
}
