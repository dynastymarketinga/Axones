<?php

namespace Tests\Feature;

use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventoryReturnAcceptRoleTest extends TestCase
{
    use RefreshDatabase;

    public function test_accept_denied_when_user_role_not_in_config_list(): void
    {
        config(['axones.inventory_returns.accept_roles' => 'boss']);

        $printing = User::factory()->create(['role' => 'printing']);
        $allowed = User::factory()->create(['role' => 'boss']);

        $material = Material::query()->create([
            'sku' => 'MAT-RET-ROLE',
            'name' => 'Material devolución rol',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
            'quantity_on_hand' => 3,
        ]);

        /** @var InventoryReturn $ret */
        $ret = InventoryReturn::query()->create([
            'material_id' => $material->id,
            'destination_area' => 'material',
            'quantity' => '1.000',
            'status' => 'pending',
            'reason' => 'Prueba rol',
        ]);

        Sanctum::actingAs($printing);
        $this->postJson("/api/inventory-returns/{$ret->id}/accept", [
            'reason' => 'Aceptado',
        ])->assertForbidden();

        Sanctum::actingAs($allowed);
        $this->postJson("/api/inventory-returns/{$ret->id}/accept", [
            'reason' => 'Aceptado por perfil autorizado',
        ])->assertOk();
    }

    public function test_accept_allowed_for_any_role_when_config_roles_empty(): void
    {
        config(['axones.inventory_returns.accept_roles' => null]);

        $printing = User::factory()->create(['role' => 'printing']);

        $material = Material::query()->create([
            'sku' => 'MAT-RET-OPEN',
            'name' => 'Material devolución abierta',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
            'quantity_on_hand' => 2,
        ]);

        /** @var InventoryReturn $ret */
        $ret = InventoryReturn::query()->create([
            'material_id' => $material->id,
            'destination_area' => 'material',
            'quantity' => '0.500',
            'status' => 'pending',
            'reason' => 'Prueba sin restricción',
        ]);

        Sanctum::actingAs($printing);
        $this->postJson("/api/inventory-returns/{$ret->id}/accept", [
            'reason' => 'Ok',
        ])->assertOk();
    }
}
