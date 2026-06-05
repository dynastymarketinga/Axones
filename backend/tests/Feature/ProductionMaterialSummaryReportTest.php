<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductionMaterialSummaryReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_material_summary_requires_auth(): void
    {
        $this->getJson('/api/reports/production-material-summary?from=2026-01-01&to=2026-12-31')
            ->assertUnauthorized();
    }

    public function test_production_material_summary_aggregates_by_date_and_client(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 12:00:00'));

        $user = User::factory()->create();
        $h = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $clientA = Client::query()->create(['name' => 'Cliente A', 'rif' => 'J-A1']);
        $clientB = Client::query()->create(['name' => 'Cliente B', 'rif' => 'J-B1']);

        $woA = WorkOrder::query()->create([
            'code' => 'OT-PROD-A',
            'client_id' => $clientA->id,
            'document_date' => '2026-03-10',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woA->id,
            'form' => [
                'impTurnosImpresion' => [[
                    'salidaBobinasKg' => ['100', '50'],
                ]],
                'lamTurnosLaminacion' => [[
                    'salidaBobinasKg' => ['30'],
                ]],
                'cor_turnos' => [[
                    'closed_at' => '2026-03-10T18:00:00Z',
                    'metrics' => ['salida_total_kg' => '20'],
                ]],
            ],
        ]);

        $woB = WorkOrder::query()->create([
            'code' => 'OT-PROD-B',
            'client_id' => $clientB->id,
            'document_date' => '2026-03-12',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woB->id,
            'form' => [
                'impTurnosImpresion' => [[
                    'salidaBobinasKg' => ['25'],
                ]],
            ],
        ]);

        $this->getJson('/api/reports/production-material-summary?from=2026-03-01&to=2026-03-31', $h)
            ->assertOk()
            ->assertJsonPath('totals.material_impreso_kg', '175.000')
            ->assertJsonPath('totals.material_laminado_kg', '30.000')
            ->assertJsonPath('totals.material_cortado_kg', '20.000')
            ->assertJsonPath('totals.total_general_kg', '225.000')
            ->assertJsonPath('work_order_count', 2)
            ->assertJsonPath('totals.material_impreso_lines.0.kg', '175.000')
            ->assertJsonPath('totals.material_laminado_lines.0.kg', '30.000')
            ->assertJsonPath('totals.material_cortado_lines.0.kg', '20.000');

        $this->getJson('/api/reports/production-material-summary?from=2026-03-01&to=2026-03-31&client_id='.$clientA->id, $h)
            ->assertOk()
            ->assertJsonPath('totals.material_impreso_kg', '150.000')
            ->assertJsonPath('totals.material_laminado_kg', '30.000')
            ->assertJsonPath('totals.material_cortado_kg', '20.000')
            ->assertJsonPath('work_order_count', 1)
            ->assertJsonPath('work_orders.0.work_order_code', 'OT-PROD-A');

        $csv = $this->get('/api/reports/production-material-summary?from=2026-03-01&to=2026-03-31&format=csv', $h);
        $csv->assertOk();
        $body = (string) $csv->getContent();
        $this->assertStringContainsString('material_impreso_kg', $body);
        $this->assertStringContainsString('TOTAL', $body);
        $this->assertStringContainsString('OT-PROD-A', $body);

        Carbon::setTestNow();
    }

    public function test_production_material_summary_uses_cor_paletas_when_turnos_have_no_salida(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 12:00:00'));

        $user = User::factory()->create();
        $h = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-PAL',
            'document_date' => '2026-04-10',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'cor_turnos' => [[
                    'id' => 't-open',
                    'turno' => 'diurno',
                ]],
                'cor_paletas' => [[
                    'id' => 'p1',
                    'label' => 'Paleta #01',
                    'rollosKg' => ['12', '8'],
                ]],
                'kgSalidaCorte' => '20.00',
            ],
        ]);

        $this->getJson('/api/reports/production-material-summary?from=2026-04-01&to=2026-04-30', $h)
            ->assertOk()
            ->assertJsonPath('totals.material_cortado_kg', '20.000')
            ->assertJsonPath('totals.material_cortado_lines.0.kg', '20.000')
            ->assertJsonPath('work_orders.0.material_cortado_kg', '20.000');

        Carbon::setTestNow();
    }

    public function test_production_material_summary_breaks_down_impreso_by_referencia(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 12:00:00'));

        $user = User::factory()->create();
        $h = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-REF',
            'document_date' => '2026-05-05',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'impTurnosImpresion' => [[
                    'salidaBobinasKg' => ['100', '50'],
                    'salidaBobinasMeta' => [
                        ['referencia' => 'BOPP 20μ', 'proveedor' => 'Proveedor A'],
                        ['referencia' => 'PET 12μ', 'proveedor' => ''],
                    ],
                ]],
            ],
        ]);

        $this->getJson('/api/reports/production-material-summary?from=2026-05-01&to=2026-05-31', $h)
            ->assertOk()
            ->assertJsonPath('totals.material_impreso_kg', '150.000')
            ->assertJsonPath('totals.material_impreso_lines.0.label', 'BOPP 20μ (Proveedor A)')
            ->assertJsonPath('totals.material_impreso_lines.0.kg', '100.000')
            ->assertJsonPath('totals.material_impreso_lines.1.label', 'PET 12μ')
            ->assertJsonPath('totals.material_impreso_lines.1.kg', '50.000');

        Carbon::setTestNow();
    }
}
