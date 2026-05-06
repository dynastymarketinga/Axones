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

        // Por defecto, no cargar datos demo para evitar contaminar pruebas reales.
        // Para habilitar demo: definir AXONES_DEMO_SEED=1 (o true) en el .env.
        $flag = strtolower(trim((string) env('AXONES_DEMO_SEED', '0')));
        $seedDemo = in_array($flag, ['1', 'true', 'yes', 'on'], true);
        if ($seedDemo) {
            /** @var AxonesDemoDataService $demo */
            $demo = app(AxonesDemoDataService::class);
            $demo->seed(20);
        }
    }
}
