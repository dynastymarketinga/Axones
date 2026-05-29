<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderPrintingSummary;
use App\Models\WorkOrderTechnicalDocument;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScrapReportFiltersTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_scrap_by_filters_json_defaults(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $this->getJson('/api/reports/scrap-by-filters?from=2026-01-01&to=2026-12-31', $h)
            ->assertOk()
            ->assertJsonPath('substrate_group', 'all')
            ->assertJsonPath('layout', 'detail');
    }

    public function test_scrap_by_filters_substrate_and_layout_csv(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00'));

        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C1', 'rif' => 'J-1']);

        $pBopp = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P BOPP',
            'cpe' => 'CPE-B',
            'structure' => 'BOPP 20 + PEBD',
        ]);
        $pPe = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P PE',
            'cpe' => 'CPE-P',
            'structure' => 'Polietileno 50',
        ]);

        $woBopp = WorkOrder::query()->create([
            'code' => 'OT-B1',
            'client_id' => $client->id,
            'product_id' => $pBopp->id,
        ]);
        WorkOrderPrintingSummary::query()->create([
            'work_order_id' => $woBopp->id,
            'scrap_percent' => 1.5,
        ]);

        $woPe = WorkOrder::query()->create([
            'code' => 'OT-PE1',
            'client_id' => $client->id,
            'product_id' => $pPe->id,
        ]);
        WorkOrderPrintingSummary::query()->create([
            'work_order_id' => $woPe->id,
            'scrap_percent' => 2.5,
        ]);

        $q = [
            'from' => '2026-01-01',
            'to' => '2026-12-31',
            'format' => 'csv',
        ];

        $csvBopp = $this->withHeaders($h)->get('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'bopp',
        ])));
        $csvBopp->assertOk();
        $this->assertStringContainsString('text/csv', (string) $csvBopp->headers->get('Content-Type'));
        $bodyBopp = (string) $csvBopp->getContent();
        $this->assertStringContainsString('OT-B1', $bodyBopp);
        $this->assertStringNotContainsString('OT-PE1', $bodyBopp);

        $csvPe = $this->withHeaders($h)->get('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'polietileno',
        ])));
        $csvPe->assertOk();
        $bodyPe = (string) $csvPe->getContent();
        $this->assertStringContainsString('OT-PE1', $bodyPe);
        $this->assertStringContainsString('OT-B1', $bodyPe);

        $csvPivot = $this->withHeaders($h)->get('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'layout' => 'by_work_order',
        ])));
        $csvPivot->assertOk();
        $this->assertStringContainsString('printing_scrap_percent', (string) $csvPivot->getContent());

        $csvArea = $this->withHeaders($h)->get('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'layout' => 'by_area',
        ])));
        $csvArea->assertOk();
        $bodyArea = (string) $csvArea->getContent();
        $this->assertStringContainsString('printing', $bodyArea);
        $this->assertStringContainsString('avg_scrap_percent', $bodyArea);

        Carbon::setTestNow();
    }

    public function test_scrap_history_kg_json_and_csv(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 10:00:00'));

        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'CH', 'rif' => 'J-H1']);

        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P mix',
            'cpe' => 'CPE-H',
            'structure' => 'BOPP 20 + PEBD',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-HIST-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'impScrapTransparenteKg' => '1.5',
                'impScrapImpresoKg' => '0.25',
                'impScrapImpresoDestino' => 'bopp',
                'lamScrapTransparenteKg' => '2',
                'lamScrapImpresoKg' => '0.5',
                'lamScrapLaminadoKg' => '0.125',
                'corScrapRefileKg' => '3',
                'corScrapImpresoKg' => '1',
                'corScrapMalCorteKg' => '0.75',
                'corDesperdicioSustrato' => 'bopp',
            ],
        ]);
        WorkOrderPrintingSummary::query()->create([
            'work_order_id' => $wo->id,
            'scrap_percent' => 2,
        ]);

        $qBase = [
            'from' => '2026-01-01',
            'to' => '2026-12-31',
            'layout' => 'history_kg',
        ];

        $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($qBase, [
            'substrate_group' => 'all',
        ])), $h)
            ->assertOk()
            ->assertJsonPath('layout', 'history_kg')
            ->assertJsonPath('rows.0.work_order_code', 'OT-HIST-1')
            ->assertJsonPath('rows.0.imp_scrap_transparente_kg', '1.500')
            ->assertJsonPath('rows.0.cor_scrap_mal_corte_kg', '0.750')
            ->assertJsonPath('rows.0.corte_desperdicio_sustrato', 'bopp')
            ->assertJsonPath('rows.0.printing_scrap_percent', '2.000');

        $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($qBase, [
            'substrate_group' => 'bopp',
        ])), $h)
            ->assertOk()
            ->assertJsonPath('rows.0.imp_scrap_transparente_kg', '0.000')
            ->assertJsonPath('rows.0.imp_scrap_impreso_kg', '0.250');

        $csv = $this->withHeaders($h)->get('/api/reports/scrap-by-filters?'.http_build_query(array_merge($qBase, [
            'format' => 'csv',
            'substrate_group' => 'bopp',
        ])));
        $csv->assertOk();
        $body = (string) $csv->getContent();
        $this->assertStringContainsString('imp_scrap_transparente_kg', $body);
        $this->assertStringContainsString('OT-HIST-1', $body);

        $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($qBase, [
            'substrate_group' => 'poliestireno',
        ])), $h)
            ->assertOk()
            ->assertJsonPath('rows.0.imp_scrap_transparente_kg', '1.500')
            ->assertJsonPath('rows.0.imp_scrap_impreso_kg', '0.000')
            ->assertJsonPath('rows.0.lam_scrap_impreso_kg', '0.000');

        Carbon::setTestNow();
    }

    public function test_scrap_impreso_kg_routes_by_printing_destino_bopp_or_poliestireno(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01 12:00:00'));

        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'Dest', 'rif' => 'J-D1']);

        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Film',
            'structure' => 'BOPP + PE',
        ]);

        $woBopp = WorkOrder::query()->create([
            'code' => 'OT-IMP-BOPP',
            'client_id' => $client->id,
            'product_id' => $product->id,
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woBopp->id,
            'form' => [
                'impScrapImpresoKg' => '150',
                'impScrapImpresoDestino' => 'bopp',
            ],
        ]);

        $woPs = WorkOrder::query()->create([
            'code' => 'OT-IMP-PS',
            'client_id' => $client->id,
            'product_id' => $product->id,
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woPs->id,
            'form' => [
                'impScrapImpresoKg' => '80',
                'impScrapImpresoDestino' => 'poliestireno',
            ],
        ]);

        $q = [
            'from' => '2026-01-01',
            'to' => '2026-12-31',
            'layout' => 'history_kg',
        ];

        $boppRows = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'bopp',
        ])), $h)->assertOk()->json('rows');
        $bopp = collect($boppRows)->firstWhere('work_order_code', 'OT-IMP-BOPP');
        $this->assertNotNull($bopp);
        $this->assertSame('150.000', $bopp['imp_scrap_impreso_kg']);

        $psRows = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'poliestireno',
        ])), $h)->assertOk()->json('rows');
        $ps = collect($psRows)->firstWhere('work_order_code', 'OT-IMP-PS');
        $this->assertNotNull($ps);
        $this->assertSame('80.000', $ps['imp_scrap_impreso_kg']);

        Carbon::setTestNow();
    }

    public function test_scrap_history_kg_explicit_substrate_overrides_structure(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-01 12:00:00'));

        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'CS', 'rif' => 'J-S1']);

        $productMixed = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Mix BOPP PE',
            'cpe' => 'CPE-M',
            'structure' => 'BOPP 20 + PEBD',
        ]);

        $woBopp = WorkOrder::query()->create([
            'code' => 'OT-EX-B',
            'client_id' => $client->id,
            'product_id' => $productMixed->id,
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woBopp->id,
            'form' => ['corDesperdicioSustrato' => 'bopp'],
        ]);

        $woPe = WorkOrder::query()->create([
            'code' => 'OT-EX-P',
            'client_id' => $client->id,
            'product_id' => $productMixed->id,
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woPe->id,
            'form' => ['corDesperdicioSustrato' => 'polietileno'],
        ]);

        $q = [
            'from' => '2026-01-01',
            'to' => '2026-12-31',
            'layout' => 'history_kg',
        ];

        $bopp = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'bopp',
        ])), $h)->assertOk()->json('rows');

        $this->assertCount(1, $bopp);
        $this->assertSame('OT-EX-B', $bopp[0]['work_order_code']);

        $pe = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'polietileno',
        ])), $h)->assertOk()->json('rows');

        $this->assertCount(1, $pe);
        $this->assertSame('OT-EX-P', $pe[0]['work_order_code']);

        Carbon::setTestNow();
    }

    public function test_scrap_history_kg_filter_by_work_order_id(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-02 11:00:00'));

        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'CW', 'rif' => 'J-W1']);

        $p = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'PB',
            'cpe' => 'CPE-W',
            'structure' => 'Transparente CPP',
        ]);

        $woKeep = WorkOrder::query()->create([
            'code' => 'OT-KEEP',
            'client_id' => $client->id,
            'product_id' => $p->id,
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $woKeep->id,
            'form' => ['impScrapTransparenteKg' => '1'],
        ]);

        WorkOrder::query()->create([
            'code' => 'OT-DROP',
            'client_id' => $client->id,
            'product_id' => $p->id,
        ]);

        $q = [
            'from' => '2026-01-01',
            'to' => '2026-12-31',
            'layout' => 'history_kg',
            'substrate_group' => 'transparente',
            'work_order_id' => $woKeep->id,
        ];

        $rows = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query($q), $h)->assertOk()->json('rows');
        $this->assertCount(1, $rows);
        $this->assertSame('OT-KEEP', $rows[0]['work_order_code']);

        $byCode = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query([
            'from' => '2026-01-01',
            'to' => '2026-12-31',
            'layout' => 'history_kg',
            'substrate_group' => 'transparente',
            'work_order_code' => 'OT-KEEP',
        ]), $h)->assertOk()->json('rows');

        $this->assertCount(1, $byCode);
        $this->assertSame('OT-KEEP', $byCode[0]['work_order_code']);

        Carbon::setTestNow();
    }

    public function test_scrap_unknown_work_order_code_returns_validation_error(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $this->getJson('/api/reports/scrap-by-filters?'.http_build_query([
            'from' => '2026-01-01',
            'to' => '2026-12-31',
            'work_order_code' => 'NO-EXISTE',
        ]), $h)->assertStatus(422);

    }

    public function test_scrap_by_filters_preview_html_and_pdf(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00'));

        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'CPV', 'rif' => 'J-PV']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Prod PV',
            'cpe' => 'CPE-PV',
            'structure' => 'BOPP 18',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PV-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
        ]);
        WorkOrderPrintingSummary::query()->create([
            'work_order_id' => $wo->id,
            'scrap_percent' => 1.25,
        ]);

        $base = 'from=2026-01-01&to=2026-12-31&substrate_group=bopp&layout=detail';
        $preview = $this->withHeaders($h)->get('/api/reports/scrap-by-filters/preview?'.$base.'&focus_work_order_id='.$wo->id.'&focus_area=printing');
        $preview->assertOk();
        $this->assertStringContainsString('text/html', (string) $preview->headers->get('Content-Type'));
        $body = (string) $preview->getContent();
        $this->assertStringContainsString('Reporte de desperdicio', $body);
        $this->assertStringContainsString('OT-PV-1', $body);

        $pdf = $this->withHeaders($h)->get('/api/reports/scrap-by-filters.pdf?'.$base);
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $pdf->headers->get('Content-Type'));

        Carbon::setTestNow();
    }

    public function test_scrap_report_includes_ot_when_planilla_updated_in_range_but_created_outside(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-15 12:00:00'));

        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C-Period', 'rif' => 'J-PER']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P Period',
            'cpe' => 'CPE-PER',
            'structure' => 'BOPP 20',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-OLD-CREATED',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'created_at' => Carbon::parse('2025-01-10 08:00:00'),
        ]);
        WorkOrderPrintingSummary::query()->create([
            'work_order_id' => $wo->id,
            'scrap_percent' => 2.0,
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => ['impScrapImpresoKg' => '12'],
            'updated_at' => Carbon::parse('2026-05-10 14:00:00'),
        ]);

        $res = $this->getJson('/api/reports/scrap-by-filters?from=2026-05-01&to=2026-05-31&substrate_group=bopp&layout=detail', $h)
            ->assertOk();

        $codes = collect($res->json('rows'))->pluck('work_order_code')->all();
        $this->assertContains('OT-OLD-CREATED', $codes);

        Carbon::setTestNow();
    }

    public function test_scrap_history_kg_mixed_structure_without_explicit_omitted_from_bopp_and_pe_tabs(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-02 10:00:00'));

        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'Amb', 'rif' => 'J-AMB']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Mix',
            'cpe' => 'CPE-AMB',
            'structure' => 'BOPP 20 + PEBD',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-AMB-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => ['impScrapImpresoKg' => '5'],
        ]);

        $q = [
            'from' => '2026-01-01',
            'to' => '2026-12-31',
            'layout' => 'history_kg',
        ];

        $bopp = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'bopp',
        ])), $h)->assertOk()->json('rows');
        $pe = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'polietileno',
        ])), $h)->assertOk()->json('rows');

        $boppCodes = collect($bopp)->pluck('work_order_code')->all();
        $peCodes = collect($pe)->pluck('work_order_code')->all();
        $this->assertNotContains('OT-AMB-1', $boppCodes);
        $this->assertNotContains('OT-AMB-1', $peCodes);

        WorkOrderTechnicalDocument::query()->where('work_order_id', $wo->id)->update([
            'form' => ['corDesperdicioSustrato' => 'polietileno', 'impScrapImpresoKg' => '5'],
        ]);

        $peAfter = $this->getJson('/api/reports/scrap-by-filters?'.http_build_query(array_merge($q, [
            'substrate_group' => 'polietileno',
        ])), $h)->assertOk()->json('rows');
        $this->assertContains('OT-AMB-1', collect($peAfter)->pluck('work_order_code')->all());

        Carbon::setTestNow();
    }

    public function test_scrap_substrate_config_endpoint(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $res = $this->getJson('/api/reports/scrap-substrate-config', $h)->assertOk();
        $groups = $res->json('groups');
        $this->assertIsArray($groups);
        $ids = collect($groups)->pluck('id')->all();
        $this->assertContains('bopp', $ids);
        $this->assertContains('polietileno', $ids);
        $this->assertContains('poliestireno', $ids);
    }

    public function test_scrap_substrate_group_legacy_politerlero_alias_normalizes_to_polietileno(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $this->getJson('/api/reports/scrap-by-filters?from=2026-01-01&to=2026-12-31&substrate_group=politerlero', $h)
            ->assertOk()
            ->assertJsonPath('substrate_group', 'polietileno');
    }
}
