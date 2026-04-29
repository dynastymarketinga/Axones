<?php

namespace Tests\Feature;

use App\Enums\ClientOrderStatus;
use App\Models\AreaRequest;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\OperationalAlert;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientOrderWorkOrderLinkTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_can_create_client_order_and_link_work_order(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create([
            'name' => 'Cliente OC',
            'rif' => 'J-111',
        ]);

        $coResp = $this->postJson('/api/client-orders', [
            'client_id' => $client->id,
            'notes' => 'Pedido bolsa',
        ], $h)->assertCreated();

        $coId = $coResp->json('id');
        $this->assertStringStartsWith('OC-CLI-', $coResp->json('code'));

        $woResp = $this->postJson('/api/work-orders', [
            'auto_create_material_request' => false,
            'client_order_id' => $coId,
        ], $h)->assertCreated();

        $this->assertEquals($client->id, $woResp->json('client_id'));
        $this->assertEquals($coId, $woResp->json('client_order_id'));
    }

    public function test_rejects_work_order_when_client_mismatches_client_order(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $c1 = Client::query()->create(['name' => 'A', 'rif' => 'J-1']);
        $c2 = Client::query()->create(['name' => 'B', 'rif' => 'J-2']);

        $co = ClientOrder::query()->create([
            'client_id' => $c1->id,
            'code' => ClientOrder::nextCode(),
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->postJson('/api/work-orders', [
            'auto_create_material_request' => false,
            'client_id' => $c2->id,
            'client_order_id' => $co->id,
        ], $h)->assertUnprocessable();
    }

    public function test_rejects_link_to_cancelled_client_order(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C', 'rif' => 'J-3']);

        $co = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => ClientOrder::nextCode(),
            'status' => ClientOrderStatus::Cancelled->value,
            'created_by' => $user->id,
        ]);

        $this->postJson('/api/work-orders', [
            'auto_create_material_request' => false,
            'client_order_id' => $co->id,
        ], $h)->assertUnprocessable();
    }

    public function test_work_orders_can_filter_by_client_order_id(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'D', 'rif' => 'J-4']);
        $co = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-CLI-MANUAL-1',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        WorkOrder::query()->create([
            'code' => 'OT-LINK-1',
            'client_id' => $client->id,
            'client_order_id' => $co->id,
            'status' => 'open',
            'scheduling_status' => 'pending_programming',
            'created_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?client_order_id='.$co->id, $h)->assertOk();
        $this->assertCount(1, $r->json('data'));
    }

    public function test_client_orders_index_is_ascending_by_default_and_searches_by_client_or_product(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $clientA = Client::query()->create(['name' => 'Cliente Alpha', 'rif' => 'J-11']);
        $clientB = Client::query()->create(['name' => 'Cliente Beta', 'rif' => 'J-22']);
        $product = Product::query()->create([
            'client_id' => $clientB->id,
            'name' => 'Bolsa Premium Beta',
        ]);

        $older = ClientOrder::query()->create([
            'client_id' => $clientA->id,
            'code' => 'OC-ASC-0001',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $newer = ClientOrder::query()->create([
            'client_id' => $clientB->id,
            'code' => 'OC-ASC-0002',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        ClientOrderLine::query()->create([
            'client_order_id' => $newer->id,
            'product_id' => $product->id,
            'quantity' => '10',
            'unit' => 'kg',
            'position' => 0,
        ]);

        $index = $this->getJson('/api/client-orders?per_page=20', $h)->assertOk();
        $codes = array_map(static fn (array $row) => $row['code'] ?? null, $index->json('data'));
        $firstPos = array_search('OC-ASC-0001', $codes, true);
        $secondPos = array_search('OC-ASC-0002', $codes, true);
        $this->assertIsInt($firstPos);
        $this->assertIsInt($secondPos);
        $this->assertLessThan($secondPos, $firstPos);

        $byClient = $this->getJson('/api/client-orders?per_page=20&q=Alpha', $h)->assertOk();
        $this->assertCount(1, $byClient->json('data'));
        $this->assertSame('OC-ASC-0001', $byClient->json('data.0.code'));

        $byProduct = $this->getJson('/api/client-orders?per_page=20&q=Premium', $h)->assertOk();
        $this->assertCount(1, $byProduct->json('data'));
        $this->assertSame('OC-ASC-0002', $byProduct->json('data.0.code'));
    }

    public function test_work_order_creation_notifies_departments_immediately(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create([
            'name' => 'Cliente Notif',
            'rif' => 'J-999',
        ]);
        $co = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-NOTIF-0001',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $woResp = $this->postJson('/api/work-orders', [
            'auto_create_material_request' => false,
            'client_order_id' => $co->id,
        ], $h)->assertCreated();
        $woId = (int) $woResp->json('id');

        $this->assertDatabaseCount('area_requests', 3);
        $this->assertDatabaseHas('area_requests', ['work_order_id' => $woId, 'area' => 'impresion']);
        $this->assertDatabaseHas('area_requests', ['work_order_id' => $woId, 'area' => 'laminacion']);
        $this->assertDatabaseHas('area_requests', ['work_order_id' => $woId, 'area' => 'corte']);
        $this->assertDatabaseCount('operational_alerts', 3);
        $this->assertSame(
            3,
            OperationalAlert::query()->where('work_order_id', $woId)->where('alert_type', 'work_order_created')->count()
        );
        $this->assertSame(
            3,
            AreaRequest::query()->where('work_order_id', $woId)->count()
        );
    }
}
