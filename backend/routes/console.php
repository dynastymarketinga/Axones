<?php

use App\Models\User;
use App\Services\AxonesDemoDataService;
use Database\Seeders\InventoryAreaSampleSeeder;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('axones:demo {--clean : Borra los datos demo} {--minimal : Pocas filas (comparación UI)} {--micro : Volumen 1 con OT y grafo de producción (prueba rápida)} {--count=20 : Filas objetivo por tabla de dominio (5-200 sin --minimal; con --minimal 1–200)}', function () {
    /** @var AxonesDemoDataService $demo */
    $demo = app(AxonesDemoDataService::class);

    if ($this->option('clean')) {
        $demo->clean();
        $this->info('Datos demo eliminados. BD limpia.');

        return;
    }

    $count = (int) $this->option('count');
    $minimal = (bool) $this->option('minimal');
    $micro = (bool) $this->option('micro');

    if ($minimal) {
        $result = $demo->seed($count > 0 ? max(1, min(200, $count)) : 1, true, $micro);
        $this->info('Datos demo cargados (modo minimal).');
    } elseif ($micro) {
        $result = $demo->seed($count > 0 ? max(1, min(200, $count)) : 1, false, true);
        $this->info('Datos demo cargados (modo micro: volumen 1 + grafo).');
    } else {
        $result = $demo->seed($count > 0 ? $count : 20);
        $this->info('Datos demo cargados.');
    }
    $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
})->purpose('Cargar o limpiar datos demo Axones');

Artisan::command('axones:users:audit-usernames', function () {
    $nulls = User::query()->whereNull('username')->orWhere('username', '')->count();
    $duplicates = DB::table('users')
        ->select('username')
        ->whereNotNull('username')
        ->groupBy('username')
        ->havingRaw('COUNT(*) > 1')
        ->pluck('username')
        ->all();

    $this->line('Usuarios sin username: '.$nulls);
    if (count($duplicates) > 0) {
        $this->warn('Usernames duplicados: '.implode(', ', $duplicates));
    } else {
        $this->info('Sin usernames duplicados.');
    }
})->purpose('Validar usernames nulos/duplicados antes de producción');

Artisan::command('axones:user:make-superadmin {login : username o correo}', function (string $login) {
    $login = trim($login);
    if ($login === '') {
        $this->error('Debes indicar un username o correo.');

        return 1;
    }

    $user = User::query()
        ->where('username', $login)
        ->orWhere('email', $login)
        ->first();

    if (! $user) {
        $this->error("Usuario no encontrado para login: {$login}");

        return 1;
    }

    $oldRole = (string) ($user->role ?? '');
    $user->role = 'superadmin';
    $user->save();

    $this->info("OK: {$user->name} ({$user->username}) => role superadmin");
    $this->line("Rol anterior: {$oldRole}");

    return 0;
})->purpose('Asigna rol superadmin a un usuario específico');

Artisan::command('axones:user:set-role {login : username o correo} {role : nuevo rol}', function (string $login, string $role) {
    $login = trim($login);
    $role = strtolower(trim($role));

    if ($login === '' || $role === '') {
        $this->error('Uso: php artisan axones:user:set-role {login} {role}');

        return 1;
    }

    $allowedRoles = [
        'superadmin',
        'boss',
        'admin',
        'jefe_supremo',
        'jefe_inventario',
        'inventory_chief',
        'inventory',
        'inventario',
        'printing',
        'impresion',
        'laminacion',
        'corte',
        'tintas',
        'quality',
        'calidad',
        'admin_area',
        'administracion',
        'solicitante',
        'gate',
        'vigilancia',
    ];

    if (! in_array($role, $allowedRoles, true)) {
        $this->error("Rol no permitido: {$role}");
        $this->line('Roles permitidos: '.implode(', ', $allowedRoles));

        return 1;
    }

    $user = User::query()
        ->where('username', $login)
        ->orWhere('email', $login)
        ->first();

    if (! $user) {
        $this->error("Usuario no encontrado para login: {$login}");

        return 1;
    }

    $oldRole = (string) ($user->role ?? '');
    $user->role = $role;
    $user->save();

    $this->info("OK: {$user->name} ({$user->username}) => role {$role}");
    $this->line("Rol anterior: {$oldRole}");

    return 0;
})->purpose('Asigna un rol permitido a un usuario por username/correo');

Artisan::command('axones:inventory:seed-area-sample', function () {
    $this->call('db:seed', ['--class' => InventoryAreaSampleSeeder::class, '--force' => true]);
    $this->info('Datos muestra de inventario por area cargados.');
})->purpose('Cargar 5 materiales por area para pruebas de Inventario por area');
