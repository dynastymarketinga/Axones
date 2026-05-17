<?php

namespace Tests\Unit;

use App\Models\Client;
use App\Models\Product;
use App\Models\WorkOrder;
use App\Models\WorkOrderLine;
use App\Support\CorteDispatchMaterialResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CorteDispatchMaterialResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_ensure_creates_finished_material_and_work_order_line_from_product(): void
    {
        $client = Client::query()->create(['name' => 'C', 'rif' => 'J-1']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'AAA',
            'cpe' => 'CPE',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-TEST',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'open',
        ]);

        $this->assertNull(CorteDispatchMaterialResolver::resolveForWorkOrder($wo));

        $materialId = CorteDispatchMaterialResolver::ensureForWorkOrder($wo->fresh());
        $this->assertNotNull($materialId);
        $this->assertDatabaseHas('work_order_lines', [
            'work_order_id' => $wo->id,
            'material_id' => $materialId,
        ]);
        $this->assertSame($materialId, CorteDispatchMaterialResolver::resolveForWorkOrder($wo->fresh()));
    }

    public function test_resolve_prefers_existing_work_order_line(): void
    {
        $client = Client::query()->create(['name' => 'C2', 'rif' => 'J-2']);
        $product = Product::query()->create(['client_id' => $client->id, 'name' => 'P', 'cpe' => 'X']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-LINE',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'open',
        ]);
        $lineMat = \App\Models\Material::query()->create([
            'sku' => 'LINE-MAT',
            'name' => 'Line mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        WorkOrderLine::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $lineMat->id,
            'quantity' => '10',
        ]);

        $this->assertSame($lineMat->id, CorteDispatchMaterialResolver::ensureForWorkOrder($wo->fresh()));
    }
}
