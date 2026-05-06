<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

/**
 * Resetea IDs de users a 1..N (1 por rol) para mantener orden.
 *
 * IMPORTANTE: Esto trunca `users` y también `sessions` y `personal_access_tokens`
 * para evitar referencias a IDs anteriores.
 *
 * Uso:
 *   php scripts/reset_user_ids.php
 */

$now = now();

$rows = [
    [
        'id' => 1,
        'name' => 'Desarrollador Ingeniero Víctor',
        'email' => 'victorcarrillox2@gmail.com',
        'username' => 'Desarrollador',
        'role' => 'boss',
    ],
    [
        'id' => 2,
        'name' => 'Axones Administrador',
        'email' => 'admin@axones.local',
        'username' => 'admin',
        'role' => 'admin',
    ],
    [
        'id' => 3,
        'name' => 'Axones Inventario',
        'email' => 'inventario@axones.local',
        'username' => 'inventario',
        'role' => 'inventory',
    ],
    [
        'id' => 4,
        'name' => 'Axones Impresión',
        'email' => 'impresion@axones.local',
        'username' => 'impresion',
        'role' => 'impresion',
    ],
    [
        'id' => 5,
        'name' => 'Axones Laminación',
        'email' => 'laminacion@axones.local',
        'username' => 'laminacion',
        'role' => 'laminacion',
    ],
    [
        'id' => 6,
        'name' => 'Axones Corte',
        'email' => 'corte@axones.local',
        'username' => 'corte',
        'role' => 'corte',
    ],
    [
        'id' => 7,
        'name' => 'Axones Tintas',
        'email' => 'tintas@axones.local',
        'username' => 'tintas',
        'role' => 'tintas',
    ],
    [
        'id' => 8,
        'name' => 'Axones Calidad',
        'email' => 'calidad@axones.local',
        'username' => 'calidad',
        'role' => 'calidad',
    ],
    [
        'id' => 9,
        'name' => 'Axones Vigilancia',
        'email' => 'vigilancia@axones.local',
        'username' => 'vigilancia',
        'role' => 'vigilancia',
    ],
    [
        'id' => 10,
        'name' => 'Axones Solicitante',
        'email' => 'solicitante@axones.local',
        'username' => 'solicitante',
        'role' => 'solicitante',
    ],
];

DB::statement('SET FOREIGN_KEY_CHECKS=0');
DB::table('sessions')->truncate();
DB::table('personal_access_tokens')->truncate();
DB::table('users')->truncate();

$insert = array_map(static function (array $u) use ($now): array {
    return [
        'id' => $u['id'],
        'name' => $u['name'],
        'email' => $u['email'],
        'username' => $u['username'],
        'role' => $u['role'],
        'email_verified_at' => null,
        'password' => Hash::make('password'),
        'remember_token' => null,
        'created_at' => $now,
        'updated_at' => $now,
    ];
}, $rows);

DB::table('users')->insert($insert);
DB::statement('ALTER TABLE users AUTO_INCREMENT = 11');
DB::statement('SET FOREIGN_KEY_CHECKS=1');

echo "OK: users reiniciados a IDs 1..10 (AUTO_INCREMENT=11)\n";

