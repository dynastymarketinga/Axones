<?php

namespace Tests\Feature;

use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Models\User;
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
