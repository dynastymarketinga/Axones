<?php

namespace Database\Seeders;

use App\Services\AxonesDemoDataService;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Carga un volumen amplio de datos demo (≈20 filas por tabla de dominio) para pruebas de UI.
     * Usuarios locales (inventario@axones.local, etc.) y contraseña por defecto: password.
     */
    public function run(): void
    {
        $this->call(AxonesUsersSeeder::class);

        /** @var AxonesDemoDataService $demo */
        $demo = app(AxonesDemoDataService::class);
        $demo->seed(20);
    }
}
