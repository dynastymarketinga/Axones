<?php

namespace Tests\Feature;

use App\Enums\OperationalAlertType;
use App\Enums\WorkOrderStatus;
use App\Models\Material;
use App\Models\OperationalAlert;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationalAlertsTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_creates_alert_when_ot_line_exceeds_stock(): void
    {
        $user = User::factory()->create();
        $mat = Material::query()->create([
            'sku' => 'AL-1',
            'name' => 'Mat alerta',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 5])->save();

        $this->postJson('/api/work-orders', [
            'auto_create_material_request' => false,
            'lines' => [
                ['material_id' => $mat->id, 'quantity' => 100],
            ],
        ], $this->auth($user))->assertCreated();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'material_id' => $mat->id,
        ]);
    }

    public function test_lists_and_acknowledges_alerts(): void
    {
        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-AL-1',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $alert = OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'severity' => 'critical',
            'message' => 'Prueba',
            'work_order_id' => $wo->id,
        ]);

        $list = $this->getJson('/api/alerts?unread=1', $this->auth($user))->assertOk();
        $this->assertGreaterThanOrEqual(1, count($list->json('data')));

        $this->patchJson("/api/alerts/{$alert->id}/acknowledge", [], $this->auth($user))->assertOk();
        $this->assertNotNull($alert->fresh()->acknowledged_at);
    }

    public function test_scrap_percent_triggers_alert_above_threshold(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-AL-2',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/printing/summary", [
            'scrap_percent' => 12.5,
        ], $this->auth($user))->assertOk();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'work_order_id' => $wo->id,
        ]);
    }

    public function test_corte_scrap_percent_triggers_alert_above_threshold(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-AL-C',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/corte/summary", [
            'scrap_percent' => 15,
        ], $this->auth($user))->assertOk();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'work_order_id' => $wo->id,
        ]);

        $msg = OperationalAlert::query()->where('work_order_id', $wo->id)->latest('id')->value('message');
        $this->assertStringContainsString('corte', (string) $msg);
    }

    public function test_laminacion_scrap_percent_triggers_alert_above_threshold(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-AL-L',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/laminacion/summary", [
            'scrap_percent' => 20,
        ], $this->auth($user))->assertOk();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'work_order_id' => $wo->id,
        ]);

        $msg = OperationalAlert::query()->where('work_order_id', $wo->id)->latest('id')->value('message');
        $this->assertStringContainsString('laminación', mb_strtolower((string) $msg));
    }

    public function test_mount_segment_exceeding_threshold_creates_alert(): void
    {
        config(['axones.alerts.mount_seconds_threshold' => 120]);

        Carbon::setTestNow(Carbon::parse('2026-04-20 09:00:00'));
        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-AL-3',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $this->postJson("/api/work-orders/{$wo->id}/printing/time-segments/start", [
            'segment_type' => 'mount',
        ], $h)->assertCreated();

        Carbon::setTestNow(Carbon::parse('2026-04-20 09:05:00'));

        $state = $this->getJson("/api/work-orders/{$wo->id}/printing", $h)->assertOk();
        $segId = $state->json('open_time_segment.id');

        $this->postJson("/api/work-orders/{$wo->id}/printing/time-segments/{$segId}/stop", [], $h)->assertOk();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::MountTimeExceeded->value,
            'work_order_id' => $wo->id,
        ]);

        Carbon::setTestNow();
    }

    public function test_dashboard_includes_unread_alerts_count(): void
    {
        $user = User::factory()->create();
        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'severity' => 'critical',
            'message' => 'X',
            'work_order_id' => null,
        ]);

        $r = $this->getJson('/api/dashboard/summary', $this->auth($user))->assertOk();
        $this->assertEquals(1, $r->json('operational_alerts_unread'));
    }
}
