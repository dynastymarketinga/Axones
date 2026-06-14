<?php

namespace Database\Seeders;

use App\Enums\ClientOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Carga 1000 pedidos cliente con estados open / fulfilled / cancelled repartidos.
 * Ejecutar: php artisan db:seed --class=LoadTestClientOrdersSeeder
 */
class LoadTestClientOrdersSeeder extends Seeder
{
    private const TOTAL = 1000;

    public function run(): void
    {
        $clientIds = Client::query()->orderBy('id')->pluck('id')->all();
        if ($clientIds === []) {
            $this->command?->error('No hay clientes. Ejecute DemoClientsSeeder o cree clientes primero.');

            return;
        }

        $userId = User::query()->orderBy('id')->value('id');
        $productsByClient = Product::query()
            ->whereNotNull('client_id')
            ->get(['id', 'client_id'])
            ->groupBy('client_id');

        $statuses = [
            ClientOrderStatus::Open->value,
            ClientOrderStatus::Fulfilled->value,
            ClientOrderStatus::Cancelled->value,
        ];

        $this->command?->info('Creando '.self::TOTAL.' pedidos cliente…');

        DB::transaction(function () use ($clientIds, $userId, $productsByClient, $statuses) {
            for ($i = 0; $i < self::TOTAL; $i++) {
                $clientId = (int) $clientIds[$i % count($clientIds)];
                $status = $statuses[$i % 3];

                $order = ClientOrder::query()->create([
                    'client_id' => $clientId,
                    'code' => ClientOrder::nextCode(),
                    'status' => $status,
                    'ordered_at' => now()->subDays($i % 90)->toDateString(),
                    'notes' => 'Pedido de carga #'.($i + 1).' — estado '.$status,
                    'created_by' => $userId,
                ]);

                $productId = $productsByClient->get($clientId)?->first()?->id;

                ClientOrderLine::query()->create([
                    'client_order_id' => $order->id,
                    'product_id' => $productId,
                    'material_id' => null,
                    'description' => $productId ? null : 'Línea demo sin producto',
                    'quantity' => 1000 + ($i % 500),
                    'unit' => 'kg',
                    'position' => 0,
                ]);
            }
        });

        $this->command?->info('Listo. Total OC en BD: '.ClientOrder::query()->count());
        foreach ($statuses as $st) {
            $n = ClientOrder::query()->where('status', $st)->count();
            $this->command?->line("  {$st}: {$n}");
        }
    }
}
