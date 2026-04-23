<?php

namespace Tests\Feature;

use App\Enums\MaterialRequestStatus;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderAutoMaterialRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_work_order_with_lines_auto_creates_material_request(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $mat = Material::query()->create([
            'sku' => 'OT-BOM-1',
            'name' => 'Sustrato',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        $tinta = Material::query()->create([
            'sku' => 'OT-BOM-T1',
            'name' => 'Tinta',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $tinta->forceFill(['quantity_on_hand' => 0])->save();

        $response = $this->postJson('/api/work-orders', [
            'notes' => 'OT con BOM',
            'originating_area' => 'impresion',
            'material_request_notes' => 'Solicitud generada al crear OT',
            'lines' => [
                ['material_id' => $mat->id, 'quantity' => 100, 'notes' => 'Bobina'],
                ['material_id' => $tinta->id, 'quantity' => 2.5],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $response->assertCreated();
        $this->assertCount(2, $response->json('lines'));
        $this->assertCount(1, $response->json('material_requests'));

        $mr = MaterialRequest::query()->where('work_order_id', $response->json('id'))->first();
        $this->assertNotNull($mr);
        $this->assertEquals(MaterialRequestStatus::Pending->value, $mr->status);
        $this->assertCount(2, $mr->lines);
        $this->assertEquals('Solicitud generada al crear OT', $mr->notes);
    }

    public function test_can_skip_auto_material_request(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $mat = Material::query()->create([
            'sku' => 'OT-BOM-2',
            'name' => 'Solo línea OT',
            'inventory_area' => 'quimicos',
            'unit' => 'l',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        $response = $this->postJson('/api/work-orders', [
            'auto_create_material_request' => false,
            'lines' => [
                ['material_id' => $mat->id, 'quantity' => 1],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $response->assertCreated();
        $this->assertCount(1, $response->json('lines'));
        $this->assertCount(0, $response->json('material_requests'));
    }

    public function test_rejects_miscelaneos_on_work_order_lines(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $misc = Material::query()->create([
            'sku' => 'MISC-OT',
            'name' => 'No va en BOM OT',
            'inventory_area' => 'miscelaneos',
            'unit' => 'und',
            'min_stock' => 0,
        ]);
        $misc->forceFill(['quantity_on_hand' => 0])->save();

        $this->postJson('/api/work-orders', [
            'lines' => [
                ['material_id' => $misc->id, 'quantity' => 1],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertUnprocessable();
    }
}
