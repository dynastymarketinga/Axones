<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Usuarios reales Millennium (Portuguesa). No modifica la cuenta del desarrollador (boss).
 *
 * Emails: {username}@axones.local salvo cuentas ya existentes con otro correo.
 * Contraseña por defecto: password. Cuenta admin: admin123 (solo al crear el usuario).
 *
 * Ejecutar:
 *   php artisan db:seed --class=MillenniumProductionUsersSeeder
 *
 * O en .env: AXONES_SEED_MILLENNIUM_USERS=1 junto con db:seed.
 */
class MillenniumProductionUsersSeeder extends Seeder
{
    private const PRESERVE_EMAILS = [
        'victorcarrillox2@gmail.com',
    ];

    /**
     * @return list<array{username: string, name: string, role: string}>
     */
    public static function definitionRows(): array
    {
        return [
            ['username' => 'rparra', 'name' => 'ROBERT PARRA', 'role' => 'jefe_operaciones'],
            ['username' => 'ajaure', 'name' => 'ALEXIS JAURE', 'role' => 'jefe_operaciones'],
            ['username' => 'aanare', 'name' => 'ANGEL ANARE', 'role' => 'planificador'],
            ['username' => 'rguape', 'name' => 'ROXANA GUAPE', 'role' => 'supervisor'],
            ['username' => 'harzola', 'name' => 'HENRY ARZOLA', 'role' => 'supervisor'],
            ['username' => 'lgonzalez', 'name' => 'LEONARDO GONZALEZ', 'role' => 'inventory_chief'],
            ['username' => 'gmujica', 'name' => 'GONZALO MUJICA', 'role' => 'impresion'],
            ['username' => 'ncamacaro', 'name' => 'NELSON CAMACARO', 'role' => 'impresion'],
            ['username' => 'scobos', 'name' => 'STIVEN COBOS', 'role' => 'impresion'],
            ['username' => 'nnino', 'name' => 'NESTOR NINO', 'role' => 'impresion'],
            ['username' => 'mnieves', 'name' => 'MIGUEL NIEVES', 'role' => 'impresion'],
            ['username' => 'jcolmenares', 'name' => 'JACSON COLMENARES', 'role' => 'laminacion'],
            ['username' => 'arodriguez', 'name' => 'ANGEL RODRIGUEZ', 'role' => 'laminacion'],
            ['username' => 'yaranguren', 'name' => 'YSAIAS ARANGUREN', 'role' => 'laminacion'],
            ['username' => 'jguzman', 'name' => 'JUAN GUZMAN', 'role' => 'corte'],
            ['username' => 'apinero', 'name' => 'ALIS PINERO', 'role' => 'corte'],
            ['username' => 'imonroy', 'name' => 'IAN MONROY', 'role' => 'corte'],
            ['username' => 'fabarca', 'name' => 'FERNANDO ABARCA', 'role' => 'corte'],
            ['username' => 'rpena', 'name' => 'RAMIRO PENA', 'role' => 'corte'],
            ['username' => 'emarquez', 'name' => 'EFREN MARQUEZ', 'role' => 'corte'],
            ['username' => 'jmartinez', 'name' => 'JESUS MARTINEZ', 'role' => 'corte'],
            ['username' => 'alaya', 'name' => 'ASDRUBAL LAYA', 'role' => 'tintas'],
            ['username' => 'admin', 'name' => 'Administrador', 'role' => 'admin'],
        ];
    }

    /**
     * Correos que crea este seeder (para que AxonesUsersSeeder no los elimine).
     *
     * @return list<string>
     */
    public static function expectedEmails(): array
    {
        return array_map(
            fn (array $r) => $r['username'].'@axones.local',
            self::definitionRows(),
        );
    }

    public function run(): void
    {
        $preserve = array_map('strtolower', self::PRESERVE_EMAILS);

        foreach (self::definitionRows() as $row) {
            $email = $row['username'].'@axones.local';

            $user = User::query()->where('email', $email)->first();

            $password = $row['username'] === 'admin'
                ? Hash::make('admin123')
                : Hash::make('password');

            if ($user === null) {
                User::query()->create([
                    'name' => $row['name'],
                    'email' => $email,
                    'username' => $row['username'],
                    'role' => $row['role'],
                    'password' => $password,
                ]);

                continue;
            }

            if (in_array(strtolower((string) $user->email), $preserve, true)) {
                continue;
            }

            $user->name = $row['name'];
            $user->username = $row['username'];
            $user->role = $row['role'];
            if ($row['username'] === 'admin') {
                $user->password = Hash::make('admin123');
            }
            $user->save();
        }
    }
}
