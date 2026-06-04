<?php

namespace Tests\Feature;

use App\Enums\AreaRequestStatus;
use App\Enums\MaterialRequestStatus;
use App\Enums\OperationalAlertType;
use App\Models\AreaRequest;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\OperationalAlert;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\MaterialRequestService;
use App\Services\PlanillaSustratoMaterialRequestSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WarehouseInsumosPendingCountTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_warehouse_pending_count_and_alert_on_material_request(): void
    {
        $user = User::factory()->create(['role' => 'inventario']);
        $h = $this->auth($user);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-WH-1',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'WH-MAT',
            'name' => 'Sustrato prueba',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $mr = app(MaterialRequestService::class)->storePendingRequest(
            $wo,
            $user,
            [['material_id' => $mat->id, 'quantity_requested' => '10', 'unit' => 'kg']],
            'impresion',
            PlanillaSustratoMaterialRequestSyncService::NOTES_MARKER.' OT '.$wo->code.' — Impresión',
        );

        $this->assertDatabaseHas('area_requests', [
            'material_request_id' => $mr->id,
            'status' => AreaRequestStatus::Pending->value,
        ]);

        $this->getJson('/api/area-requests/warehouse-pending-count', $h)
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('ot_planilla_pending', 1)
            ->assertJsonPath('manual_pending', 0);

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::MaterialRequestPendingWarehouse->value,
            'work_order_id' => $wo->id,
        ]);

        $alert = OperationalAlert::query()
            ->where('alert_type', OperationalAlertType::MaterialRequestPendingWarehouse->value)
            ->first();
        $this->assertSame($mr->id, (int) data_get($alert->metadata, 'material_request_id'));

        $mr->update(['status' => MaterialRequestStatus::Dispatched->value]);
        AreaRequest::query()->where('material_request_id', $mr->id)->update([
            'status' => AreaRequestStatus::Done->value,
        ]);

        $this->getJson('/api/area-requests/warehouse-pending-count', $h)
            ->assertOk()
            ->assertJsonPath('count', 0);
    }

    public function test_sync_creates_alerts_for_existing_pending_material_requests(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-WH-SYNC',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'WH-SYNC',
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $mr = MaterialRequest::query()->create([
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
            'status' => MaterialRequestStatus::Pending->value,
            'notes' => PlanillaSustratoMaterialRequestSyncService::NOTES_MARKER.' OT '.$wo->code.' — Impresión',
            'originating_area' => 'impresion',
        ]);

        AreaRequest::query()->create([
            'material_request_id' => $mr->id,
            'area' => 'impresion',
            'title' => 'OT '.$wo->code,
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
        ]);

        $this->assertSame(0, OperationalAlert::query()
            ->where('alert_type', OperationalAlertType::MaterialRequestPendingWarehouse->value)
            ->count());

        $this->getJson('/api/area-requests/warehouse-pending-count', $h)->assertOk();

        $this->assertSame(1, OperationalAlert::query()
            ->where('alert_type', OperationalAlertType::MaterialRequestPendingWarehouse->value)
            ->whereNull('acknowledged_at')
            ->count());
    }

    public function test_inventory_role_sees_warehouse_alerts_in_index(): void
    {
        $user = User::factory()->create(['role' => 'inventario']);
        $h = $this->auth($user);

        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::MaterialRequestPendingWarehouse->value,
            'severity' => 'info',
            'message' => 'Almacén: despacho pendiente',
            'metadata' => ['target_area' => 'inventario', 'material_request_id' => 99],
        ]);

        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'severity' => 'warning',
            'message' => 'Escasez',
            'metadata' => ['target_area' => 'impresion'],
        ]);

        $ids = collect($this->getJson('/api/alerts?per_page=20', $h)->json('data'))
            ->pluck('alert_type')
            ->all();

        $this->assertContains(OperationalAlertType::MaterialRequestPendingWarehouse->value, $ids);
        $this->assertNotContains(OperationalAlertType::OtMaterialShortage->value, $ids);
    }

    public function test_boss_sees_warehouse_alerts_in_default_index(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::MaterialRequestPendingWarehouse->value,
            'severity' => 'info',
            'message' => 'Almacén pendiente',
            'metadata' => ['target_area' => 'inventario', 'material_request_id' => 1],
        ]);

        $types = collect($this->getJson('/api/alerts?per_page=20', $h)->json('data'))
            ->pluck('alert_type')
            ->all();

        $this->assertContains(OperationalAlertType::MaterialRequestPendingWarehouse->value, $types);
    }
}
