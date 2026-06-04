<?php

namespace Tests\Feature;

use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\CorteBobinaUsage;
use App\Models\CorteTimeSegment;
use App\Models\LaminacionBobinaUsage;
use App\Models\LaminacionTimeSegment;
use App\Models\Material;
use App\Models\PrintingBobinaUsage;
use App\Models\PrintingChemicalUsage;
use App\Models\PrintingInkControlLine;
use App\Models\PrintingTimeSegment;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderLaminacionSummary;
use App\Models\WorkOrderTechnicalDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderControlsSummaryReportTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_controls_summary_requires_auth(): void
    {
        $this->getJson('/api/reports/work-order-controls-summary?work_order_id=1')
            ->assertUnauthorized();
    }

    public function test_controls_summary_aggregates_consumables_and_times_for_three_areas(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $client = Client::query()->create(['name' => 'Cliente CS', 'rif' => 'J-200-1']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Bolsa CS',
            'cpe' => 'CPE-CS-1',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CS-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'SUB-CS',
            'name' => 'Sustrato CS',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        PrintingBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_used_kg' => 10,
            'quantity_finished_kg' => 8,
        ]);
        LaminacionBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_used_kg' => 5,
            'quantity_finished_kg' => 4.5,
        ]);
        CorteBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_used_kg' => 3,
            'quantity_finished_kg' => 2.8,
        ]);

        PrintingInkControlLine::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_original_kg' => 2,
            'quantity_solventada_kg' => 0.5,
            'quantity_return_kg' => 0.2,
        ]);
        PrintingChemicalUsage::query()->create([
            'work_order_id' => $wo->id,
            'chemical_type' => 'alcohol',
            'quantity_loaded_kg' => 1.5,
            'quantity_return_kg' => 0.3,
        ]);
        WorkOrderLaminacionSummary::query()->create([
            'work_order_id' => $wo->id,
            'solvent_quantity_kg' => 0.75,
            'solvent_notes' => 'Solvente laminación',
        ]);

        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'started_at' => '2026-05-10 08:00:00',
            'ended_at' => '2026-05-10 09:00:00',
            'user_id' => $user->id,
        ]);
        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'downtime',
            'started_at' => '2026-05-10 09:00:00',
            'ended_at' => '2026-05-10 09:10:00',
            'user_id' => $user->id,
        ]);
        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'mount',
            'started_at' => '2026-05-10 07:50:00',
            'ended_at' => '2026-05-10 08:00:00',
            'user_id' => $user->id,
        ]);

        LaminacionTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'started_at' => '2026-05-11 08:00:00',
            'ended_at' => '2026-05-11 08:30:00',
            'user_id' => $user->id,
        ]);
        CorteTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'mount',
            'started_at' => '2026-05-12 07:00:00',
            'ended_at' => '2026-05-12 07:20:00',
            'user_id' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'impTurnosImpresion' => [[
                    'id' => 't1',
                    'closed_at' => '2026-05-10 12:00:00',
                    'entradaBobinasKg' => ['100', '50'],
                    'salidaBobinasKg' => ['90', ''],
                    'scrapTransparenteKg' => '5',
                    'scrapImpresoKg' => '3',
                    'capturas' => [],
                ]],
                'lamTurnosLaminacion' => [[
                    'id' => 'l1',
                    'closed_at' => '2026-05-11 12:00:00',
                    'entradaVirgenBobinasKg' => ['40'],
                    'salidaBobinasKg' => ['38'],
                    'adhesivoEntradaKg' => '10',
                    'adhesivoSobroKg' => '2',
                    'catalizadorEntradaKg' => '1',
                    'catalizadorSobroKg' => '0.2',
                    'acetatoEntradaLt' => '3',
                    'acetatoSobroLt' => '0.5',
                ]],
                'cor_turnos' => [[
                    'id' => 'c1',
                    'closed_at' => '2026-05-12 12:00:00',
                    'metrics' => [
                        'salida_total_kg' => '25',
                        'scrap_refile_kg' => '1',
                        'scrap_impreso_kg' => '0.5',
                        'scrap_mal_corte_kg' => '0.25',
                    ],
                    'paletas' => [],
                ]],
                'montMaterialesMontaje' => [[
                    'stickyBack' => 'Reverso',
                    'codigo' => 'SB-01',
                    'color' => 'Cyan',
                    'cantidad' => '2',
                ]],
            ],
        ]);

        $response = $this->getJson(
            '/api/reports/work-order-controls-summary?work_order_id='.$wo->id,
            $h,
        );

        $response->assertOk()
            ->assertJsonPath('work_order.code', 'OT-CS-1')
            ->assertJsonPath('consumables.by_area.printing.bobina_usages.0.quantity_used_kg', '10.000')
            ->assertJsonPath('consumables.by_area.laminacion.solvent_quantity_kg', '0.750')
            ->assertJsonPath('consumables.by_area.corte.bobina_usages.0.quantity_used_kg', '3.000')
            ->assertJsonPath('times.by_area.0.area', 'printing')
            ->assertJsonPath('times.totals.production_seconds', 3600 + 1800)
            ->assertJsonPath('times.totals.downtime_seconds', 600)
            ->assertJsonPath('times.totals.mount_seconds', 600 + 1200)
            ->assertJsonPath('production_summary.virgin_material.printing_total_entrada_kg', '150.000')
            ->assertJsonPath('production_summary.virgin_material.laminacion_total_virgen_kg', '40.000')
            ->assertJsonPath('production_summary.material_listo.impreso.num_bobinas', 1)
            ->assertJsonPath('production_summary.material_listo.impreso.peso_total_kg', '90.000')
            ->assertJsonPath('production_summary.material_listo.laminado.peso_total_salida_kg', '38.000')
            ->assertJsonPath('production_summary.material_listo.corte_kg_salida', '25.000')
            ->assertJsonPath('production_summary.material_listo.total_listo_despacho_kg', '25.000')
            ->assertJsonPath('production_summary.material_listo.total_general_kg', '153.000')
            ->assertJsonPath('production_summary.tintas.alcohol_kg', '1.200')
            ->assertJsonPath('production_summary.laminacion_quimicos.adhesivo_consumido_kg', '8.000')
            ->assertJsonPath('production_summary.montaje_consumo.lines.0.sticky_back', 'Reverso');

        $this->get(
            '/api/reports/work-order-controls-summary/preview?work_order_id='.$wo->id,
            $h,
        )->assertOk()->assertHeader('content-type', 'text/html; charset=UTF-8');

        $this->get(
            '/api/reports/work-order-controls-summary.pdf?work_order_id='.$wo->id,
            $h,
        )->assertOk();

        $this->get(
            '/api/reports/work-order-controls-summary?work_order_id='.$wo->id.'&format=csv',
            $h,
        )->assertOk()->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }
}
