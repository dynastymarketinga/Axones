<?php

namespace Database\Seeders;

use App\Models\ClientOrderLine;
use App\Models\Material;
use Illuminate\Database\Seeder;

/**
 * Asigna material a líneas de orden de cliente que aún no tienen material_id
 * (p. ej. importadas a mano o creadas solo con descripción). Así, al pulsar
 * "Crear orden" en OT con importación, el API puede armar work_order_lines.
 *
 * Uso (solo esto, si ya tiene clientes y pedidos en BD):
 *   php artisan db:seed --class=BackfillClientOrderLinesWithDefaultMaterialSeeder
 *
 * Antes, si no hay filas en `materials`:
 *   php artisan db:seed --class=DemoMaterialsSeeder
 */
class BackfillClientOrderLinesWithDefaultMaterialSeeder extends Seeder
{
    public function run(): void
    {
        if (! Material::query()->where('inventory_area', 'material')->exists()) {
            $this->command?->warn('No hay materiales con inventory_area=material. Ejecute: php artisan db:seed --class=DemoMaterialsSeeder');
            $this->call(DemoMaterialsSeeder::class);
        }

        $default = Material::query()
            ->where('inventory_area', 'material')
            ->orderBy('id')
            ->first();

        if (! $default) {
            $this->command?->error('Aún no hay material por defecto. Revise DemoMaterialsSeeder.');

            return;
        }

        $n = ClientOrderLine::query()
            ->whereNull('material_id')
            ->update(['material_id' => $default->id]);

        $this->command?->info("BackfillClientOrderLinesWithDefaultMaterialSeeder: actualizadas {$n} línea(s) con material_id={$default->id} ({$default->sku}).");
    }
}
