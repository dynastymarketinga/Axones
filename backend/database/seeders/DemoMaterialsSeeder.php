<?php

namespace Database\Seeders;

use App\Models\Material;
use Illuminate\Database\Seeder;

/**
 * Asegura materiales de inventario de área "material" (bobinas / sustrato) para poder
 * vincular client_order_lines y work_order_lines. Idempotente por SKU.
 *
 * Uso: php artisan db:seed --class=DemoMaterialsSeeder
 */
class DemoMaterialsSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            [
                'sku' => 'AX-BOPP-25-560',
                'name' => 'BOPP 25μ ancho 560 mm (genérico)',
                'barcode' => null,
                'inventory_area' => 'material',
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => 1000,
                'notes' => 'Creado por DemoMaterialsSeeder. Ajuste stock real en inventario.',
            ],
            [
                'sku' => 'AX-PE-50-1000',
                'name' => 'Polietileno 50μ ancho 1000 mm (genérico)',
                'barcode' => null,
                'inventory_area' => 'material',
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => 500,
                'notes' => 'Creado por DemoMaterialsSeeder.',
            ],
        ];

        foreach ($items as $row) {
            Material::query()->updateOrCreate(
                ['sku' => $row['sku']],
                $row,
            );
        }

        $this->command?->info('DemoMaterialsSeeder: '.Material::query()->count().' filas en materials (mín. SKUs de demo listos).');
    }
}
