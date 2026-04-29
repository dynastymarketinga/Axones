<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Usuarios de desarrollo (inventario + jefe). Contraseña por defecto: "password".
 * Usar cuando quieras BD "en cero" sin clientes/pedidos demo:
 *
 *   php artisan migrate:fresh
 *   php artisan db:seed --class=AxonesUsersSeeder
 *
 * (Opcional) materiales mínimos para pruebas de OT/importación:
 *   php artisan db:seed --class=DemoMaterialsSeeder
 */
class AxonesUsersSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'inventario@axones.local'],
            [
                'name' => 'Axones Inventario',
                'username' => 'inventario',
                'role' => 'inventory',
                'password' => 'password',
            ],
        );

        User::query()->updateOrCreate(
            ['email' => 'jefe@axones.local'],
            [
                'name' => 'Axones Jefe (revisión completa)',
                'username' => 'jefe',
                'role' => 'boss',
                'password' => 'password',
            ],
        );
    }
}
