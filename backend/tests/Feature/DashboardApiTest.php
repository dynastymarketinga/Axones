<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\User;
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
    }
}
