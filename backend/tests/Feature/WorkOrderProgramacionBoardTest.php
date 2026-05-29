<?php

namespace Tests\Feature;

use App\Enums\ClientOrderStatus;
use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderProgramacionBoardTest extends TestCase
{
    use RefreshDatabase;

    public function test_programacion_board_groups_columns_and_requires_auth(): void
    {
        $this->getJson('/api/work-orders/programacion-board')->assertUnauthorized();

        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->postJson('/api/work-orders', ['notes' => 'A'], ['Authorization' => 'Bearer '.$token])->assertCreated();
        $this->postJson('/api/work-orders', [
            'notes' => 'B',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $r = $this->getJson('/api/work-orders/programacion-board', ['Authorization' => 'Bearer '.$token])->assertOk();
        $cols = $r->json('columns');
        $this->assertArrayHasKey('nueva', $cols);
        $this->assertArrayHasKey('impresion', $cols);
        $this->assertCount(1, $cols['nueva']);
        $this->assertCount(1, $cols['impresion']);
        $this->assertEquals('A', $cols['nueva'][0]['notes']);
    }

    public function test_programacion_board_includes_open_client_orders_without_work_order(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $h = ['Authorization' => 'Bearer '.$token];

        $client = Client::query()->create(['name' => 'Cliente OC', 'rif' => 'J-900']);

        $awaiting = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-CLI-PEND-1',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $withWo = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-CLI-PEND-2',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        WorkOrder::query()->create([
            'code' => 'OT-LINK-1',
            'client_id' => $client->id,
            'client_order_id' => $withWo->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-CLI-PEND-3',
            'status' => ClientOrderStatus::Cancelled->value,
            'created_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders/programacion-board', $h)->assertOk();
        $pending = $r->json('pending_client_orders');
        $codes = collect($pending)->pluck('code')->all();

        $this->assertContains('OC-CLI-PEND-1', $codes);
        $this->assertNotContains('OC-CLI-PEND-2', $codes);
        $this->assertNotContains('OC-CLI-PEND-3', $codes);
    }

    public function test_patch_board_stage_updates_scheduling_status(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $created = $this->postJson('/api/work-orders', [], ['Authorization' => 'Bearer '.$token])->assertCreated();
        $id = $created->json('id');

        $this->patchJson("/api/work-orders/$id", [
            'board_stage' => WorkOrderBoardStage::Montaje->value,
        ], ['Authorization' => 'Bearer '.$token])->assertOk()
            ->assertJsonPath('board_stage', WorkOrderBoardStage::Montaje->value)
            ->assertJsonPath('scheduling_status', WorkOrderSchedulingStatus::InProgramming->value);

        $filtered = $this->getJson(
            '/api/work-orders?board_stage='.WorkOrderBoardStage::Montaje->value,
            ['Authorization' => 'Bearer '.$token],
        )->assertOk();
        $this->assertCount(1, $filtered->json('data'));
    }
}
