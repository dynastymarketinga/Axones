<?php

namespace Tests\Feature;

use App\Enums\MaterialRequestStatus;
use App\Enums\WorkOrderStatus;
use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderMaterialRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_dispatch_reduces_stock_and_records_movement(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $wo = $this->postJson('/api/work-orders', [
            'notes' => 'OT prueba',
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $material = Material::query()->create([
            'sku' => 'M-DISP-1',
            'name' => 'Material despacho',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 100])->save();

        $mrResponse = $this->postJson('/api/material-requests', [
            'work_order_id' => $wo->json('id'),
            'originating_area' => 'impresion',
            'lines' => [
                ['material_id' => $material->id, 'quantity_requested' => 30],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $mrResponse->assertCreated();
        $lineId = $mrResponse->json('lines.0.id');

        $dispatch = $this->postJson('/api/material-requests/'.$mrResponse->json('id').'/dispatch', [
            'lines' => [
                ['material_request_line_id' => $lineId, 'quantity' => 30],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $dispatch->assertOk();
        $this->assertEquals(MaterialRequestStatus::Dispatched->value, $dispatch->json('status'));

        $material->refresh();
        $this->assertEquals('70.000', (string) $material->quantity_on_hand);

        $movement = InventoryMovement::query()
            ->where('reference_type', 'material_request')
            ->where('reference_id', $mrResponse->json('id'))
            ->first();
        $this->assertNotNull($movement);
        $this->assertEquals('out', $movement->movement_type);
        $this->assertEquals($material->id, $movement->material_id);
    }

    public function test_partial_dispatch_then_complete(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $wo = $this->postJson('/api/work-orders', [], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $material = Material::query()->create([
            'sku' => 'M-DISP-2',
            'name' => 'Mat 2',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 50])->save();

        $mrResponse = $this->postJson('/api/material-requests', [
            'work_order_id' => $wo->json('id'),
            'lines' => [
                ['material_id' => $material->id, 'quantity_requested' => 40],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $lineId = $mrResponse->json('lines.0.id');
        $mrId = $mrResponse->json('id');

        $this->postJson("/api/material-requests/$mrId/dispatch", [
            'lines' => [
                ['material_request_line_id' => $lineId, 'quantity' => 25],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertOk()->assertJsonPath('status', MaterialRequestStatus::Partial->value);

        $this->postJson("/api/material-requests/$mrId/dispatch", [
            'lines' => [
                ['material_request_line_id' => $lineId, 'quantity' => 15],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertOk()->assertJsonPath('status', MaterialRequestStatus::Dispatched->value);

        $material->refresh();
        $this->assertEquals('10.000', (string) $material->quantity_on_hand);
    }

    public function test_cannot_cancel_after_dispatch(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $wo = WorkOrder::query()->create([
            'code' => WorkOrder::nextCode(),
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $material = Material::query()->create([
            'sku' => 'M-DISP-3',
            'name' => 'Mat 3',
            'inventory_area' => 'quimicos',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 10])->save();

        $mr = MaterialRequest::query()->create([
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
            'status' => MaterialRequestStatus::Pending->value,
        ]);
        $mr->lines()->create([
            'material_id' => $material->id,
            'quantity_requested' => 5,
            'quantity_dispatched' => 0,
        ]);
        $lineId = $mr->lines->first()->id;

        $this->postJson("/api/material-requests/$mr->id/dispatch", [
            'lines' => [
                ['material_request_line_id' => $lineId, 'quantity' => 5],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertOk();

        $this->patchJson("/api/material-requests/$mr->id", [
            'status' => 'cancelled',
        ], ['Authorization' => 'Bearer '.$token])->assertUnprocessable();
    }

    public function test_cannot_create_request_on_cancelled_work_order(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $wo = WorkOrder::query()->create([
            'code' => 'OT-X-00001',
            'status' => WorkOrderStatus::Cancelled->value,
            'created_by' => $user->id,
        ]);

        $material = Material::query()->create([
            'sku' => 'M-DISP-4',
            'name' => 'Mat 4',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 1])->save();

        $this->postJson('/api/material-requests', [
            'work_order_id' => $wo->id,
            'lines' => [
                ['material_id' => $material->id, 'quantity_requested' => 1],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertUnprocessable();
    }
}
