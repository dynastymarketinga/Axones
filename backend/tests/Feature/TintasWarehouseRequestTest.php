<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\OperationalAlert;
use App\Models\User;
use App\Models\WorkOrder;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\Product;
use App\Services\TintasWarehouseRequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TintasWarehouseRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_consumables_create_pending_material_request_and_alert(): void
    {
        $tintasUser = User::factory()->create(['role' => 'tintas']);
        $boss = User::factory()->create(['role' => 'boss']);
        $client = Client::query()->create(['name' => 'Cliente tintas', 'rif' => 'J-'.random_int(1000, 9999)]);
        $product = Product::query()->create(['client_id' => $client->id, 'name' => 'Prod', 'cpe' => 'CPE-T']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-T-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $boss->id,
        ]);

        $tinta = Material::query()->create([
            'sku' => 'BL-2036',
            'name' => 'BLANCO',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $tinta->forceFill(['quantity_on_hand' => 100])->save();

        $token = $tintasUser->createToken('test')->plainTextToken;

        $this->putJson("/api/work-orders/{$wo->id}/tintas/consumables", [
            'ink_lines' => [
                [
                    'material_id' => $tinta->id,
                    'quantity_original_kg' => 10,
                    'quantity_solventada_kg' => 0,
                    'quantity_return_kg' => 0,
                ],
            ],
            'chemical_usages' => [
                ['chemical_type' => 'alcohol', 'quantity_loaded_kg' => 2, 'quantity_return_kg' => 0],
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertOk();

        $mr = MaterialRequest::query()->where('work_order_id', $wo->id)->first();
        $this->assertNotNull($mr);
        $this->assertSame('tintas', $mr->originating_area);
        $this->assertStringStartsWith(TintasWarehouseRequestService::CONSUMPTION_NOTES_MARKER, (string) $mr->notes);
        $this->assertSame('pending', $mr->status);

        $tinta->refresh();
        $this->assertSame('100.000', (string) $tinta->quantity_on_hand);

        $this->assertTrue(
            OperationalAlert::query()
                ->where('alert_type', 'material_request_pending_warehouse')
                ->where('metadata->material_request_id', $mr->id)
                ->exists()
        );
    }

    public function test_tintas_pending_counts_endpoint(): void
    {
        $inventory = User::factory()->create(['role' => 'inventory']);
        $token = $inventory->createToken('test')->plainTextToken;

        $this->getJson('/api/warehouse/tintas-pending-counts', [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonStructure(['devoluciones', 'solicitudes_area', 'materiales', 'bell']);
    }
}
