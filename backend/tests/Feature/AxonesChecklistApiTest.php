<?php

namespace Tests\Feature;

use App\Enums\DeliveryNoteStatus;
use App\Enums\QualityOutcome;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\DeliveryNote;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AxonesChecklistApiTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_production_summary_delivery_quality_area_request_reports(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $client = Client::query()->create(['name' => 'Cli X', 'rif' => 'J-900']);
        $product = Product::query()->create(['client_id' => $client->id, 'name' => 'Bolsa', 'cpe' => 'CPE-X']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CHK-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->getJson("/api/work-orders/{$wo->id}/production-summary", $h)->assertOk()
            ->assertJsonStructure(['work_order', 'printing', 'corte', 'laminacion', 'montaje', 'inventory_and_dispatch']);

        $this->postJson('/api/area-requests', [
            'area' => 'impresion',
            'title' => 'Necesito film',
            'work_order_id' => $wo->id,
        ], $h)->assertCreated();

        $this->postJson('/api/delivery-notes', [
            'lines' => [
                ['work_order_id' => $wo->id, 'product_id' => $product->id, 'quantity_kg' => 100, 'pallet_code' => 'PAL-1'],
            ],
        ], $h)->assertCreated();

        $dn = DeliveryNote::query()->first();
        $this->assertNotNull($dn);
        $this->postJson("/api/delivery-notes/{$dn->id}/dispatch", [
            'driver_name' => 'Conductor Prueba',
            'vehicle_notes' => 'Camion placas TEST-1',
        ], $h)->assertOk();
        $this->assertEquals(DeliveryNoteStatus::Dispatched->value, $dn->fresh()->status);

        $this->putJson("/api/work-orders/{$wo->id}/quality", [
            'outcome' => QualityOutcome::Pass->value,
            'notes' => 'Conforme',
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/quality/certificate", $h)->assertOk();

        $this->getJson('/api/reports/production-time-by-area?from=2026-01-01&to=2026-12-31', $h)->assertOk()
            ->assertJsonStructure(['from', 'to', 'rows']);
        $this->getJson('/api/reports/scrap-by-filters?from=2026-01-01&to=2026-12-31', $h)->assertOk();
        $this->getJson('/api/reports/tinta-consumption-by-client?from=2026-01-01&to=2026-12-31', $h)->assertOk();

        $this->postJson('/api/gate-movements', [
            'direction' => 'in',
            'notes' => 'Camión proveedor',
        ], $h)->assertCreated();
    }
}
