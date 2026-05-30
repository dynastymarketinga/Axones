<?php

namespace Tests\Feature;

use App\Enums\OperationalAlertType;
use App\Models\OperationalAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CleanupOperationalAlertsCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_removes_workflow_alerts_and_keeps_material_operational(): void
    {
        OperationalAlert::query()->create([
            'alert_type' => 'production_saved',
            'severity' => 'info',
            'message' => 'Ruido',
        ]);
        OperationalAlert::query()->create([
            'alert_type' => 'work_order_created',
            'severity' => 'info',
            'message' => 'Ruido 2',
        ]);
        $keep = OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::ScrapThresholdExceeded->value,
            'severity' => 'warning',
            'message' => 'Desperdicio',
        ]);

        $this->artisan('axones:cleanup-operational-alerts')
            ->assertSuccessful();

        $this->assertDatabaseCount('operational_alerts', 1);
        $this->assertDatabaseHas('operational_alerts', ['id' => $keep->id]);
    }

    public function test_full_reset_deletes_everything(): void
    {
        OperationalAlert::query()->create([
            'alert_type' => OperationalAlertType::OtMaterialShortage->value,
            'severity' => 'critical',
            'message' => 'X',
        ]);

        $this->artisan('axones:cleanup-operational-alerts --full-reset')
            ->assertSuccessful();

        $this->assertDatabaseCount('operational_alerts', 0);
    }
}
