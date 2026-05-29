<?php

namespace Tests\Feature;

use App\Enums\AreaRequestStatus;
use App\Enums\MaterialRequestDestinationArea;
use App\Enums\MaterialRequestStatus;
use App\Models\AreaRequest;
use App\Models\Material;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaterialRequestSolicitudFormTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_store_solicitud_header_and_mixed_lines(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-SOL-1',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $alcohol = Material::query()->create([
            'sku' => 'QUIM-ALC',
            'name' => 'Alcohol',
            'inventory_area' => 'quimicos',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $r = $this->postJson('/api/material-requests', [
            'work_order_id' => $wo->id,
            'document_date' => '2026-03-19',
            'destination_areas' => [
                MaterialRequestDestinationArea::Produccion->value,
                MaterialRequestDestinationArea::Montaje->value,
            ],
            'machine_code' => 'COMEXI 1',
            'notes' => 'Arroz Mary Tradicional 900gr',
            'lines' => [
                [
                    'material_id' => $alcohol->id,
                    'quantity_requested' => 5,
                    'unit' => 'kg',
                ],
                [
                    'description' => 'Trapos',
                    'quantity_requested' => 2,
                    'unit' => 'unidad',
                ],
            ],
        ], $h)->assertCreated();

        $this->assertStringStartsWith('2026-03-19', (string) $r->json('document_date'));
        $this->assertEquals(['produccion', 'montaje'], $r->json('destination_areas'));
        $this->assertEquals('COMEXI 1', $r->json('machine_code'));
        $this->assertCount(2, $r->json('lines'));
        $this->assertEquals('Trapos', $r->json('lines.1.description'));
        $this->assertNull($r->json('lines.1.material_id'));
    }

    public function test_store_solicitud_without_work_order(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $mat = Material::query()->create([
            'sku' => 'M-SIN-OT',
            'name' => 'Tornillo',
            'inventory_area' => 'material',
            'unit' => 'unidad',
            'min_stock' => 0,
        ]);

        $r = $this->postJson('/api/material-requests', [
            'notes' => 'Solicitud directa a inventario',
            'lines' => [
                ['material_id' => $mat->id, 'quantity_requested' => 3, 'unit' => 'unidad'],
            ],
        ], $h)->assertCreated();

        $this->assertNull($r->json('work_order_id'));
        $this->assertEquals($user->id, $r->json('requested_by'));
        $this->assertEquals('Solicitud directa a inventario', $r->json('notes'));

        $mrId = (int) $r->json('id');
        $shadow = AreaRequest::query()->where('material_request_id', $mrId)->first();
        $this->assertNotNull($shadow);
        $this->assertSame('almacen', $shadow->area);
        $this->assertSame(AreaRequestStatus::Pending->value, $shadow->status);
        $this->assertStringContainsString('Solicitud directa a inventario', (string) $shadow->body);
    }

    public function test_authorize_sets_user_and_timestamp(): void
    {
        $user = User::factory()->create();
        $boss = User::factory()->create();

        $wo = WorkOrder::query()->create([
            'code' => 'OT-SOL-2',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'M-S',
            'name' => 'X',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $mrId = $this->postJson('/api/material-requests', [
            'work_order_id' => $wo->id,
            'lines' => [
                ['material_id' => $mat->id, 'quantity_requested' => 1],
            ],
        ], $this->auth($user))->assertCreated()->json('id');

        $this->actingAs($boss, 'sanctum')
            ->postJson("/api/material-requests/{$mrId}/authorize")
            ->assertOk()
            ->assertJsonPath('authorized_by', $boss->id);
    }

    public function test_dispatch_without_authorize_fails(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-SOL-4',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'M-S4',
            'name' => 'Stock',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 10])->save();

        $mr = $this->postJson('/api/material-requests', [
            'work_order_id' => $wo->id,
            'lines' => [
                ['material_id' => $mat->id, 'quantity_requested' => 2],
            ],
        ], $h)->assertCreated();

        $lineId = $mr->json('lines.0.id');

        $this->postJson('/api/material-requests/'.$mr->json('id').'/dispatch', [
            'lines' => [
                ['material_request_line_id' => $lineId, 'quantity' => 2],
            ],
        ], $h)->assertUnprocessable();
    }

    public function test_dispatch_free_text_line_without_inventory_movement(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-SOL-3',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'M-S3',
            'name' => 'Stock',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 100])->save();

        $mr = $this->postJson('/api/material-requests', [
            'work_order_id' => $wo->id,
            'lines' => [
                ['material_id' => $mat->id, 'quantity_requested' => 10],
                ['description' => 'Trapos', 'quantity_requested' => 3, 'unit' => 'paq'],
            ],
        ], $h)->assertCreated();

        $line0 = $mr->json('lines.0.id');
        $line1 = $mr->json('lines.1.id');

        $this->postJson('/api/material-requests/'.$mr->json('id').'/authorize', [], $h)->assertOk();

        $out = $this->postJson('/api/material-requests/'.$mr->json('id').'/dispatch', [
            'lines' => [
                ['material_request_line_id' => $line0, 'quantity' => 10],
                ['material_request_line_id' => $line1, 'quantity' => 3],
            ],
        ], $h)->assertOk()->assertJsonPath('status', MaterialRequestStatus::Dispatched->value)
            ->assertJsonPath('lines.1.quantity_dispatched', '3.000');

        $this->assertEquals($user->id, $out->json('dispatched_by'));

        $mat->refresh();
        $this->assertEquals('90.000', (string) $mat->quantity_on_hand);
    }

    public function test_dispatch_without_work_order_rebates_stock(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $mat = Material::query()->create([
            'sku' => 'M-SIN-OT-D',
            'name' => 'Directo',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 5])->save();

        $mr = $this->postJson('/api/material-requests', [
            'notes' => 'Sin OT',
            'lines' => [
                ['material_id' => $mat->id, 'quantity_requested' => 2, 'unit' => 'kg'],
            ],
        ], $h)->assertCreated();

        $lineId = $mr->json('lines.0.id');
        $mrId = $mr->json('id');

        $this->assertSame(
            AreaRequestStatus::Pending->value,
            (string) AreaRequest::query()->where('material_request_id', $mrId)->value('status'),
        );

        $this->postJson("/api/material-requests/{$mrId}/authorize", [], $h)->assertOk();

        $this->postJson("/api/material-requests/{$mrId}/dispatch", [
            'lines' => [
                ['material_request_line_id' => $lineId, 'quantity' => 2],
            ],
        ], $h)->assertOk()->assertJsonPath('status', MaterialRequestStatus::Dispatched->value)
            ->assertJsonPath('work_order_id', null);

        $mat->refresh();
        $this->assertEquals('3.000', (string) $mat->quantity_on_hand);

        $this->assertSame(
            AreaRequestStatus::Done->value,
            (string) AreaRequest::query()->where('material_request_id', $mrId)->value('status'),
        );
    }

    public function test_dispatch_rejects_quantity_above_stock(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $mat = Material::query()->create([
            'sku' => 'M-STOCK-CAP',
            'name' => 'BOPP',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 13])->save();

        $mr = $this->postJson('/api/material-requests', [
            'notes' => 'Solicitud directa',
            'lines' => [
                ['material_id' => $mat->id, 'quantity_requested' => 100],
            ],
        ], $h)->assertCreated();

        $lineId = $mr->json('lines.0.id');
        $mrId = $mr->json('id');

        $this->postJson("/api/material-requests/{$mrId}/authorize", [], $h)->assertOk();

        $this->postJson("/api/material-requests/{$mrId}/dispatch", [
            'lines' => [
                ['material_request_line_id' => $lineId, 'quantity' => 100],
            ],
        ], $h)->assertUnprocessable();

        $mat->refresh();
        $this->assertEquals('13.000', (string) $mat->quantity_on_hand);

        $this->postJson("/api/material-requests/{$mrId}/dispatch", [
            'lines' => [
                ['material_request_line_id' => $lineId, 'quantity' => 13],
            ],
        ], $h)->assertOk()->assertJsonPath('status', MaterialRequestStatus::Partial->value);

        $mat->refresh();
        $this->assertEquals('0.000', (string) $mat->quantity_on_hand);
    }

    public function test_area_request_mirror_cannot_be_patched_via_area_api(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $mat = Material::query()->create([
            'sku' => 'M-AR-PATCH',
            'name' => 'X',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $mrId = $this->postJson('/api/material-requests', [
            'notes' => 'n',
            'lines' => [['material_id' => $mat->id, 'quantity_requested' => 1]],
        ], $h)->assertCreated()->json('id');

        $arId = (int) AreaRequest::query()->where('material_request_id', $mrId)->value('id');
        $this->assertGreaterThan(0, $arId);

        $this->patchJson("/api/area-requests/{$arId}", ['title' => 'Hackeo'], $h)->assertUnprocessable();
    }
}
