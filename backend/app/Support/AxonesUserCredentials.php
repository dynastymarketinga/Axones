<?php

namespace App\Support;

final class AxonesUserCredentials
{
    public const EMAIL_DOMAIN = 'axones.com';

    public const LEGACY_EMAIL_DOMAIN = 'axones.local';

    public const PASSWORD_PREFIX = 'Axones2026!';

    public const VICTOR_EMAIL = 'victorcarrillox2@gmail.com';

    public static function emailForUsername(string $username): string
    {
        return strtolower(trim($username)).'@'.self::EMAIL_DOMAIN;
    }

    public static function passwordForUsername(string $username): string
    {
        return self::PASSWORD_PREFIX.trim($username);
    }

    public static function migrateEmailFromLegacy(string $email): string
    {
        $email = trim($email);
        $suffix = '@'.self::LEGACY_EMAIL_DOMAIN;

        if (str_ends_with(strtolower($email), $suffix)) {
            $local = substr($email, 0, -strlen($suffix));

            return $local.'@'.self::EMAIL_DOMAIN;
        }

        return $email;
    }
}
