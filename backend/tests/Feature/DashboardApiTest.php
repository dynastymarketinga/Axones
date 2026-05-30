<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Material;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_summary_requires_authentication(): void
    {
        $this->getJson('/api/dashboard/summary')->assertUnauthorized();
    }

    public function test_summary_returns_structure(): void
    {
        $user = User::factory()->create();
        Material::query()->create([
            'sku' => 'T-1',
            'name' => 'Test',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 10,
        ])->forceFill(['quantity_on_hand' => 5])->save();

        $token = $user->createToken('t')->plainTextToken;

        $response = $this->getJson('/api/dashboard/summary', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'generated_at',
                'month_label',
                'corte_production_month_kg',
                'scrap_month_kg',
                'scrap_month_by_area_kg' => [
                    'printing',
                    'laminacion',
                    'corte',
                ],
                'recent_finalized_ot_scrap',
                'materials_total',
                'materials_by_area',
                'inventory_returns_pending',
                'material_requests_pending',
                'work_orders_pending_programming',
                'work_orders_in_programming',
                'work_orders_pending_production',
                'operational_alerts_unread',
                'tinta_mixtures_total',
                'movements_today',
                'materials_low_stock',
            ]);

        $this->assertGreaterThanOrEqual(1, $response->json('materials_total'));
        $this->assertCount(1, $response->json('materials_low_stock'));
        $this->assertIsArray($response->json('recent_finalized_ot_scrap'));
    }

    public function test_summary_includes_recent_finalized_ot_scrap(): void
    {
        $user = User::factory()->create();
        $client = Client::query()->create(['name' => 'Cliente test', 'rif' => 'J-TEST']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Producto test',
            'cpe' => 'CPE-T',
            'structure' => 'BOPP 20',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-2026-00100',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'completed',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'impEstadoArea' => 'finalizada',
                'lamEstadoArea' => 'finalizada',
                'corEstadoArea' => 'finalizada',
                'impScrapTransparenteKg' => '1.2',
                'impScrapImpresoKg' => '0.3',
                'lamScrapLaminadoKg' => '2.0',
                'corScrapRefileKg' => '0.5',
            ],
        ]);

        $token = $user->createToken('t')->plainTextToken;
        $response = $this->getJson('/api/dashboard/summary', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk();
        $rows = $response->json('recent_finalized_ot_scrap');
        $this->assertCount(1, $rows);
        $this->assertSame('OT-2026-00100', $rows[0]['code']);
        $this->assertSame('1.500', $rows[0]['impresion_kg']);
        $this->assertSame('2.000', $rows[0]['laminacion_kg']);
        $this->assertSame('0.500', $rows[0]['corte_kg']);
        $this->assertSame('4.000', $rows[0]['total_kg']);
    }

    public function test_summary_ignores_scrap_from_non_finalized_areas(): void
    {
        $user = User::factory()->create();
        $client = Client::query()->create(['name' => 'Cliente test 2', 'rif' => 'J-TEST2']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Producto test 2',
            'cpe' => 'CPE-T2',
            'structure' => 'BOPP 20',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-2026-00101',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'completed',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'impEstadoArea' => 'abierta',
                'lamEstadoArea' => 'finalizada',
                'corEstadoArea' => 'finalizada',
                'impScrapTransparenteKg' => '9.0',
                'lamScrapLaminadoKg' => '1.0',
                'corScrapRefileKg' => '0.2',
            ],
        ]);

        $token = $user->createToken('t')->plainTextToken;
        $response = $this->getJson('/api/dashboard/summary', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk();
        $rows = $response->json('recent_finalized_ot_scrap');
        $this->assertCount(1, $rows);
        $this->assertSame('0.000', $rows[0]['impresion_kg']);
        $this->assertSame('1.000', $rows[0]['laminacion_kg']);
        $this->assertSame('0.200', $rows[0]['corte_kg']);
    }

    public function test_summary_finds_finalized_ot_among_many_active_orders(): void
    {
        $user = User::factory()->create();
        $client = Client::query()->create(['name' => 'Cliente activo', 'rif' => 'J-ACT']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Producto activo',
            'cpe' => 'CPE-A',
            'structure' => 'BOPP 20',
        ]);

        for ($i = 1; $i <= 30; $i++) {
            $active = WorkOrder::query()->create([
                'code' => sprintf('OT-2026-ACT-%03d', $i),
                'client_id' => $client->id,
                'product_id' => $product->id,
                'status' => 'in_progress',
            ]);
            WorkOrderTechnicalDocument::query()->create([
                'work_order_id' => $active->id,
                'form' => [
                    'impEstadoArea' => 'abierta',
                    'corEstadoArea' => 'abierta',
                ],
            ]);
            $active->forceFill(['updated_at' => now()->addMinutes($i)])->save();
        }

        $closed = WorkOrder::query()->create([
            'code' => 'OT-2026-CERRADA',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'in_progress',
        ]);
        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $closed->id,
            'form' => [
                'impEstadoArea' => 'finalizada',
                'lamEstadoArea' => 'finalizada',
                'corEstadoArea' => 'finalizada',
                'corScrapRefileKg' => '3.5',
            ],
        ]);
        $closed->forceFill(['updated_at' => now()->subDay()])->save();

        $token = $user->createToken('t')->plainTextToken;
        $response = $this->getJson('/api/dashboard/summary', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk();
        $rows = $response->json('recent_finalized_ot_scrap');
        $this->assertCount(1, $rows);
        $this->assertSame('OT-2026-CERRADA', $rows[0]['code']);
        $this->assertSame('3.500', $rows[0]['corte_kg']);
        $this->assertSame('closed', $rows[0]['closure']);
    }
}
