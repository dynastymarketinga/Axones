<?php

namespace Tests\Feature;

use App\Enums\AreaRequestStatus;
use App\Enums\MaterialRequestStatus;
use App\Models\AreaRequest;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\PlanillaSustratoMaterialRequestSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlanillaSustratoMaterialRequestSyncTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_put_orden_trabajo_creates_material_request_and_area_shadow_for_impresion_sustratos(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-SUS-1',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'SUB-420',
            'name' => 'BOPP transparente',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 500])->save();

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", [
            'form' => [
                'pedidoKg' => '100',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'reverso',
                'sustratosVirgenImp' => [
                    [
                        'material_id' => (string) $mat->id,
                        'kg' => '420.50',
                        'material_free_text' => '',
                    ],
                ],
            ],
        ], $h)->assertOk();

        $mr = MaterialRequest::query()
            ->where('work_order_id', $wo->id)
            ->where('originating_area', 'impresion')
            ->first();

        $this->assertNotNull($mr);
        $this->assertEquals(MaterialRequestStatus::Pending->value, $mr->status);
        $this->assertStringContainsString(
            PlanillaSustratoMaterialRequestSyncService::NOTES_MARKER,
            (string) $mr->notes,
        );
        $this->assertCount(1, $mr->lines);
        $this->assertEquals((int) $mat->id, (int) $mr->lines->first()->material_id);
        $this->assertEquals(0, bccomp('420.50', (string) $mr->lines->first()->quantity_requested, 3));

        $shadow = AreaRequest::query()->where('material_request_id', $mr->id)->first();
        $this->assertNotNull($shadow);
        $this->assertSame('impresion', $shadow->area);
        $this->assertSame(AreaRequestStatus::Pending->value, $shadow->status);
        $this->assertStringContainsString('SUB-420', (string) $shadow->body);
        $this->assertStringContainsString('420.50', (string) $shadow->body);
    }

    public function test_put_orden_trabajo_updates_existing_planilla_material_request_on_kg_change(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-SUS-2',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'SUB-UPD',
            'name' => 'Polietileno',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $baseForm = [
            'pedidoKg' => '50',
            'maquina' => 'COMEXI 1',
            'tipoImpresionEstructura' => 'superficie',
            'sustratosVirgenImp' => [
                ['material_id' => (string) $mat->id, 'kg' => '100', 'material_free_text' => ''],
            ],
        ];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", ['form' => $baseForm], $h)->assertOk();

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", [
            'form' => array_merge($baseForm, [
                'sustratosVirgenImp' => [
                    ['material_id' => (string) $mat->id, 'kg' => '250.75', 'material_free_text' => ''],
                ],
            ]),
        ], $h)->assertOk();

        $this->assertSame(
            1,
            MaterialRequest::query()
                ->where('work_order_id', $wo->id)
                ->where('originating_area', 'impresion')
                ->where('status', '!=', MaterialRequestStatus::Cancelled->value)
                ->count(),
        );

        $qty = MaterialRequest::query()
            ->where('work_order_id', $wo->id)
            ->value('id');

        $lineQty = MaterialRequest::query()
            ->with('lines')
            ->find($qty)
            ?->lines
            ->first()
            ?->quantity_requested;

        $this->assertEquals(0, bccomp('250.75', (string) $lineQty, 3));
    }

    public function test_laminacion_sustratos_create_separate_material_request(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-SUS-LAM',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'LAM-SUB',
            'name' => 'Laminación sustrato',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", [
            'form' => [
                'pedidoKg' => '80',
                'maquina' => 'LAM 1',
                'tipoImpresionEstructura' => 'reverso',
                'sustratosVirgenLam' => [
                    ['material_id' => (string) $mat->id, 'kg' => '80', 'material_free_text' => ''],
                ],
            ],
        ], $h)->assertOk();

        $mr = MaterialRequest::query()
            ->where('work_order_id', $wo->id)
            ->where('originating_area', 'laminacion')
            ->first();

        $this->assertNotNull($mr);
        $shadow = AreaRequest::query()->where('material_request_id', $mr->id)->first();
        $this->assertSame('laminacion', $shadow?->area);
    }
}
