<?php

namespace Tests\Unit;

use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use App\Support\WorkOrderProductionControlsAggregator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderProductionControlsAggregatorTest extends TestCase
{
    use RefreshDatabase;

    public function test_summarize_aggregates_planilla_turnos(): void
    {
        $user = User::factory()->create();
        $client = Client::query()->create(['name' => 'C', 'rif' => 'J-1']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P',
            'cpe' => 'CPE-1',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-AGG-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'impTurnosImpresion' => [[
                    'id' => 'p1',
                    'closed_at' => '2026-05-01 10:00:00',
                    'entradaBobinasKg' => ['200'],
                    'salidaBobinasKg' => ['180', '20'],
                    'scrapTransparenteKg' => '4',
                    'scrapImpresoKg' => '2',
                ]],
                'lamTurnosLaminacion' => [[
                    'id' => 'l1',
                    'closed_at' => '2026-05-02 10:00:00',
                    'entradaVirgenBobinasKg' => ['30'],
                    'salidaBobinasKg' => ['28', '0'],
                    'adhesivoEntradaKg' => '5',
                    'adhesivoSobroKg' => '1',
                ]],
                'cor_turnos' => [[
                    'id' => 'c1',
                    'closed_at' => '2026-05-03 10:00:00',
                    'metrics' => ['salida_total_kg' => '15'],
                    'paletas' => [],
                ]],
            ],
        ]);

        $summary = WorkOrderProductionControlsAggregator::summarize((int) $wo->id);

        $this->assertSame('200.000', $summary['virgin_material']['printing_total_entrada_kg']);
        $this->assertSame('30.000', $summary['virgin_material']['laminacion_total_virgen_kg']);
        $this->assertSame(2, $summary['material_listo']['impreso']['num_bobinas']);
        $this->assertSame('200.000', $summary['material_listo']['impreso']['peso_total_kg']);
        $this->assertSame('28.000', $summary['material_listo']['laminado']['peso_total_salida_kg']);
        $this->assertSame('15.000', $summary['material_listo']['corte_kg_salida']);
        $this->assertSame('15.000', $summary['material_listo']['total_listo_despacho_kg']);
        $this->assertSame('243.000', $summary['material_listo']['total_general_kg']);
        $this->assertSame('4.000', $summary['laminacion_quimicos']['adhesivo_consumido_kg']);
    }

    public function test_summarize_includes_montaje_kg_from_turnos(): void
    {
        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MONT-KG',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'montTurnosMontaje' => [[
                    'id' => 'm1',
                    'closed_at' => '2026-06-01 10:00:00',
                    'kgProduccion' => '120.5',
                    'mermaKg' => '2.5',
                ]],
                'montTurnoActual' => [
                    'id' => 'm2',
                    'started_at' => '2026-06-02 08:00:00',
                    'kgProduccion' => '30',
                    'mermaKg' => '1',
                ],
            ],
        ]);

        $summary = WorkOrderProductionControlsAggregator::summarize((int) $wo->id);

        $this->assertSame('150.500', $summary['montaje_consumo']['total_produccion_kg']);
        $this->assertSame('3.500', $summary['montaje_consumo']['total_merma_kg']);
    }

    public function test_material_totals_prefers_cor_paletas_over_empty_turnos(): void
    {
        $totals = WorkOrderProductionControlsAggregator::materialTotalsFromForm([
            'cor_turnos' => [[
                'id' => 't1',
                'closed_at' => '2026-05-03 10:00:00',
                'metrics' => ['salida_total_kg' => '0'],
            ]],
            'cor_paletas' => [[
                'id' => 'p1',
                'label' => 'Paleta #01',
                'rollosKg' => ['25'],
            ]],
            'kgSalidaCorte' => '25.00',
        ]);

        $this->assertSame(25.0, $totals['corte_kg']);
    }

    public function test_material_salida_breakdown_groups_impreso_by_referencia(): void
    {
        $breakdown = WorkOrderProductionControlsAggregator::materialSalidaBreakdownFromForm([
            'impTurnosImpresion' => [[
                'salidaBobinasKg' => ['40', '10'],
                'salidaBobinasMeta' => [
                    ['referencia' => 'BOPP', 'proveedor' => ''],
                    ['referencia' => 'BOPP', 'proveedor' => ''],
                ],
            ]],
        ]);

        $this->assertCount(1, $breakdown['impreso']);
        $this->assertSame('BOPP', $breakdown['impreso'][0]['label']);
        $this->assertSame(50.0, $breakdown['impreso'][0]['kg']);
        $this->assertSame(2, $breakdown['impreso'][0]['bobinas']);
    }

    public function test_material_salida_breakdown_corte_uses_area_sustrato_not_product_name(): void
    {
        $breakdown = WorkOrderProductionControlsAggregator::materialSalidaBreakdownFromForm([
            'corDesperdicioSustrato' => 'bopp',
            'cor_paletas' => [[
                'id' => 'p1',
                'rollosKg' => ['12', '8'],
            ]],
            'kgSalidaCorte' => '20.00',
        ], [], 'dsfsfd — dfgdgd');

        $this->assertCount(1, $breakdown['cortado']);
        $this->assertSame('BOPP', $breakdown['cortado'][0]['label']);
        $this->assertSame(20.0, $breakdown['cortado'][0]['kg']);
        $this->assertSame(2, $breakdown['cortado'][0]['bobinas']);
    }

    public function test_material_salida_breakdown_corte_falls_back_to_impreso_referencia(): void
    {
        $breakdown = WorkOrderProductionControlsAggregator::materialSalidaBreakdownFromForm([
            'impTurnosImpresion' => [[
                'salidaBobinasKg' => ['100'],
                'salidaBobinasMeta' => [
                    ['referencia' => 'Polietileno transparente', 'proveedor' => ''],
                ],
            ]],
            'cor_paletas' => [[
                'id' => 'p1',
                'rollosKg' => ['15'],
            ]],
            'kgSalidaCorte' => '15.00',
        ]);

        $this->assertSame('Polietileno transparente', $breakdown['cortado'][0]['label']);
    }

    public function test_material_salida_breakdown_impreso_uses_planilla_sustrato_when_meta_empty(): void
    {
        $breakdown = WorkOrderProductionControlsAggregator::materialSalidaBreakdownFromForm([
            'sustratosVirgenImp' => [
                ['material_id' => '', 'kg' => '420.50', 'material_free_text' => 'BOPP 20µ'],
            ],
            'impTurnosImpresion' => [[
                'salidaBobinasKg' => ['200', '50'],
                'salidaBobinasMeta' => [
                    ['referencia' => '', 'proveedor' => ''],
                    ['referencia' => '', 'proveedor' => ''],
                ],
            ]],
        ]);

        $this->assertCount(1, $breakdown['impreso']);
        $this->assertSame('BOPP 20µ', $breakdown['impreso'][0]['label']);
        $this->assertSame(250.0, $breakdown['impreso'][0]['kg']);
        $this->assertSame(2, $breakdown['impreso'][0]['bobinas']);
    }

    public function test_material_salida_breakdown_impreso_splits_multiple_planilla_sustratos(): void
    {
        $breakdown = WorkOrderProductionControlsAggregator::materialSalidaBreakdownFromForm([
            'sustratosVirgenImp' => [
                ['material_id' => '', 'kg' => '300', 'material_free_text' => 'BOPP 20µ'],
                ['material_id' => '', 'kg' => '100', 'material_free_text' => 'PET 12µ'],
            ],
            'impTurnosImpresion' => [[
                'salidaBobinasKg' => ['400'],
                'salidaBobinasMeta' => [
                    ['referencia' => '', 'proveedor' => ''],
                ],
            ]],
        ]);

        $this->assertCount(2, $breakdown['impreso']);
        $labels = array_column($breakdown['impreso'], 'label');
        $this->assertContains('BOPP 20µ', $labels);
        $this->assertContains('PET 12µ', $labels);
        $this->assertSame(400.0, array_sum(array_column($breakdown['impreso'], 'kg')));
    }

    public function test_material_salida_breakdown_impreso_uses_entrada_meta_when_salida_meta_empty(): void
    {
        $breakdown = WorkOrderProductionControlsAggregator::materialSalidaBreakdownFromForm([
            'impTurnosImpresion' => [[
                'salidaBobinasKg' => ['75'],
                'salidaBobinasMeta' => [
                    ['referencia' => '', 'proveedor' => ''],
                ],
                'entradaBobinasMeta' => [
                    ['referencia' => 'Poliéster metalizado', 'proveedor' => 'Proveedor X'],
                ],
            ]],
        ]);

        $this->assertSame('Poliéster metalizado (Proveedor X)', $breakdown['impreso'][0]['label']);
        $this->assertSame(75.0, $breakdown['impreso'][0]['kg']);
    }

    public function test_material_salida_breakdown_impreso_uses_resumen_cierre_with_planilla_sustrato(): void
    {
        $breakdown = WorkOrderProductionControlsAggregator::materialSalidaBreakdownFromForm([
            'sustratosVirgenImp' => [
                ['material_id' => '', 'kg' => '420.50', 'material_free_text' => 'BOPP 20µ'],
            ],
            'impTurnosImpresion' => [[
                'salidaBobinasKg' => [],
                'salidaBobinasMeta' => [],
                'resumenCierre' => [
                    'pesoSalidaKg' => 1269,
                    'numBobinasSalida' => 5,
                ],
            ]],
        ]);

        $this->assertCount(1, $breakdown['impreso']);
        $this->assertSame('BOPP 20µ', $breakdown['impreso'][0]['label']);
        $this->assertSame(1269.0, $breakdown['impreso'][0]['kg']);
        $this->assertSame(5, $breakdown['impreso'][0]['bobinas']);
    }
}
