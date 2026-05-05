<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryReasonPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_material_update_requires_reason_for_critical_change(): void
    {
        $user = User::factory()->create(['role' => 'inventory']);
        $token = $user->createToken('t')->plainTextToken;

        $material = Material::query()->create([
            'sku' => 'MAT-REASON-1',
            'name' => 'Material prueba',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 1,
            'quantity_on_hand' => 10,
        ]);

        $this->patchJson("/api/materials/{$material->id}", [
            'name' => 'Material renombrado',
        ], ['Authorization' => "Bearer {$token}"])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['change_reason']);
    }

    public function test_material_update_with_reason_creates_audit_movement(): void
    {
        $user = User::factory()->create(['role' => 'inventory']);
        $token = $user->createToken('t')->plainTextToken;
        $supplier = Supplier::query()->create(['name' => 'Proveedor prueba']);

        $material = Material::query()->create([
            'sku' => 'MAT-REASON-2',
            'name' => 'Material 2',
            'inventory_area' => 'material',
            'micras' => 80,
            'ancho' => 1200,
            'unit' => 'kg',
            'min_stock' => 1,
            'quantity_on_hand' => 10,
            'supplier_id' => $supplier->id,
        ]);

        $this->patchJson("/api/materials/{$material->id}", [
            'name' => 'Material 2 editado',
            'change_reason' => 'Corrección por duplicidad en catálogo',
        ], ['Authorization' => "Bearer {$token}"])
            ->assertOk();

        $movement = InventoryMovement::query()->where('material_id', $material->id)->latest('id')->first();
        $this->assertNotNull($movement);
        $this->assertSame('inventory_adjustment', $movement->reference_type);
        $this->assertSame('Corrección por duplicidad en catálogo', $movement->metadata['reason_text'] ?? null);
    }

    public function test_inventory_return_accept_requires_reason_when_missing_on_record(): void
    {
        $user = User::factory()->create(['role' => 'inventory']);
        $token = $user->createToken('t')->plainTextToken;

        $material = Material::query()->create([
            'sku' => 'MAT-RET-1',
            'name' => 'Material devolución',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
            'quantity_on_hand' => 5,
        ]);

        $return = InventoryReturn::query()->create([
            'material_id' => $material->id,
            'destination_area' => 'material',
            'quantity' => 1,
            'status' => 'pending',
            'reason' => null,
        ]);

        $this->postJson("/api/inventory-returns/{$return->id}/accept", [], [
            'Authorization' => "Bearer {$token}",
        ])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
    }

    public function test_inventory_movements_exposes_reason_field(): void
    {
        $user = User::factory()->create(['role' => 'inventory']);
        $token = $user->createToken('t')->plainTextToken;

        $material = Material::query()->create([
            'sku' => 'MAT-REASON-3',
            'name' => 'Material 3',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
            'quantity_on_hand' => 3,
        ]);

        InventoryMovement::query()->create([
            'material_id' => $material->id,
            'movement_type' => 'adjustment_add',
            'quantity' => 0,
            'reference_type' => 'inventory_adjustment',
            'reference_id' => $material->id,
            'user_id' => $user->id,
            'metadata' => [
                'reason_text' => 'Ajuste de depuración',
                'reason_scope' => 'manual_adjustment',
            ],
            'occurred_at' => now(),
        ]);

        $res = $this->getJson('/api/inventory-movements', [
            'Authorization' => "Bearer {$token}",
        ])->assertOk();

        $this->assertSame('Ajuste de depuración', $res->json('data.0.reason'));
        $this->assertTrue((bool) $res->json('data.0.is_manual_adjustment'));
    }
}
