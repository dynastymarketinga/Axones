<?php

namespace Database\Seeders;

use App\Enums\InventoryArea;
use App\Models\Material;
use Illuminate\Database\Seeder;

class InventoryAreaSampleSeeder extends Seeder
{
    public function run(): void
    {
        $areas = [
            InventoryArea::Material->value => ['unit' => 'kg', 'prefix' => 'SUSTR'],
            InventoryArea::Tintas->value => ['unit' => 'kg', 'prefix' => 'TINTA'],
            InventoryArea::CementerioTintas->value => ['unit' => 'kg', 'prefix' => 'CEMT'],
            InventoryArea::Quimicos->value => ['unit' => 'kg', 'prefix' => 'QUIM'],
            InventoryArea::BobinasRechazadas->value => ['unit' => 'kg', 'prefix' => 'RECH'],
            InventoryArea::Miscelaneos->value => ['unit' => 'u', 'prefix' => 'MISC'],
        ];

        foreach ($areas as $area => $meta) {
            for ($i = 1; $i <= 5; $i++) {
                $sku = sprintf('AX-%s-%03d', $meta['prefix'], $i);
                $qty = number_format((float) (25 + ($i * 5)), 3, '.', '');
                $micras = in_array($area, [InventoryArea::Material->value, InventoryArea::BobinasRechazadas->value], true)
                    ? number_format((float) (16 + ($i * 2)), 3, '.', '')
                    : null;
                $ancho = in_array($area, [InventoryArea::Material->value, InventoryArea::BobinasRechazadas->value], true)
                    ? number_format((float) (620 + ($i * 20)), 3, '.', '')
                    : null;

                $material = Material::query()->updateOrCreate(
                    ['sku' => $sku],
                    [
                        'name' => sprintf('Muestra %s %d', str_replace('_', ' ', $area), $i),
                        'barcode' => null,
                        'inventory_area' => $area,
                        'tinta_presentacion' => $area === InventoryArea::Tintas->value ? 'Superficie' : null,
                        'micras' => $micras,
                        'ancho' => $ancho,
                        'unit' => $meta['unit'],
                        'min_stock' => '0.000',
                        'notes' => 'Semilla para validacion de inventario por area.',
                    ],
                );
                $material->forceFill(['quantity_on_hand' => $qty])->save();
            }
        }

        $this->command?->info('InventoryAreaSampleSeeder: 5 registros por area (sustrato/tintas/cementerio_tintas/quimicos/bobinas_rechazadas/miscelaneos) listos.');
    }
}
