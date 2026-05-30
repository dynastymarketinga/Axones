<?php

namespace Tests\Feature;

use App\Enums\WorkOrderStatus;
use App\Models\Bobina;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RejectedBobinaRuleTest extends TestCase
{
    use RefreshDatabase;

    private function authHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    private function createRejectedMaterial(string $sku): Material
    {
        $mat = Material::query()->create([
            'sku' => $sku,
            'name' => 'Material bobinas rechazadas',
            'inventory_area' => 'bobinas_rechazadas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        return $mat;
    }

    public function test_inventory_return_to_rejected_bobinas_requires_work_order_id(): void
    {
        $user = User::factory()->create();
        $mat = $this->createRejectedMaterial('BR-RULE-1');
        $wo = WorkOrder::query()->create([
            'code' => 'OT-TEST-00001',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->getKey(),
        ]);

        $this->postJson('/api/inventory-returns', [
            'material_id' => $mat->id,
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 10,
            'reason' => 'Devolución impresión',
        ], $this->authHeaders($user))->assertUnprocessable();

        $this->postJson('/api/inventory-returns', [
            'material_id' => $mat->id,
            'work_order_id' => $wo->id,
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 10,
            'reason' => 'Devolución impresión',
        ], $this->authHeaders($user))->assertCreated();
    }

    public function test_inventory_return_rejects_cancelled_work_order(): void
    {
        $user = User::factory()->create();
        $mat = $this->createRejectedMaterial('BR-RULE-2');
        $wo = WorkOrder::query()->create([
            'code' => 'OT-TEST-00002',
            'status' => WorkOrderStatus::Cancelled->value,
            'created_by' => $user->getKey(),
        ]);

        $this->postJson('/api/inventory-returns', [
            'material_id' => $mat->id,
            'work_order_id' => $wo->id,
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 5,
        ], $this->authHeaders($user))->assertUnprocessable();
    }

    public function test_accepted_return_plus_rejected_bobina_does_not_double_stock(): void
    {
        $user = User::factory()->create();
        $headers = $this->authHeaders($user);
        $mat = $this->createRejectedMaterial('BR-RULE-3');

        $woResp = $this->postJson('/api/work-orders', [
            'auto_create_material_request' => false,
        ], $headers);
        $woResp->assertCreated();
        $woId = $woResp->json('id');

        $retResp = $this->postJson('/api/inventory-returns', [
            'material_id' => $mat->id,
            'work_order_id' => $woId,
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 12.5,
            'reason' => 'Rechazo calidad',
        ], $headers);
        $retResp->assertCreated();
        $returnId = $retResp->json('id');

        $this->assertDatabaseHas('bobinas', ['inventory_return_id' => $returnId]);

        $this->postJson("/api/inventory-returns/{$returnId}/accept", [
            'reason' => 'Aceptación prueba stock',
        ], $headers)->assertOk();

        $mat->refresh();
        $this->assertEquals('12.500', $mat->quantity_on_hand);
        $this->assertEquals(1, Bobina::query()->where('inventory_return_id', $returnId)->count());
    }

    public function test_second_bobina_for_same_return_is_rejected(): void
    {
        $user = User::factory()->create();
        $headers = $this->authHeaders($user);
        $mat = $this->createRejectedMaterial('BR-RULE-4');

        $woResp = $this->postJson('/api/work-orders', ['auto_create_material_request' => false], $headers);
        $woId = $woResp->json('id');

        $retResp = $this->postJson('/api/inventory-returns', [
            'material_id' => $mat->id,
            'work_order_id' => $woId,
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 3,
        ], $headers);
        $returnId = $retResp->json('id');
        $this->assertDatabaseHas('bobinas', ['inventory_return_id' => $returnId]);
        $this->postJson("/api/inventory-returns/{$returnId}/accept", [
            'reason' => 'Aceptación prueba duplicado',
        ], $headers)->assertOk();

        $this->postJson('/api/bobinas', [
            'material_id' => $mat->id,
            'code' => 'BR-DUP-B',
            'weight_kg' => 3,
            'inventory_return_id' => $returnId,
        ], $headers)->assertUnprocessable();
    }

    public function test_normal_bobina_rejects_inventory_return_id(): void
    {
        $user = User::factory()->create();
        $headers = $this->authHeaders($user);
        $normal = Material::query()->create([
            'sku' => 'MAT-NORM-1',
            'name' => 'Sustrato',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $normal->forceFill(['quantity_on_hand' => 0])->save();

        $rejectedMat = $this->createRejectedMaterial('BR-RULE-5');
        $woResp = $this->postJson('/api/work-orders', ['auto_create_material_request' => false], $headers);
        $retResp = $this->postJson('/api/inventory-returns', [
            'material_id' => $rejectedMat->id,
            'work_order_id' => $woResp->json('id'),
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 2,
        ], $headers);
        $returnId = $retResp->json('id');
        $this->postJson("/api/inventory-returns/{$returnId}/accept", [
            'reason' => 'Aceptación prueba material normal',
        ], $headers)->assertOk();

        $this->postJson('/api/bobinas', [
            'material_id' => $normal->id,
            'code' => 'BOB-NORM-1',
            'weight_kg' => 5,
            'inventory_return_id' => $returnId,
        ], $headers)->assertUnprocessable();
    }

    public function test_rejected_bobina_requires_accepted_return(): void
    {
        $user = User::factory()->create();
        $headers = $this->authHeaders($user);
        $mat = $this->createRejectedMaterial('BR-RULE-6');
        $woResp = $this->postJson('/api/work-orders', ['auto_create_material_request' => false], $headers);
        $retResp = $this->postJson('/api/inventory-returns', [
            'material_id' => $mat->id,
            'work_order_id' => $woResp->json('id'),
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 7,
        ], $headers);
        $returnId = $retResp->json('id');

        $this->postJson('/api/bobinas', [
            'material_id' => $mat->id,
            'code' => 'BR-PEND-1',
            'weight_kg' => 7,
            'inventory_return_id' => $returnId,
        ], $headers)->assertUnprocessable();

        $this->assertEquals('pending', InventoryReturn::query()->find($returnId)->status);
    }

    public function test_rejected_bobina_weight_must_match_return_quantity(): void
    {
        $user = User::factory()->create();
        $headers = $this->authHeaders($user);
        $mat = $this->createRejectedMaterial('BR-RULE-7');
        $woResp = $this->postJson('/api/work-orders', ['auto_create_material_request' => false], $headers);
        $retResp = $this->postJson('/api/inventory-returns', [
            'material_id' => $mat->id,
            'work_order_id' => $woResp->json('id'),
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 8,
        ], $headers);
        $returnId = $retResp->json('id');
        $this->postJson("/api/inventory-returns/{$returnId}/accept", [
            'reason' => 'Aceptación prueba peso',
        ], $headers)->assertOk();

        $this->postJson('/api/bobinas', [
            'material_id' => $mat->id,
            'code' => 'BR-W-1',
            'weight_kg' => 7.999,
            'inventory_return_id' => $returnId,
        ], $headers)->assertUnprocessable();
    }

    public function test_inventory_return_to_material_creates_operational_alert_and_keeps_work_order(): void
    {
        $user = User::factory()->create();
        $headers = $this->authHeaders($user);
        $mat = Material::query()->create([
            'sku' => 'MAT-GOOD-RET-1',
            'name' => 'Sustrato bueno',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 100])->save();
        $woResp = $this->postJson('/api/work-orders', ['auto_create_material_request' => false], $headers);
        $woId = $woResp->json('id');

        $r = $this->postJson('/api/inventory-returns', [
            'material_id' => $mat->id,
            'work_order_id' => $woId,
            'destination_area' => 'material',
            'quantity' => 3.5,
            'reason' => 'Devolución buena',
        ], $headers);
        $r->assertCreated();
        $retId = (int) $r->json('id');

        $this->assertDatabaseHas('inventory_returns', [
            'id' => $retId,
            'work_order_id' => $woId,
            'destination_area' => 'material',
        ]);
        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => 'inventory_return_pending',
            'work_order_id' => $woId,
            'material_id' => $mat->id,
        ]);
    }

    public function test_inventory_return_to_rejected_bobinas_allows_null_material(): void
    {
        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-TEST-00099',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->getKey(),
        ]);

        $response = $this->postJson('/api/inventory-returns', [
            'material_id' => null,
            'work_order_id' => $wo->id,
            'destination_area' => 'bobinas_rechazadas',
            'quantity' => 3,
            'reason' => '3 bobina(s) rechazada(s) · Motivo: Manchas · Proveedor: ACME',
        ], $this->authHeaders($user));

        $response->assertCreated();
        $retId = (int) $response->json('id');

        $this->assertDatabaseHas('inventory_returns', [
            'id' => $retId,
            'material_id' => null,
            'work_order_id' => $wo->id,
            'destination_area' => 'bobinas_rechazadas',
        ]);
        $this->assertDatabaseMissing('bobinas', [
            'inventory_return_id' => $retId,
        ]);
    }
}
