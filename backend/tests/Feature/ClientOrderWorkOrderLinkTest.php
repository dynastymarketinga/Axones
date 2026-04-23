<?php

namespace Tests\Feature;

use App\Enums\ClientOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
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
}
