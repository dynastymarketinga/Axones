<?php

namespace Tests\Feature;

use App\Enums\WorkOrderStatus;
use App\Models\Material;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MontajeProductionTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_montaje_segment_with_machine_code_and_material_usage(): void
    {
        $user = User::factory()->create(['role' => 'montaje']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MZ-1',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $this->postJson("/api/work-orders/{$wo->id}/montaje/time-segments/start", [
            'segment_type' => 'mount',
            'machine_code' => 'CLICHE-01',
        ], $h)->assertCreated()->assertJsonPath('machine_code', 'CLICHE-01');

        $mat = Material::query()->create([
            'sku' => 'PL-MZ',
            'name' => 'Plancha',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        $this->postJson("/api/work-orders/{$wo->id}/montaje/material-usages", [
            'material_id' => $mat->id,
            'quantity' => 0.5,
            'unit' => 'kg',
            'notes' => 'Cliche montaje',
        ], $h)->assertCreated();

        $state = $this->getJson("/api/work-orders/{$wo->id}/montaje", $h)->assertOk();
        $this->assertCount(1, $state->json('material_usages'));
    }
}
