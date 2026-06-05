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
}
