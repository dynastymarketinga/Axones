<?php

namespace Database\Seeders;

use App\Enums\ClientOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\Material;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Crea órdenes de cliente de prueba repartidas entre clientes existentes (p. ej. DemoClientsSeeder).
 * Idempotente por código: no duplica códigos ya existentes; si hace falta más volumen, ejecute otra vez
 * (generará códigos nuevos con nextCode()).
 */
class DemoClientOrdersSeeder extends Seeder
{
    private const ORDERS_TO_SEED = 55;

    public function run(): void
    {
        if (ClientOrder::query()->count() >= self::ORDERS_TO_SEED) {
            $this->command?->info('DemoClientOrdersSeeder: ya existen órdenes suficientes; omitido.');

            return;
        }

        $clientIds = Client::query()->orderBy('id')->pluck('id')->all();
        if ($clientIds === []) {
            $this->command?->warn('No hay clientes: ejecute primero DemoClientsSeeder o cree clientes.');

            return;
        }

        $materialId = Material::query()
            ->where('inventory_area', 'material')
            ->orderBy('id')
            ->value('id');
        if ($materialId === null) {
            $this->call(DemoMaterialsSeeder::class);
            $materialId = Material::query()
                ->where('inventory_area', 'material')
                ->orderBy('id')
                ->value('id');
        }
        if ($materialId === null) {
            $this->command?->error('No hay material de inventario; revise DemoMaterialsSeeder.');

            return;
        }

        $n = count($clientIds);
        $mid = (int) $materialId;
        DB::transaction(function () use ($clientIds, $n, $mid) {
            for ($i = 0; $i < self::ORDERS_TO_SEED; $i++) {
                $clientId = (int) $clientIds[$i % $n];
                $order = ClientOrder::query()->create([
                    'client_id' => $clientId,
                    'code' => ClientOrder::nextCode(),
                    'status' => ClientOrderStatus::Open->value,
                    'ordered_at' => null,
                    'notes' => $i % 5 === 0 ? 'Nota de prueba #'.($i + 1) : null,
                    'created_by' => null,
                ]);
                ClientOrderLine::query()->create([
                    'client_order_id' => $order->getKey(),
                    'product_id' => null,
                    'material_id' => $mid,
                    'description' => 'Ítem demo '.($i + 1).' (texto mínimo)',
                    'quantity' => 1,
                    'unit' => 'kg',
                    'position' => 0,
                ]);
            }
        });
    }
}
