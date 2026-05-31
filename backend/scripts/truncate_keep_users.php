<?php

/**
 * @deprecated Use: php artisan axones:truncate-keep-users --force
 *
 * Vacía todas las tablas excepto users y migrations.
 */

passthru('php '.escapeshellarg(__DIR__.'/../artisan').' axones:truncate-keep-users --force', $code);
exit($code);
