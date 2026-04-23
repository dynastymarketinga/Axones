<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // inventory: menú acotado a inventario (ver pulse-ui: axones-roles).
        User::query()->updateOrCreate(
            ['email' => 'inventario@axones.local'],
            [
                'name' => 'Axones Inventario',
                'role' => 'inventory',
                'password' => 'password',
            ],
        );

        // boss: revisión de todo el menú Axones (sin recortar por área).
        User::query()->updateOrCreate(
            ['email' => 'jefe@axones.local'],
            [
                'name' => 'Axones Jefe (revisión completa)',
                'role' => 'boss',
                'password' => 'password',
            ],
        );

        $this->call(DemoClientsSeeder::class);
        $this->call(DemoMaterialsSeeder::class);
        $this->call(DemoClientOrdersSeeder::class);
        $this->call(BackfillClientOrderLinesWithDefaultMaterialSeeder::class);
    }
}
