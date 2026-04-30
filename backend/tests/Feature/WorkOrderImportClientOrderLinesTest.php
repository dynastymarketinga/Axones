<?php

namespace Tests\Feature;

use App\Enums\ClientOrderStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\Material;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderImportClientOrderLinesTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_imports_client_order_lines_with_material_id(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C', 'rif' => 'J-501']);

        $m1 = Material::query()->create([
            'sku' => 'IMP-M1',
            'name' => 'Mat 1',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m1->forceFill(['quantity_on_hand' => 1000])->save();
        $m2 = Material::query()->create([
            'sku' => 'IMP-M2',
            'name' => 'Mat 2',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m2->forceFill(['quantity_on_hand' => 1000])->save();

        $coResp = $this->postJson('/api/client-orders', [
            'client_id' => $client->id,
            'lines' => [
                ['material_id' => $m1->id, 'description' => 'Bobina base', 'quantity' => 50, 'unit' => 'kg'],
                ['material_id' => $m2->id, 'quantity' => 3],
            ],
        ], $h)->assertCreated();

        $woResp = $this->postJson('/api/work-orders', [
            'client_order_id' => $coResp->json('id'),
            'import_client_order_lines' => true,
            'auto_create_material_request' => false,
        ], $h)->assertCreated();

        $this->assertCount(2, $woResp->json('lines'));
        $ids = collect($woResp->json('lines'))->pluck('material_id')->sort()->values()->all();
        $this->assertEquals([$m1->id, $m2->id], $ids);
    }

    public function test_sets_product_id_from_first_client_order_line_with_product(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C-P', 'rif' => 'J-601']);

        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Etiqueta demo',
            'cpe' => 'CPE-D',
            'mps' => 'MPS-D',
            'print_type' => 'Superficie',
            'structure' => '1 capa',
        ]);

        $m = Material::query()->create([
            'sku' => 'IMP-PR-1',
            'name' => 'Bobina',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 1000])->save();

        $coResp = $this->postJson('/api/client-orders', [
            'client_id' => $client->id,
            'lines' => [
                [
                    'product_id' => $product->id,
                    'material_id' => $m->id,
                    'description' => 'Lote',
                    'quantity' => 12,
                    'unit' => 'kg',
                ],
            ],
        ], $h)->assertCreated();

        $woResp = $this->postJson('/api/work-orders', [
            'client_order_id' => $coResp->json('id'),
            'import_client_order_lines' => true,
            'auto_create_material_request' => false,
        ], $h)->assertCreated();

        $this->assertSame($product->id, $woResp->json('product_id'));
    }

    public function test_rejects_import_when_manual_lines_sent(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C2', 'rif' => 'J-502']);
        $m = Material::query()->create([
            'sku' => 'IMP-X',
            'name' => 'X',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m->forceFill(['quantity_on_hand' => 1])->save();

        $co = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-T-1',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $co->lines()->create([
            'material_id' => $m->id,
            'quantity' => 10,
            'unit' => 'kg',
            'position' => 0,
        ]);

        $this->postJson('/api/work-orders', [
            'client_order_id' => $co->id,
            'import_client_order_lines' => true,
            'auto_create_material_request' => false,
            'lines' => [
                ['material_id' => $m->id, 'quantity' => 1],
            ],
        ], $h)->assertUnprocessable();
    }

    public function test_rejects_import_when_pedido_has_no_material_lines(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C3', 'rif' => 'J-503']);

        $coResp = $this->postJson('/api/client-orders', [
            'client_id' => $client->id,
            'lines' => [
                ['description' => 'Solo servicio', 'quantity' => 1, 'unit' => 'h'],
            ],
        ], $h)->assertCreated();

        $this->postJson('/api/work-orders', [
            'client_order_id' => $coResp->json('id'),
            'import_client_order_lines' => true,
            'auto_create_material_request' => false,
        ], $h)->assertUnprocessable();
    }

    public function test_awaiting_ot_filter_excludes_orders_with_open_work_order(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C4', 'rif' => 'J-504']);

        $coOpen = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-AOT-1',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $coWithWo = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-AOT-2',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        WorkOrder::query()->create([
            'code' => 'OT-LINK',
            'client_id' => $client->id,
            'client_order_id' => $coWithWo->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $r = $this->getJson('/api/client-orders?awaiting_ot=1', $h)->assertOk();
        $codes = collect($r->json('data'))->pluck('code')->all();
        $this->assertContains('OC-AOT-1', $codes);
        $this->assertNotContains('OC-AOT-2', $codes);
    }
}
