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
        $this->assertStringContainsString('sep=;', $body);
        $this->assertStringContainsString('Sección', $body);
        $this->assertStringContainsString('Kg impreso', $body);
        $this->assertStringContainsString('Material o referencia', $body);
        $this->assertStringContainsString('Resumen planta', $body);
        $this->assertStringContainsString('Material planta', $body);
        $this->assertStringContainsString('Total por OT', $body);
        $this->assertStringContainsString('Material por OT', $body);
        $this->assertStringContainsString('Total planta', $body);
        $this->assertStringContainsString('OT-PROD-A', $body);
        $this->assertStringContainsString('175.000', $body);
        $this->assertStringContainsString('225.000', $body);
        $this->assertStringNotContainsString('material_impreso_kg', $body);
        $this->assertStringNotContainsString('[{', $body);

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

    public function test_production_material_summary_shows_planilla_sustrato_instead_of_sin_referencia(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 12:00:00'));

        $user = User::factory()->create();
        $h = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-SUSTRATO',
            'document_date' => '2026-06-05',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'sustratosVirgenImp' => [
                    ['material_id' => '', 'kg' => '420.50', 'material_free_text' => 'BOPP 20µ'],
                ],
                'impTurnosImpresion' => [[
                    'salidaBobinasKg' => ['500', '769'],
                    'salidaBobinasMeta' => [
                        ['referencia' => '', 'proveedor' => ''],
                        ['referencia' => '', 'proveedor' => ''],
                    ],
                ]],
            ],
        ]);

        $this->getJson('/api/reports/production-material-summary?from=2026-06-01&to=2026-06-30', $h)
            ->assertOk()
            ->assertJsonPath('totals.material_impreso_kg', '1269.000')
            ->assertJsonPath('totals.material_impreso_lines.0.label', 'BOPP 20µ')
            ->assertJsonPath('totals.material_impreso_lines.0.kg', '1269.000')
            ->assertJsonPath('totals.material_impreso_lines.0.bobinas', 2);

        Carbon::setTestNow();
    }

    public function test_production_material_summary_does_not_use_finished_product_for_impreso_label(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 12:00:00'));

        $user = User::factory()->create();
        $h = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-NO-TERM',
            'document_date' => '2026-06-05',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'sustratosVirgenImp' => [
                    ['material_id' => '', 'kg' => '', 'material_free_text' => ''],
                ],
                'impTurnosImpresion' => [[
                    'salidaBobinasKg' => ['80'],
                    'salidaBobinasMeta' => [
                        ['referencia' => '', 'proveedor' => ''],
                    ],
                ]],
            ],
        ]);

        $this->getJson('/api/reports/production-material-summary?from=2026-06-01&to=2026-06-30', $h)
            ->assertOk()
            ->assertJsonPath('totals.material_impreso_lines.0.label', 'Bobina impresa (sin referencia)');

        Carbon::setTestNow();
    }

    /**
     * Escenario de validación operativa (Valeria): 2 OTs, cada una con 2 controles
     * de impresión, 2 de laminación y 2 de corte — verificar suma y filtrado.
     */
    public function test_production_material_summary_two_ots_two_controls_per_area_sums_and_filters(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-13 18:00:00'));

        $user = User::factory()->create();
        $h = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $client = Client::query()->create(['name' => 'Cliente Prueba Suma', 'rif' => 'J-PRUEBA-1']);

        $wo1 = WorkOrder::query()->create([
            'code' => 'PRUEBA-SUMA-1',
            'client_id' => $client->id,
            'document_date' => '2026-06-13',
            'created_at' => '2026-06-13 10:00:00',
            'updated_at' => '2026-06-13 10:00:00',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo1->id,
            'form' => [
                'impTurnosImpresion' => [
                    ['id' => 'pi-1', 'closed_at' => '2026-06-13 11:00:00', 'salidaBobinasKg' => ['100']],
                    ['id' => 'pi-2', 'closed_at' => '2026-06-13 12:00:00', 'salidaBobinasKg' => ['50']],
                ],
                'lamTurnosLaminacion' => [
                    ['id' => 'lam-1', 'closed_at' => '2026-06-13 13:00:00', 'salidaBobinasKg' => ['80']],
                    ['id' => 'lam-2', 'closed_at' => '2026-06-13 14:00:00', 'salidaBobinasKg' => ['20']],
                ],
                'cor_turnos' => [
                    ['id' => 'cor-1', 'closed_at' => '2026-06-13 15:00:00', 'metrics' => ['salida_total_kg' => '60']],
                    ['id' => 'cor-2', 'closed_at' => '2026-06-13 16:00:00', 'metrics' => ['salida_total_kg' => '40']],
                ],
            ],
        ]);

        $wo2 = WorkOrder::query()->create([
            'code' => 'PRUEBA-SUMA-2',
            'client_id' => $client->id,
            'document_date' => '2026-06-13',
            'created_at' => '2026-06-13 10:30:00',
            'updated_at' => '2026-06-13 10:30:00',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo2->id,
            'form' => [
                'impTurnosImpresion' => [
                    ['id' => 'pi-3', 'closed_at' => '2026-06-13 11:30:00', 'salidaBobinasKg' => ['200']],
                    ['id' => 'pi-4', 'closed_at' => '2026-06-13 12:30:00', 'salidaBobinasKg' => ['30']],
                ],
                'lamTurnosLaminacion' => [
                    ['id' => 'lam-3', 'closed_at' => '2026-06-13 13:30:00', 'salidaBobinasKg' => ['70']],
                    ['id' => 'lam-4', 'closed_at' => '2026-06-13 14:30:00', 'salidaBobinasKg' => ['30']],
                ],
                'cor_turnos' => [
                    ['id' => 'cor-3', 'closed_at' => '2026-06-13 15:30:00', 'metrics' => ['salida_total_kg' => '25']],
                    ['id' => 'cor-4', 'closed_at' => '2026-06-13 16:30:00', 'metrics' => ['salida_total_kg' => '75']],
                ],
            ],
        ]);

        // Suma planta: OT1 (150+100+100) + OT2 (230+100+100) = 380 + 200 + 200 = 780
        $plant = $this->getJson('/api/reports/production-material-summary?from=2026-06-13&to=2026-06-13', $h);
        $plant->assertOk()
            ->assertJsonPath('totals.material_impreso_kg', '380.000')
            ->assertJsonPath('totals.material_laminado_kg', '200.000')
            ->assertJsonPath('totals.material_cortado_kg', '200.000')
            ->assertJsonPath('totals.total_general_kg', '780.000')
            ->assertJsonPath('work_order_count', 2);

        $rows = $plant->json('work_orders');
        $this->assertCount(2, $rows);
        $byCode = collect($rows)->keyBy('work_order_code');
        $this->assertSame('150.000', $byCode['PRUEBA-SUMA-1']['material_impreso_kg']);
        $this->assertSame('100.000', $byCode['PRUEBA-SUMA-1']['material_laminado_kg']);
        $this->assertSame('100.000', $byCode['PRUEBA-SUMA-1']['material_cortado_kg']);
        $this->assertSame('230.000', $byCode['PRUEBA-SUMA-2']['material_impreso_kg']);
        $this->assertSame('100.000', $byCode['PRUEBA-SUMA-2']['material_laminado_kg']);
        $this->assertSame('100.000', $byCode['PRUEBA-SUMA-2']['material_cortado_kg']);

        // Footer = suma de filas
        $rowImpSum = array_sum(array_map(
            fn (array $r): float => (float) $r['material_impreso_kg'],
            $rows,
        ));
        $rowLamSum = array_sum(array_map(
            fn (array $r): float => (float) $r['material_laminado_kg'],
            $rows,
        ));
        $rowCorSum = array_sum(array_map(
            fn (array $r): float => (float) $r['material_cortado_kg'],
            $rows,
        ));
        $this->assertSame(380.0, $rowImpSum);
        $this->assertSame(200.0, $rowLamSum);
        $this->assertSame(200.0, $rowCorSum);
        $this->assertSame(780.0, $rowImpSum + $rowLamSum + $rowCorSum);

        // Filtrado: fuera del período no deben aparecer
        $this->getJson('/api/reports/production-material-summary?from=2026-06-01&to=2026-06-12', $h)
            ->assertOk()
            ->assertJsonPath('work_order_count', 0)
            ->assertJsonPath('totals.total_general_kg', '0.000');

        // Resumen por OT (controles agregados en una sola OT)
        $this->getJson('/api/reports/work-order-controls-summary?work_order_id='.$wo1->id, $h)
            ->assertOk()
            ->assertJsonPath('production_summary.material_listo.impreso.peso_total_kg', '150.000')
            ->assertJsonPath('production_summary.material_listo.laminado.peso_total_salida_kg', '100.000')
            ->assertJsonPath('production_summary.material_listo.corte_kg_salida', '100.000')
            ->assertJsonPath('production_summary.material_listo.total_general_kg', '350.000');

        $this->getJson('/api/reports/work-order-controls-summary?work_order_id='.$wo2->id, $h)
            ->assertOk()
            ->assertJsonPath('production_summary.material_listo.impreso.peso_total_kg', '230.000')
            ->assertJsonPath('production_summary.material_listo.laminado.peso_total_salida_kg', '100.000')
            ->assertJsonPath('production_summary.material_listo.corte_kg_salida', '100.000')
            ->assertJsonPath('production_summary.material_listo.total_general_kg', '430.000');

        Carbon::setTestNow();
    }
}
