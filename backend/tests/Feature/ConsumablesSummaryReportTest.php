<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Material;
use App\Models\PrintingChemicalUsage;
use App\Models\PrintingInkControlLine;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConsumablesSummaryReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_consumables_summary_requires_auth(): void
    {
        $this->getJson('/api/reports/consumables-summary?from=2026-01-01&to=2026-12-31')
            ->assertUnauthorized();
    }

    public function test_consumables_summary_aggregates_by_date_and_client(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 12:00:00'));

        $user = User::factory()->create();
        $h = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $clientA = Client::query()->create(['name' => 'Cliente A', 'rif' => 'J-A1']);
        $clientB = Client::query()->create(['name' => 'Cliente B', 'rif' => 'J-B1']);
        $mat = Material::query()->create([
            'sku' => 'TINTA-1',
            'name' => 'Tinta test',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $woA = WorkOrder::query()->create([
            'code' => 'OT-CONS-A',
            'client_id' => $clientA->id,
            'document_date' => '2026-03-10',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woA->id,
            'form' => [
                'impTurnosImpresion' => [[
                    'entradaBobinasKg' => ['100', '50'],
                ]],
                'lamTurnosLaminacion' => [[
                    'entradaVirgenBobinasKg' => ['40'],
                    'adhesivoEntradaKg' => '10',
                    'adhesivoSobroKg' => '2',
                    'catalizadorEntradaKg' => '1',
                    'catalizadorSobroKg' => '0.2',
                    'acetatoEntradaLt' => '3',
                    'acetatoSobroLt' => '0.5',
                ]],
            ],
        ]);
        PrintingInkControlLine::query()->create([
            'work_order_id' => $woA->id,
            'material_id' => $mat->id,
            'quantity_original_kg' => 2,
            'quantity_solventada_kg' => 0.5,
            'quantity_return_kg' => 0.1,
        ]);
        PrintingChemicalUsage::query()->create([
            'work_order_id' => $woA->id,
            'chemical_type' => 'alcohol',
            'quantity_loaded_kg' => 1.5,
            'quantity_return_kg' => 0.3,
        ]);

        $woB = WorkOrder::query()->create([
            'code' => 'OT-CONS-B',
            'client_id' => $clientB->id,
            'document_date' => '2026-03-12',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woB->id,
            'form' => [
                'impTurnosImpresion' => [[
                    'entradaBobinasKg' => ['25'],
                ]],
            ],
        ]);

        $this->getJson('/api/reports/consumables-summary?from=2026-03-01&to=2026-03-31', $h)
            ->assertOk()
            ->assertJsonPath('totals.tintas.total_original_kg', '2.000')
            ->assertJsonPath('totals.tintas.total_solventadas_kg', '0.500')
            ->assertJsonPath('totals.tintas.alcohol_kg', '1.200')
            ->assertJsonPath('totals.laminacion.adhesivo_sobra_kg', '2.000')
            ->assertJsonPath('totals.laminacion.adhesivo_consumido_kg', '8.000')
            ->assertJsonPath('totals.laminacion.total_consumible_kg', '8.800')
            ->assertJsonPath('totals.laminacion.material_virgen_entrada_kg', '40.000')
            ->assertJsonPath('totals.impresion.material_consumido_kg', '175.000')
            ->assertJsonPath('work_order_count', 2);

        $this->getJson('/api/reports/consumables-summary?from=2026-03-01&to=2026-03-31&client_id='.$clientA->id, $h)
            ->assertOk()
            ->assertJsonPath('totals.impresion.material_consumido_kg', '150.000')
            ->assertJsonPath('work_order_count', 1);

        $csv = $this->get('/api/reports/consumables-summary?from=2026-03-01&to=2026-03-31&format=csv', $h);
        $csv->assertOk();
        $body = (string) $csv->getContent();
        $this->assertStringContainsString('tintas_original_kg', $body);
        $this->assertStringContainsString('OT-CONS-A', $body);

        Carbon::setTestNow();
    }
}
