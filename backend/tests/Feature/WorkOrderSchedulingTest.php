<?php

namespace Tests\Feature;

use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderSchedulingTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_work_order_defaults_to_pending_programming(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $r = $this->postJson('/api/work-orders', [
            'notes' => 'Nueva OT',
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $this->assertEquals(WorkOrderSchedulingStatus::PendingProgramming->value, $r->json('scheduling_status'));
        $this->assertEquals(WorkOrderBoardStage::Nueva->value, $r->json('board_stage'));
    }

    public function test_can_move_to_in_programming_and_filter_list(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $created = $this->postJson('/api/work-orders', [], ['Authorization' => 'Bearer '.$token])->assertCreated();
        $id = $created->json('id');

        $this->patchJson("/api/work-orders/$id", [
            'scheduling_status' => WorkOrderSchedulingStatus::InProgramming->value,
        ], ['Authorization' => 'Bearer '.$token])->assertOk()
            ->assertJsonPath('scheduling_status', WorkOrderSchedulingStatus::InProgramming->value)
            ->assertJsonPath('board_stage', WorkOrderBoardStage::Pendiente->value);

        $pending = $this->getJson(
            '/api/work-orders?scheduling_status='.WorkOrderSchedulingStatus::PendingProgramming->value,
            ['Authorization' => 'Bearer '.$token],
        )->assertOk();
        $this->assertCount(0, $pending->json('data'));

        $inProg = $this->getJson(
            '/api/work-orders?scheduling_status='.WorkOrderSchedulingStatus::InProgramming->value,
            ['Authorization' => 'Bearer '.$token],
        )->assertOk();
        $this->assertCount(1, $inProg->json('data'));
    }

    public function test_work_order_stores_and_filters_client_order_reference(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $created = $this->postJson('/api/work-orders', [
            'notes' => 'OT con pedido cliente',
            'client_order_reference' => 'PED-Cliente-2026-042',
            'auto_create_material_request' => false,
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $this->assertEquals('PED-Cliente-2026-042', $created->json('client_order_reference'));

        $filtered = $this->getJson(
            '/api/work-orders?client_order_reference=PED-Cliente',
            ['Authorization' => 'Bearer '.$token],
        )->assertOk();
        $this->assertGreaterThanOrEqual(1, count($filtered->json('data')));
    }
}
