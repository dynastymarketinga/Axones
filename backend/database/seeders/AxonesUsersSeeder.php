<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Usuarios mínimos para pruebas reales (1 por rol). Contraseña por defecto: "password".
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
        $keepEmails = [
            // Boss principal (usuario real)
            'victorcarrillox2@gmail.com',
            'admin@axones.local',

            // Un usuario por rol (local)
            'inventario@axones.local',
            'impresion@axones.local',
            'laminacion@axones.local',
            'corte@axones.local',
            'tintas@axones.local',
            'calidad@axones.local',
            'vigilancia@axones.local',
            'solicitante@axones.local',
        ];

        // Boss principal
        User::query()->updateOrCreate(
            ['email' => 'victorcarrillox2@gmail.com'],
            [
                'name' => 'Desarrollador Ingeniero Víctor',
                'username' => 'Desarrollador',
                'role' => 'boss',
                'password' => 'password',
            ],
        );

        // Segundo full access (rol distinto para diferenciar)
        User::query()->updateOrCreate(
            ['email' => 'admin@axones.local'],
            [
                'name' => 'Axones Administrador',
                'username' => 'admin',
                'role' => 'admin',
                'password' => 'password',
            ],
        );

        // Inventario
        User::query()->updateOrCreate(
            ['email' => 'inventario@axones.local'],
            [
                'name' => 'Axones Inventario',
                'username' => 'inventario',
                'role' => 'inventory',
                'password' => 'password',
            ],
        );

        // Producción por áreas
        User::query()->updateOrCreate(
            ['email' => 'impresion@axones.local'],
            [
                'name' => 'Axones Impresión',
                'username' => 'impresion',
                'role' => 'impresion',
                'password' => 'password',
            ],
        );
        User::query()->updateOrCreate(
            ['email' => 'laminacion@axones.local'],
            [
                'name' => 'Axones Laminación',
                'username' => 'laminacion',
                'role' => 'laminacion',
                'password' => 'password',
            ],
        );
        User::query()->updateOrCreate(
            ['email' => 'corte@axones.local'],
            [
                'name' => 'Axones Corte',
                'username' => 'corte',
                'role' => 'corte',
                'password' => 'password',
            ],
        );
        User::query()->updateOrCreate(
            ['email' => 'tintas@axones.local'],
            [
                'name' => 'Axones Tintas',
                'username' => 'tintas',
                'role' => 'tintas',
                'password' => 'password',
            ],
        );
        User::query()->updateOrCreate(
            ['email' => 'calidad@axones.local'],
            [
                'name' => 'Axones Calidad',
                'username' => 'calidad',
                'role' => 'calidad',
                'password' => 'password',
            ],
        );
        User::query()->updateOrCreate(
            ['email' => 'vigilancia@axones.local'],
            [
                'name' => 'Axones Vigilancia',
                'username' => 'vigilancia',
                'role' => 'vigilancia',
                'password' => 'password',
            ],
        );
        User::query()->updateOrCreate(
            ['email' => 'solicitante@axones.local'],
            [
                'name' => 'Axones Solicitante',
                'username' => 'solicitante',
                'role' => 'solicitante',
                'password' => 'password',
            ],
        );

        // Reducir usuarios: borrar todo lo que no sea parte del set mínimo.
        User::query()->whereNotIn('email', $keepEmails)->delete();
    }
}
