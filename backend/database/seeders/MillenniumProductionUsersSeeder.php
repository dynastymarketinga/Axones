<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\AxonesUserCredentials;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Usuarios de planta Millennium (Portuguesa). No modifica Víctor ni Valeria.
 *
 * Emails: {username}@axones.com
 * Contraseña: Axones2026!{username}
 *
 * Ejecutar:
 *   php artisan db:seed --class=MillenniumProductionUsersSeeder
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
            ['username' => 'rparra', 'name' => 'Robert Parra', 'role' => 'jefe_operaciones'],
            ['username' => 'ajaure', 'name' => 'Alexis Jaure', 'role' => 'jefe_operaciones'],
            ['username' => 'aanare', 'name' => 'Angel Anare', 'role' => 'planificador'],
            ['username' => 'rguape', 'name' => 'Roxana Guape', 'role' => 'supervisor'],
            ['username' => 'harzola', 'name' => 'Henry Arzola', 'role' => 'supervisor'],
            ['username' => 'alaya', 'name' => 'Asdrubal Laya', 'role' => 'tintas'],
            ['username' => 'lgonzalez', 'name' => 'Leonardo González', 'role' => 'jefe_almacen'],
            ['username' => 'gmujica', 'name' => 'Gonzalo Mujica', 'role' => 'impresion'],
            ['username' => 'ncamacaro', 'name' => 'Nelson Camacaro', 'role' => 'impresion'],
            ['username' => 'scobos', 'name' => 'Stiven Cobos', 'role' => 'impresion'],
            ['username' => 'nnino', 'name' => 'Nestor Niño', 'role' => 'impresion'],
            ['username' => 'mnieves', 'name' => 'Miguel Nieves', 'role' => 'impresion'],
            ['username' => 'jcolmenares', 'name' => 'Jacson Colmenares', 'role' => 'laminacion'],
            ['username' => 'arodriguez', 'name' => 'Angel Rodríguez', 'role' => 'laminacion'],
            ['username' => 'yaranguren', 'name' => 'Ysaias Aranguren', 'role' => 'laminacion'],
            ['username' => 'jguzman', 'name' => 'Juan Guzman', 'role' => 'corte'],
            ['username' => 'apinero', 'name' => 'Alis Pinero', 'role' => 'corte'],
            ['username' => 'imonroy', 'name' => 'Ian Monroy', 'role' => 'corte'],
            ['username' => 'fabarca', 'name' => 'Fernando Abarca', 'role' => 'corte'],
            ['username' => 'rpena', 'name' => 'Ramiro Peña', 'role' => 'corte'],
            ['username' => 'emarquez', 'name' => 'Efren Márquez', 'role' => 'corte'],
            ['username' => 'jmartinez', 'name' => 'Jesús Martínez', 'role' => 'corte'],
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
            fn (array $r) => AxonesUserCredentials::emailForUsername($r['username']),
            self::definitionRows(),
        );
    }

    public function run(): void
    {
        $preserve = array_map('strtolower', array_merge(
            self::PRESERVE_EMAILS,
            [AxonesUserCredentials::emailForUsername('admin')],
        ));

        foreach (self::definitionRows() as $row) {
            $email = AxonesUserCredentials::emailForUsername($row['username']);
            $legacyEmail = AxonesUserCredentials::migrateEmailFromLegacy($row['username'].'@axones.local');

            $user = User::query()
                ->where('email', $email)
                ->orWhere('email', $legacyEmail)
                ->orWhere('username', $row['username'])
                ->first();

            $password = Hash::make(AxonesUserCredentials::passwordForUsername($row['username']));

            if ($user === null) {
                User::query()->create([
                    'name' => $row['name'],
                    'email' => $email,
                    'username' => $row['username'],
                    'role' => $row['role'],
                    'active' => true,
                    'password' => $password,
                ]);

                continue;
            }

            if (in_array(strtolower((string) $user->email), $preserve, true)) {
                continue;
            }

            $user->name = $row['name'];
            $user->email = $email;
            $user->username = $row['username'];
            $user->role = $row['role'];
            $user->active = true;
            $user->password = $password;
            $user->save();
        }
    }
}
