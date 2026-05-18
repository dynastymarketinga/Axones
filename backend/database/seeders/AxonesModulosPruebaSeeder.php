<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

/**
 * Precarga datos de prueba para recorrer todos los módulos de Axones (Inventario, Producción,
 * Solicitudes, Calidad, Despacho, Vigilancia, etc.).
 *
 * Vacía tablas de dominio (clientes, materiales, OT, compras…) y las rellena con ~15 filas
 * por entidad. Conserva usuarios existentes y añade cuentas demo @axones.demo / @axones.local.
 *
 * Uso:
 *   php artisan db:seed --class=AxonesModulosPruebaSeeder
 *
 * Opcional en .env: AXONES_PRUEBA_VOLUME=15  (5–200, por defecto 15)
 *
 * Contraseña de cuentas demo: password
 * Jefe: boss@axones.local · Inventario: inventario@axones.local · Impresión: impresion@axones.local
 */
class AxonesModulosPruebaSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('AxonesModulosPruebaSeeder no puede ejecutarse en production.');

            return;
        }

        $volume = (int) env('AXONES_PRUEBA_VOLUME', 15);
        $volume = max(5, min(200, $volume > 0 ? $volume : 15));

        $this->command?->info("Axones: usuarios base (conserva victorcarrillox2@gmail.com y roles locales)…");
        $this->call(AxonesUsersSeeder::class);

        $this->command?->info("Axones: datos demo por módulos (volume={$volume})…");

        Artisan::call('axones:demo:phase', [
            '--all' => true,
            '--volume' => $volume,
            '--with-flow' => true,
        ], $this->command?->getOutput());

        $this->command?->newLine();
        $this->command?->info('Listo. Módulos con datos de prueba:');
        $this->command?->line('  • Datos maestros: clientes, productos, proveedores, vendedores');
        $this->command?->line('  • Inventario: materiales (sustrato/tintas/químicos/misc), bobinas, recepciones OC, movimientos, devoluciones');
        $this->command?->line('  • Producción: órdenes de trabajo, planillas, segmentos impresión/laminación/corte/montaje/tintas');
        $this->command?->line('  • Solicitudes: material_requests, area_requests');
        $this->command?->line('  • Calidad: work_order_quality_records');
        $this->command?->line('  • Despacho: delivery_notes (+ OT-DEMO-FLUJO con 92 kg terminados)');
        $this->command?->line('  • Vigilancia: gate_movements');
        $this->command?->line('  • Inicio: operational_alerts');
        $this->command?->warn('Contraseña cuentas demo: password');
    }
}
