<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\AxonesUserCredentials;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Cuentas base del sistema: desarrollador (boss) y administradora (admin).
 * Los usuarios de planta los carga MillenniumProductionUsersSeeder.
 *
 *   php artisan db:seed --class=AxonesUsersSeeder
 *   php artisan db:seed --class=MillenniumProductionUsersSeeder
 */
class AxonesUsersSeeder extends Seeder
{
    public function run(): void
    {
        $valeriaEmail = AxonesUserCredentials::emailForUsername('admin');

        $keepEmails = array_values(array_unique(array_merge(
            [AxonesUserCredentials::VICTOR_EMAIL, $valeriaEmail],
            MillenniumProductionUsersSeeder::expectedEmails(),
        )));

        $victor = User::query()
            ->where('email', AxonesUserCredentials::VICTOR_EMAIL)
            ->orWhere('username', 'Desarrollador')
            ->first();

        if ($victor === null) {
            User::query()->create([
                'name' => 'Víctor Carrillo',
                'email' => AxonesUserCredentials::VICTOR_EMAIL,
                'username' => 'Desarrollador',
                'role' => 'boss',
                'active' => true,
                'password' => Hash::make(AxonesUserCredentials::passwordForUsername('Desarrollador')),
            ]);
        } else {
            $victor->name = 'Víctor Carrillo';
            $victor->username = 'Desarrollador';
            $victor->role = 'boss';
            $victor->active = true;
            $victor->save();
        }

        $valeria = User::query()
            ->where('email', $valeriaEmail)
            ->orWhere('email', AxonesUserCredentials::migrateEmailFromLegacy('admin@axones.local'))
            ->orWhere('username', 'admin')
            ->first();

        if ($valeria === null) {
            User::query()->create([
                'name' => 'Valeria Rodrigues',
                'email' => $valeriaEmail,
                'username' => 'admin',
                'role' => 'admin',
                'active' => true,
                'password' => Hash::make(AxonesUserCredentials::passwordForUsername('admin')),
            ]);
        } else {
            $valeria->name = 'Valeria Rodrigues';
            $valeria->email = $valeriaEmail;
            $valeria->username = 'admin';
            $valeria->role = 'admin';
            $valeria->active = true;
            $valeria->save();
        }

        User::query()->whereNotIn('email', $keepEmails)->delete();
    }
}
