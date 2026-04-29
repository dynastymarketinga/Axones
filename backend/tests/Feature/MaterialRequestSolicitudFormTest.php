<?php

namespace Tests\Feature;

use App\Enums\MaterialRequestDestinationArea;
use App\Enums\MaterialRequestStatus;
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
}