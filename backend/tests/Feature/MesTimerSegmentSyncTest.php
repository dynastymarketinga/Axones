<?php

namespace Tests\Feature;

use App\Enums\WorkOrderBoardStage;
use App\Models\CorteTimeSegment;
use App\Models\PrintingTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MesTimerSegmentSyncTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_printing_control_timer_start_creates_production_segment(): void
    {
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MES-SYNC-1',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => ['impTimerState' => 'pending'],
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impTimerState' => 'running',
                'impTimerLastResumeAtMs' => (string) (now()->getTimestampMs()),
            ],
        ], $h)->assertOk();

        $this->assertDatabaseHas('printing_time_segments', [
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'user_id' => $user->id,
        ]);

        $open = PrintingTimeSegment::query()
            ->where('work_order_id', $wo->id)
            ->whereNull('ended_at')
            ->first();
        $this->assertNotNull($open);
        $this->assertSame('production', $open->segment_type);
    }

    public function test_printing_control_pause_creates_downtime_segment_and_closes_production(): void
    {
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MES-SYNC-2',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => ['impTimerState' => 'running'],
        ]);

        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'started_at' => now()->subHour(),
            'ended_at' => null,
            'user_id' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impTimerState' => 'paused',
                'impTimerPauses' => [
                    [
                        'at' => now()->toIso8601String(),
                        'reason' => 'Cambio de anilox',
                        'obs' => '',
                        'duration_sec' => 120,
                    ],
                ],
            ],
        ], $h)->assertOk();

        $this->assertSame(
            1,
            PrintingTimeSegment::query()
                ->where('work_order_id', $wo->id)
                ->where('segment_type', 'production')
                ->whereNotNull('ended_at')
                ->count(),
        );

        $open = PrintingTimeSegment::query()
            ->where('work_order_id', $wo->id)
            ->whereNull('ended_at')
            ->first();
        $this->assertNotNull($open);
        $this->assertSame('downtime', $open->segment_type);
        $this->assertStringContainsString('Cambio de anilox', (string) $open->notes);
    }

    public function test_printing_control_timer_stop_closes_open_segment(): void
    {
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MES-SYNC-3',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => ['impTimerState' => 'running'],
        ]);

        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'started_at' => now()->subMinutes(30),
            'ended_at' => null,
            'user_id' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => ['impTimerState' => 'stopped'],
        ], $h)->assertOk();

        $this->assertSame(
            0,
            PrintingTimeSegment::query()
                ->where('work_order_id', $wo->id)
                ->whereNull('ended_at')
                ->count(),
        );
    }

    public function test_corte_control_timer_start_creates_production_segment(): void
    {
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MES-SYNC-CORTE',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Corte->value,
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'corTimerState' => 'pending',
                'corOperador' => 'Ana',
                'corTurno' => 'diurno',
                'corGrupo' => 'A',
            ],
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'corTimerState' => 'running',
                'corTimerLastResumeAtMs' => (string) (now()->getTimestampMs()),
                'corOperador' => 'Ana',
                'corTurno' => 'diurno',
                'corGrupo' => 'A',
            ],
        ], $h)->assertOk();

        $this->assertDatabaseHas('corte_time_segments', [
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'user_id' => $user->id,
        ]);

        $open = CorteTimeSegment::query()
            ->where('work_order_id', $wo->id)
            ->whereNull('ended_at')
            ->first();
        $this->assertNotNull($open);
        $this->assertSame('production', $open->segment_type);
    }

    public function test_time_report_candidates_include_ot_after_mes_timer_sync(): void
    {
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MES-SYNC-4',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => ['impTimerState' => 'pending'],
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => ['impTimerState' => 'running'],
        ], $h)->assertOk();

        $open = PrintingTimeSegment::query()
            ->where('work_order_id', $wo->id)
            ->whereNull('ended_at')
            ->first();
        $this->assertNotNull($open);
        $open->update([
            'started_at' => now()->subHour(),
            'ended_at' => now(),
        ]);

        $from = now()->subDays(30)->toDateString();
        $to = now()->addDay()->toDateString();

        $res = $this->getJson("/api/reports/work-order-time-report/candidates?from={$from}&to={$to}", $h)
            ->assertOk();

        $ids = collect($res->json('work_orders'))->pluck('work_order_id')->all();
        $this->assertContains($wo->id, $ids);
    }
}
