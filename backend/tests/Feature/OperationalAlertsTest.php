<?php

namespace Tests\Feature;

use App\Enums\ClientOrderStatus;
use App\Enums\OperationalAlertType;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\Material;
use App\Models\OperationalAlert;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\WorkOrderOrdenTrabajoService;
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
        $user = User::factory()->create(['role' => 'boss']);
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
        $user = User::factory()->create(['role' => 'boss']);
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

    public function test_acknowledge_all_marks_only_visible_alerts_for_area_user(): void
    {
        $printingUser = User::factory()->create(['role' => 'impresion']);

        $aPrinting = OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'severity' => 'critical',
            'message' => 'Impresión',
            'metadata' => ['target_area' => 'impresion'],
        ]);
        $aLaminacion = OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'severity' => 'critical',
            'message' => 'Laminación',
            'metadata' => ['target_area' => 'laminacion'],
        ]);

        $this->postJson('/api/alerts/acknowledge-all', [], $this->auth($printingUser))
            ->assertOk()
            ->assertJsonPath('updated_count', 2);

        $this->assertNotNull($aPrinting->fresh()->acknowledged_at);
        $this->assertNotNull($aLaminacion->fresh()->acknowledged_at);
    }

    public function test_index_excludes_workflow_alerts_by_default(): void
    {
        $user = User::factory()->create(['role' => 'boss']);

        OperationalAlert::query()->create([
            'alert_type' => 'production_saved',
            'severity' => 'info',
            'message' => 'Ruido',
        ]);
        $materialAlert = OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'severity' => 'warning',
            'message' => 'Desperdicio',
        ]);

        $list = $this->getJson('/api/alerts', $this->auth($user))->assertOk();
        $ids = collect($list->json('data'))->pluck('id')->all();

        $this->assertContains($materialAlert->id, $ids);
        $this->assertSame(1, $list->json('total'));
    }

    public function test_low_stock_alert_after_inventory_out(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $mat = Material::query()->create([
            'sku' => 'LOW-1',
            'name' => 'Material bajo',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 10,
        ]);
        $mat->forceFill(['quantity_on_hand' => 12])->save();

        $this->postJson("/api/materials/{$mat->id}/movements", [
            'movement_type' => 'out',
            'quantity' => 5,
        ], $this->auth($user))->assertCreated();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::MaterialLowStock->value,
            'material_id' => $mat->id,
        ]);
    }

    public function test_scrap_percent_triggers_alert_above_threshold(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create(['role' => 'boss']);
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

        $user = User::factory()->create(['role' => 'boss']);
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
        $this->assertStringContainsString('Desperdicio', (string) $msg);
    }

    public function test_laminacion_scrap_percent_triggers_alert_above_threshold(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create(['role' => 'boss']);
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

    public function test_corte_planilla_scrap_triggers_alert_above_threshold(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create(['role' => 'corte']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PL-CORTE',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'kgIngresadosCorte' => '300',
                'corScrapImpresoKg' => '20',
            ],
        ], $this->auth($user))->assertOk();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'work_order_id' => $wo->id,
        ]);

        $msg = OperationalAlert::query()->where('work_order_id', $wo->id)->latest('id')->value('message');
        $this->assertStringContainsString('corte', mb_strtolower((string) $msg));
        $this->assertStringContainsString('6.667', (string) $msg);
    }

    public function test_corte_planilla_scrap_below_threshold_does_not_alert(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create(['role' => 'corte']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PL-CORTE-LOW',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'kgIngresadosCorte' => '300',
                'corScrapImpresoKg' => '10',
            ],
        ], $this->auth($user))->assertOk();

        $this->assertDatabaseMissing('operational_alerts', [
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'work_order_id' => $wo->id,
        ]);
    }

    public function test_impresion_planilla_scrap_triggers_alert_above_threshold(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create(['role' => 'impresion']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PL-IMP',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impScrapTransparenteKg' => '10000',
                'impScrapImpresoKg' => '100000',
                'impEntradaBobinasKg' => ['1000000'],
            ],
        ], $this->auth($user))->assertOk();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'work_order_id' => $wo->id,
        ]);
    }

    public function test_impresion_planilla_scrap_triggers_alert_with_pedido_fallback(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create(['role' => 'impresion']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PL-IMP-PED',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        app(WorkOrderOrdenTrabajoService::class)->syncForm($wo, ['pedidoKg' => '93680'], $user);

        $h = $this->auth($user);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impScrapTransparenteKg' => '2342',
                'impScrapImpresoKg' => '2342',
            ],
        ], $h)->assertOk();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'work_order_id' => $wo->id,
        ]);

        $msg = OperationalAlert::query()->where('work_order_id', $wo->id)->latest('id')->value('message');
        $this->assertStringContainsString('5.000', (string) $msg);
    }

    public function test_scrap_alert_updates_existing_unread_row(): void
    {
        config(['axones.alerts.scrap_percent_threshold' => 5]);

        $user = User::factory()->create(['role' => 'corte']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PL-UPD',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $h = $this->auth($user);
        $payload = [
            'form' => [
                'kgIngresadosCorte' => '300',
                'corScrapImpresoKg' => '20',
            ],
        ];

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", $payload, $h)->assertOk();
        $this->assertSame(1, OperationalAlert::query()->where('work_order_id', $wo->id)->count());

        $payload['form']['corScrapImpresoKg'] = '25';
        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", $payload, $h)->assertOk();
        $this->assertSame(1, OperationalAlert::query()->where('work_order_id', $wo->id)->count());

        $msg = OperationalAlert::query()->where('work_order_id', $wo->id)->value('message');
        $this->assertStringContainsString('8.333', (string) $msg);
    }

    public function test_planilla_sustrato_shortage_creates_alert_for_boss(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-SUS-AL',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'SUB-420',
            'name' => 'BOPP transparente',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 100])->save();

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

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
        ]);

        $msg = OperationalAlert::query()->where('work_order_id', $wo->id)->latest('id')->value('message');
        $this->assertStringContainsString('420.50', (string) $msg);
        $this->assertStringContainsString('Impresión', (string) $msg);

        $list = $this->getJson('/api/alerts', $this->auth(User::factory()->create(['role' => 'boss'])))->assertOk();
        $ids = collect($list->json('data'))->pluck('id')->all();
        $alertId = OperationalAlert::query()
            ->where('work_order_id', $wo->id)
            ->where('alert_type', OperationalAlertType::OtMaterialShortage->value)
            ->value('id');
        $this->assertContains($alertId, $ids);
    }

    public function test_planilla_sustrato_shortage_post_creates_draft_alert_by_client_order(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'Pruebas', 'rif' => 'J-99']);
        $co = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => ClientOrder::nextCode(),
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'SUB-DRAFT',
            'name' => 'BOPP borrador',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 1])->save();

        $this->postJson('/api/planilla-sustrato-shortage-alerts', [
            'client_order_id' => $co->id,
            'lines' => [
                [
                    'material_id' => $mat->id,
                    'quantity_requested' => '3',
                    'originating_area' => 'laminacion',
                    'area_label' => 'Laminación',
                ],
            ],
        ], $h)->assertCreated();

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'work_order_id' => null,
            'material_id' => $mat->id,
        ]);

        $list = $this->getJson('/api/alerts', $h)->assertOk();
        $this->assertNotEmpty($list->json('data'));
    }

    public function test_mount_segment_exceeding_threshold_creates_alert(): void
    {
        config(['axones.alerts.mount_seconds_threshold' => 120]);

        Carbon::setTestNow(Carbon::parse('2026-04-20 09:00:00'));
        $user = User::factory()->create(['role' => 'boss']);
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
        $user = User::factory()->create(['role' => 'boss']);
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
