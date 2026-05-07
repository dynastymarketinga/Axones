<?php

namespace Database\Seeders;

use App\Models\Material;
use App\Models\Supplier;
use App\Models\TintaSubarea;
use Illuminate\Database\Seeder;

/**
 * Asegura materiales de inventario de área "material" (bobinas / sustrato) para poder
 * vincular client_order_lines y work_order_lines; más ejemplos por área (tinta, químico, misceláneo).
 * Idempotente por SKU. Stock vía forceFill porque quantity_on_hand no está en $fillable.
 *
 * Uso: php artisan db:seed --class=DemoMaterialsSeeder
 */
class DemoMaterialsSeeder extends Seeder
{
    public function run(): void
    {
        $supplierId = Supplier::query()->orderBy('id')->value('id');

        $items = [
            [
                'sku' => 'AX-BOPP-25-560',
                'name' => 'BOPP 25μ ancho 560 mm (genérico)',
                'barcode' => null,
                'inventory_area' => 'material',
                'micras' => '25.000',
                'ancho' => '560.000',
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => '1000.000',
                'notes' => 'Creado por DemoMaterialsSeeder. Ajuste stock real en inventario.',
                'supplier_id' => $supplierId,
            ],
            [
                'sku' => 'AX-PE-50-1000',
                'name' => 'Polietileno 50μ ancho 1000 mm (genérico)',
                'barcode' => null,
                'inventory_area' => 'material',
                'micras' => '50.000',
                'ancho' => '1000.000',
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => '500.000',
                'notes' => 'Creado por DemoMaterialsSeeder.',
                'supplier_id' => $supplierId,
            ],
            [
                'sku' => 'AX-DEMO-TINTA-SHOWCASE',
                'name' => 'Tinta demo flexo (cyan muestra)',
                'barcode' => null,
                'inventory_area' => 'tintas',
                'micras' => null,
                'ancho' => null,
                'unit' => 'kg',
                'min_stock' => '2.000',
                'quantity_on_hand' => '48.000',
                'notes' => 'Ejemplo DemoMaterialsSeeder — área tintas.',
                'supplier_id' => $supplierId,
                'tinta_subarea' => 'laminacion',
            ],
            [
                'sku' => 'AX-DEMO-QUIM-SHOWCASE',
                'name' => 'Solvente limpieza anilox (demo)',
                'barcode' => null,
                'inventory_area' => 'quimicos',
                'micras' => null,
                'ancho' => null,
                'unit' => 'kg',
                'min_stock' => '1.000',
                'quantity_on_hand' => '12.500',
                'notes' => 'Ejemplo DemoMaterialsSeeder — área químicos.',
                'supplier_id' => $supplierId,
            ],
            [
                'sku' => 'AX-DEMO-MISC-SHOWCASE',
                'name' => 'Cinta embalaje 48 mm (demo)',
                'barcode' => null,
                'inventory_area' => 'miscelaneos',
                'micras' => null,
                'ancho' => null,
                'unit' => 'unidad',
                'min_stock' => '10.000',
                'quantity_on_hand' => '120.000',
                'notes' => 'Ejemplo DemoMaterialsSeeder — área misceláneos.',
                'supplier_id' => $supplierId,
            ],
        ];

        foreach ($items as $row) {
            $qty = (string) ($row['quantity_on_hand'] ?? '0.000');
            $tintaSubarea = $row['tinta_subarea'] ?? null;
            unset($row['quantity_on_hand'], $row['tinta_subarea']);

            /** @var Material $material */
            $material = Material::query()->updateOrCreate(
                ['sku' => $row['sku']],
                $row,
            );
            $material->forceFill(['quantity_on_hand' => $qty])->save();

            if ($material->inventory_area === 'tintas' && is_string($tintaSubarea) && $tintaSubarea !== '') {
                TintaSubarea::query()->updateOrCreate(
                    ['material_id' => $material->getKey()],
                    ['subarea' => $tintaSubarea],
                );
            }
        }

        $this->command?->info('DemoMaterialsSeeder: '.Material::query()->count().' filas en materials (mín. SKUs de demo listos).');
    }
}
