<?php

namespace Tests\Feature;

use App\Enums\DeliveryNoteStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\CorteBobinaUsage;
use App\Models\Material;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotaEntregaPrefillTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_prefill_from_corte_and_store_draft_without_transport(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $client = Client::query()->create([
            'name' => 'PROCESADORA VIUZ',
            'rif' => 'J-503127562',
            'city' => 'Araure',
            'state' => 'Portuguesa',
            'address' => 'Av. Los Pioneros, Edif. Grupo Viuz',
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'HARINA DE MAIZ BLANCO LAS VIRGENES 1 KG',
            'cpe' => 'CPE-NE',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-NE-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-NE',
            'name' => 'Film',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        CorteBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_used_kg' => 800,
            'quantity_finished_kg' => 759.3,
            'bobina_id' => null,
        ]);

        $pre = $this->getJson("/api/work-orders/{$wo->id}/nota-entrega/prefill", $h)->assertOk();
        $this->assertStringContainsString('HARINA DE MAIZ', (string) $pre->json('material_type_description'));
        $this->assertEquals('Av. Los Pioneros, Edif. Grupo Viuz', $pre->json('client.address'));
        $this->assertCount(1, $pre->json('suggested_lines'));
        $this->assertEquals('759.300', $pre->json('suggested_lines.0.quantity_kg'));
        $this->assertNull($pre->json('transport.driver_name'));

        $line = $pre->json('suggested_lines.0');
        $created = $this->postJson('/api/delivery-notes', [
            'work_order_id' => $wo->id,
            'document_date' => $pre->json('suggested_document_date'),
            'lines' => [[
                'corte_bobina_usage_id' => $line['corte_bobina_usage_id'],
                'work_order_id' => $wo->id,
                'product_id' => $product->id,
                'quantity_kg' => $line['quantity_kg'],
                'pallet_code' => $line['pallet_code'],
                'bobbin_count' => 36,
            ]],
        ], $h)->assertCreated();

        $this->assertEquals(36, $created->json('lines.0.bobbin_count'));
        $this->assertEquals($wo->id, $created->json('work_order_id'));
        $this->assertNotNull($created->json('sequential_number'));
        $this->assertEquals(DeliveryNoteStatus::Draft->value, $created->json('status'));
    }

    public function test_dispatch_requires_transport(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-NE-2',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $dn = $this->postJson('/api/delivery-notes', [
            'work_order_id' => $wo->id,
            'lines' => [
                ['work_order_id' => $wo->id, 'quantity_kg' => 10, 'pallet_code' => '1'],
            ],
        ], $h)->assertCreated();

        $this->postJson("/api/delivery-notes/{$dn->json('id')}/dispatch", [], $h)->assertStatus(422);

        $this->postJson("/api/delivery-notes/{$dn->json('id')}/dispatch", [
            'driver_name' => 'JAVIER GONZALEZ V-15525855',
            'vehicle_notes' => 'CAMION DONFENG PLACAS A32BR0D',
        ], $h)->assertOk()->assertJsonPath('status', DeliveryNoteStatus::Dispatched->value);
    }
}
