<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryMovementsGlobalTest extends TestCase
{
    use RefreshDatabase;

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/inventory-movements')->assertUnauthorized();
    }

    public function test_lists_movements_with_material_and_filters(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $tinta = Material::query()->create([
            'sku' => 'T-GLOBAL-1',
            'name' => 'Tinta global',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $tinta->forceFill(['quantity_on_hand' => 100])->save();

        $mat = Material::query()->create([
            'sku' => 'M-GLOBAL-1',
            'name' => 'Material global',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 50])->save();

        InventoryMovement::query()->create([
            'material_id' => $tinta->id,
            'movement_type' => 'in',
            'quantity' => 10,
            'reference_type' => 'purchase_receipt',
            'reference_id' => 1,
            'user_id' => $user->id,
            'occurred_at' => '2026-04-10 12:00:00',
        ]);

        InventoryMovement::query()->create([
            'material_id' => $mat->id,
            'movement_type' => 'out',
            'quantity' => 2,
            'reference_type' => 'material_request',
            'reference_id' => 5,
            'user_id' => $user->id,
            'occurred_at' => '2026-04-15 08:00:00',
        ]);

        $all = $this->getJson('/api/inventory-movements', [
            'Authorization' => 'Bearer '.$token,
        ]);
        $all->assertOk();
        $this->assertCount(2, $all->json('data'));

        $tintasOnly = $this->getJson('/api/inventory-movements?inventory_area=tintas', [
            'Authorization' => 'Bearer '.$token,
        ]);
        $tintasOnly->assertOk();
        $this->assertCount(1, $tintasOnly->json('data'));
        $this->assertEquals('tintas', $tintasOnly->json('data.0.material.inventory_area'));

        $from = $this->getJson('/api/inventory-movements?from=2026-04-14%2000:00:00', [
            'Authorization' => 'Bearer '.$token,
        ]);
        $from->assertOk();
        $this->assertCount(1, $from->json('data'));
        $this->assertEquals('out', $from->json('data.0.movement_type'));

        $ref = $this->getJson('/api/inventory-movements?reference_type=material_request&reference_id=5', [
            'Authorization' => 'Bearer '.$token,
        ]);
        $ref->assertOk();
        $this->assertCount(1, $ref->json('data'));

        $search = $this->getJson('/api/inventory-movements?search=T-GLOBAL', [
            'Authorization' => 'Bearer '.$token,
        ]);
        $search->assertOk();
        $this->assertCount(1, $search->json('data'));
    }

    public function test_date_only_to_includes_movements_later_on_same_day(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $mat = Material::query()->create([
            'sku' => 'SUBOPP',
            'name' => 'Sustrato',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        InventoryMovement::query()->create([
            'material_id' => $mat->id,
            'movement_type' => 'in',
            'quantity' => 18000,
            'reference_type' => 'purchase_receipt',
            'reference_id' => 1,
            'user_id' => $user->id,
            'occurred_at' => '2026-05-28 00:00:00',
        ]);

        InventoryMovement::query()->create([
            'material_id' => $mat->id,
            'movement_type' => 'out',
            'quantity' => 10000,
            'reference_type' => 'material_request',
            'reference_id' => 1,
            'user_id' => $user->id,
            'occurred_at' => '2026-05-28 15:30:00',
        ]);

        $response = $this->getJson('/api/inventory-movements?from=2026-05-21&to=2026-05-28', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk();
        $this->assertCount(2, $response->json('data'));

        $types = collect($response->json('data'))->pluck('movement_type')->sort()->values()->all();
        $this->assertEquals(['in', 'out'], $types);
    }

    public function test_invalid_movement_type_returns_422(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->getJson('/api/inventory-movements?movement_type=invalid', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnprocessable();
    }
}
