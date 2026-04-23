<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrintingInkControlTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_put_consumables_requires_auth(): void
    {
        $wo = WorkOrder::query()->create(['code' => 'OT-INK-1']);
        $this->putJson("/api/work-orders/{$wo->id}/printing/consumables", [
            'ink_lines' => [],
        ])->assertUnauthorized();
    }

    public function test_put_consumables_requires_at_least_one_block(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create(['code' => 'OT-INK-2']);

        $this->putJson("/api/work-orders/{$wo->id}/printing/consumables", [], $h)->assertStatus(422);
    }

    public function test_ink_lines_and_chemicals_round_trip_and_show_in_printing_state(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create(['code' => 'OT-INK-3']);

        $tinta = Material::query()->create([
            'sku' => 'BL-2034',
            'name' => 'Negro Sanat',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $this->putJson("/api/work-orders/{$wo->id}/printing/consumables", [
            'ink_lines' => [
                [
                    'material_id' => $tinta->id,
                    'quantity_original_kg' => 8.16,
                    'quantity_solventada_kg' => 12.14,
                    'quantity_return_kg' => 9,
                ],
            ],
            'chemical_usages' => [
                ['chemical_type' => 'alcohol', 'quantity_loaded_kg' => 501.67, 'quantity_return_kg' => 128],
                ['chemical_type' => 'metoxil', 'quantity_loaded_kg' => 34.35, 'quantity_return_kg' => 10.14],
                ['chemical_type' => 'npa', 'quantity_loaded_kg' => 36.7, 'quantity_return_kg' => 7.58],
            ],
        ], $h)->assertOk()
            ->assertJsonPath('ink_control_lines.0.quantity_consumed_kg', '11.300')
            ->assertJsonPath('chemical_usages.0.quantity_consumed_kg', '373.670');

        $state = $this->getJson("/api/work-orders/{$wo->id}/printing", $h)->assertOk();
        $this->assertCount(1, $state->json('ink_control_lines'));
        $this->assertCount(3, $state->json('chemical_usages'));
        $this->assertEquals('Negro Sanat', $state->json('ink_control_lines.0.material.name'));
    }

    public function test_rejects_non_tinta_material(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create(['code' => 'OT-INK-4']);

        $mat = Material::query()->create([
            'sku' => 'FILM-1',
            'name' => 'Film',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $this->putJson("/api/work-orders/{$wo->id}/printing/consumables", [
            'ink_lines' => [
                ['material_id' => $mat->id, 'quantity_original_kg' => 1],
            ],
        ], $h)->assertStatus(422);
    }

    public function test_partial_update_only_ink_preserves_chemicals(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create(['code' => 'OT-INK-5']);

        $tinta = Material::query()->create([
            'sku' => 'T-1',
            'name' => 'Rojo',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $this->putJson("/api/work-orders/{$wo->id}/printing/consumables", [
            'ink_lines' => [['material_id' => $tinta->id, 'quantity_original_kg' => 10]],
            'chemical_usages' => [
                ['chemical_type' => 'alcohol', 'quantity_loaded_kg' => 100, 'quantity_return_kg' => 0],
            ],
        ], $h)->assertOk();

        $this->putJson("/api/work-orders/{$wo->id}/printing/consumables", [
            'ink_lines' => [],
        ], $h)->assertOk();

        $state = $this->getJson("/api/work-orders/{$wo->id}/printing", $h)->assertOk();
        $this->assertCount(0, $state->json('ink_control_lines'));
        $this->assertCount(1, $state->json('chemical_usages'));
    }

    public function test_duplicate_chemical_type_in_payload_fails(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create(['code' => 'OT-INK-6']);

        $this->putJson("/api/work-orders/{$wo->id}/printing/consumables", [
            'chemical_usages' => [
                ['chemical_type' => 'alcohol', 'quantity_loaded_kg' => 1],
                ['chemical_type' => 'alcohol', 'quantity_loaded_kg' => 2],
            ],
        ], $h)->assertStatus(422);
    }

    public function test_rejects_cancelled_work_order(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create(['code' => 'OT-INK-7', 'status' => 'cancelled']);

        $this->putJson("/api/work-orders/{$wo->id}/printing/consumables", [
            'chemical_usages' => [
                ['chemical_type' => 'npa', 'quantity_loaded_kg' => 1],
            ],
        ], $h)->assertStatus(422);
    }
}
