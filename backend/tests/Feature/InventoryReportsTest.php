<?php

namespace Tests\Feature;

use App\Enums\MaterialRequestStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\InventoryMovement;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\PrintingBobinaUsage;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryReportsTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_daily_requires_auth(): void
    {
        $this->getJson('/api/reports/inventory-daily?from=2026-04-01&to=2026-04-30')->assertUnauthorized();
    }

    public function test_inventory_daily_returns_totals_by_day(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $m = Material::query()->create([
            'sku' => 'RPT-1',
            'name' => 'M',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 0])->save();

        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'in',
            'quantity' => 10,
            'occurred_at' => '2026-04-15 10:00:00',
        ]);
        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'out',
            'quantity' => 2,
            'occurred_at' => '2026-04-15 14:00:00',
        ]);

        $response = $this->getJson(
            '/api/reports/inventory-daily?from=2026-04-01&to=2026-04-30',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonStructure(['from', 'to', 'rows', 'by_day']);
        $this->assertNotEmpty($response->json('by_day'));
        $firstDay = $response->json('by_day.0');
        $this->assertArrayHasKey('totals_by_type', $firstDay);
        $this->assertEquals('10.000', $firstDay['totals_by_type']['in']);
        $this->assertEquals('2.000', $firstDay['totals_by_type']['out']);
    }

    public function test_consumption_by_client_product(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $client = Client::query()->create([
            'name' => 'Cliente RPT',
            'rif' => 'J-999',
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Bolsa X',
            'cpe' => 'CPE-1',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-RPT-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'RPT-M',
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        $mr = MaterialRequest::query()->create([
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
            'status' => MaterialRequestStatus::Dispatched->value,
        ]);

        InventoryMovement::query()->create([
            'material_id' => $mat->id,
            'movement_type' => 'out',
            'quantity' => 5,
            'reference_type' => 'material_request',
            'reference_id' => $mr->id,
            'occurred_at' => '2026-04-10 12:00:00',
        ]);

        $response = $this->getJson(
            '/api/reports/consumption-by-client-product?from=2026-04-01&to=2026-04-30',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $rows = $response->json('rows');
        $this->assertCount(1, $rows);
        $this->assertEquals('Cliente RPT', $rows[0]['client_name']);
        $this->assertEquals('Bolsa X', $rows[0]['product_name']);
        $this->assertEquals('5.000', $rows[0]['total_quantity']);
    }

    public function test_inventory_daily_csv_download(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $m = Material::query()->create([
            'sku' => 'RPT-CSV',
            'name' => 'M',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 0])->save();

        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'in',
            'quantity' => 1,
            'occurred_at' => '2026-04-15 10:00:00',
        ]);

        $response = $this->get(
            '/api/reports/inventory-daily?from=2026-04-01&to=2026-04-30&format=csv',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $this->assertStringContainsString('day,movement_type', $response->getContent());
        $this->assertStringContainsString('2026-04-15,in,1.000,1', $response->getContent());
    }

    public function test_inventory_area_daily_returns_stock_final_day_rows(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $m = Material::query()->create([
            'sku' => 'RPT-AREA-1',
            'name' => 'Material area',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 120])->save();

        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'in',
            'quantity' => 10,
            'occurred_at' => '2026-04-15 10:00:00',
        ]);
        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'out',
            'quantity' => 3,
            'occurred_at' => '2026-04-15 11:00:00',
        ]);
        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'out',
            'quantity' => 5,
            'occurred_at' => '2026-04-16 09:00:00',
        ]);

        $response = $this->getJson(
            '/api/reports/inventory-area-daily?date=2026-04-15&inventory_area=tintas',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonStructure([
            'report_date',
            'area',
            'show_micras_ancho',
            'rows',
            'totals',
            'materials_count',
        ]);
        $this->assertEquals('2026-04-15', $response->json('report_date'));
        $this->assertEquals('tintas', $response->json('area'));
        $this->assertTrue((bool) $response->json('show_micras_ancho'));
        $this->assertEquals('125.000', $response->json('rows.0.stock_final_dia'));
        $this->assertArrayNotHasKey('stock_inicial_dia', (array) $response->json('rows.0'));
    }

    public function test_inventory_area_daily_includes_micras_ancho_for_sustrato(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $m = Material::query()->create([
            'sku' => 'RPT-SUST-1',
            'name' => 'Sustrato test',
            'inventory_area' => 'material',
            'micras' => 18,
            'ancho' => 700,
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 50])->save();

        $response = $this->getJson(
            '/api/reports/inventory-area-daily?date=2026-04-15&inventory_area=material',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $this->assertTrue((bool) $response->json('show_micras_ancho'));
        $this->assertEquals('18.000', $response->json('rows.0.micras'));
        $this->assertEquals('700.000', $response->json('rows.0.ancho'));
    }

    public function test_inventory_area_daily_preview_returns_html(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $m = Material::query()->create([
            'sku' => 'RPT-AREA-PRE',
            'name' => 'Preview material',
            'inventory_area' => 'quimicos',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 8])->save();

        $response = $this->get(
            '/api/reports/inventory-area-daily/preview?date=2026-04-15&inventory_area=quimicos',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/html; charset=UTF-8');
        $this->assertStringContainsString('Inventario por area - stock final del dia', $response->getContent());
    }

    public function test_inventory_area_daily_pdf_download(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $m = Material::query()->create([
            'sku' => 'RPT-AREA-PDF',
            'name' => 'Pdf material',
            'inventory_area' => 'miscelaneos',
            'unit' => 'u',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 3])->save();

        $response = $this->get(
            '/api/reports/inventory-area-daily.pdf?date=2026-04-15&inventory_area=miscelaneos',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('inventory-area-daily-miscelaneos-2026-04-15.pdf', (string) $response->headers->get('content-disposition'));
    }

    public function test_inventory_movements_general_report_returns_summary_fields(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $m = Material::query()->create([
            'sku' => 'RPT-MOV-1',
            'name' => 'Mov material',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 100])->save();

        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'in',
            'quantity' => 10,
            'reference_type' => 'purchase_receipt',
            'reference_id' => 999999,
            'occurred_at' => '2026-04-24 10:00:00',
        ]);
        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'out',
            'quantity' => 4,
            'reference_type' => null,
            'reference_id' => null,
            'occurred_at' => '2026-04-25 11:00:00',
        ]);
        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'adjustment_sub',
            'quantity' => 2,
            'reference_type' => 'inventory_adjustment',
            'reference_id' => null,
            'occurred_at' => '2026-04-26 12:00:00',
        ]);

        $response = $this->getJson(
            '/api/reports/inventory-movements-general?from=2026-04-21&to=2026-04-28',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonStructure([
            'from',
            'to',
            'summary' => [
                'entries_total',
                'exits_total',
                'adjustment_total',
                'adjustment_percent',
                'invalid_reference_count',
            ],
            'entries_vs_exits_by_day',
            'entries_vs_exits_by_week',
            'top_materials',
            'invalid_references',
            'movements',
        ]);
        $this->assertEquals('10.000', $response->json('summary.entries_total'));
        $this->assertEquals('6.000', $response->json('summary.exits_total'));
        $this->assertEquals('2.000', $response->json('summary.adjustment_total'));
        $this->assertEquals(2, $response->json('summary.invalid_reference_count'));

        $invalidOnly = $this->getJson(
            '/api/reports/inventory-movements-general?from=2026-04-21&to=2026-04-28&invalid_only=1',
            ['Authorization' => 'Bearer '.$token],
        );
        $invalidOnly->assertOk();
        $invalidRows = (array) $invalidOnly->json('movements');
        $this->assertGreaterThan(0, count($invalidRows));
        foreach ($invalidRows as $row) {
            $this->assertTrue((bool) ($row['is_invalid_reference'] ?? false));
        }
    }

    public function test_inventory_movements_general_preview_and_pdf_download(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $m = Material::query()->create([
            'sku' => 'RPT-MOV-2',
            'name' => 'Mov preview',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 50])->save();

        InventoryMovement::query()->create([
            'material_id' => $m->id,
            'movement_type' => 'in',
            'quantity' => 5,
            'reference_type' => 'inventory_adjustment',
            'reference_id' => null,
            'occurred_at' => '2026-04-26 08:00:00',
        ]);

        $preview = $this->get(
            '/api/reports/inventory-movements-general/preview?from=2026-04-21&to=2026-04-28',
            ['Authorization' => 'Bearer '.$token],
        );
        $preview->assertOk();
        $preview->assertHeader('Content-Type', 'text/html; charset=UTF-8');
        $this->assertStringContainsString('Movimientos generales de inventario', $preview->getContent());

        $pdf = $this->get(
            '/api/reports/inventory-movements-general.pdf?from=2026-04-21&to=2026-04-28',
            ['Authorization' => 'Bearer '.$token],
        );
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $pdf->headers->get('content-type'));
    }

    public function test_work_order_material_summary(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $client = Client::query()->create(['name' => 'C-SUM', 'rif' => 'J-800']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P',
            'cpe' => 'CPE-S',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-SUM-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'SUM-M',
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        $mr = MaterialRequest::query()->create([
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
            'status' => MaterialRequestStatus::Dispatched->value,
        ]);

        InventoryMovement::query()->create([
            'material_id' => $mat->id,
            'movement_type' => 'out',
            'quantity' => 4,
            'reference_type' => 'material_request',
            'reference_id' => $mr->id,
            'occurred_at' => '2026-04-10 12:00:00',
        ]);

        PrintingBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_used_kg' => 2,
            'quantity_finished_kg' => 1.5,
            'bobina_id' => null,
        ]);

        InventoryReturn::query()->create([
            'material_id' => $mat->id,
            'work_order_id' => $wo->id,
            'destination_area' => 'tintas',
            'quantity' => 0.5,
            'status' => 'pending',
        ]);

        $response = $this->getJson(
            '/api/reports/work-order-material-summary?work_order_id='.$wo->id,
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $this->assertEquals('OT-SUM-1', $response->json('work_order.code'));
        $this->assertCount(1, $response->json('dispatch_by_material'));
        $this->assertEquals('4.000', $response->json('dispatch_by_material.0.total_quantity_out'));
        $this->assertCount(1, $response->json('printing_bobina_usages'));
        $this->assertIsArray($response->json('corte_bobina_usages'));
        $this->assertCount(0, $response->json('corte_bobina_usages'));
        $this->assertIsArray($response->json('laminacion_bobina_usages'));
        $this->assertCount(0, $response->json('laminacion_bobina_usages'));
        $this->assertIsArray($response->json('montaje_material_usages'));
        $this->assertCount(0, $response->json('montaje_material_usages'));
        $this->assertCount(1, $response->json('inventory_returns'));
    }

    public function test_invalid_date_range(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->getJson(
            '/api/reports/inventory-daily?from=2026-04-30&to=2026-04-01',
            ['Authorization' => 'Bearer '.$token],
        )->assertUnprocessable();
    }

    public function test_rejected_bobinas_report_requires_auth(): void
    {
        $this->getJson('/api/reports/rejected-bobinas?from=2026-04-01&to=2026-04-30')->assertUnauthorized();
    }

    public function test_rejected_bobinas_report_returns_structure(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $mat = Material::query()->create([
            'sku' => 'BR-RPT',
            'name' => 'Rechazo test',
            'inventory_area' => 'bobinas_rechazadas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 5])->save();

        $response = $this->getJson('/api/reports/rejected-bobinas?from=2026-04-01&to=2026-04-30', ['Authorization' => 'Bearer '.$token]);

        $response->assertOk();
        $response->assertJsonStructure([
            'materials',
            'bobinas',
            'bobinas_total',
        ]);
        $this->assertCount(1, $response->json('materials'));
        $this->assertEquals('BR-RPT', $response->json('materials.0.sku'));
        $this->assertEquals(0, $response->json('bobinas_total'));
    }

    public function test_consumption_report_supports_csv_download(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $response = $this->get(
            '/api/reports/consumption-by-client-product?from=2026-04-01&to=2026-04-30&format=csv',
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $this->assertStringContainsString('no_data', $response->getContent());
    }
}
