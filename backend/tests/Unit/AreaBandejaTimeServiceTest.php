<?php

namespace Tests\Unit;

use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderStatus;
use App\Models\CorteTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\AreaBandejaTimeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AreaBandejaTimeServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_summaries_accumulate_closed_segments_and_open_flag(): void
    {
        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-BANDEJA-TIME-1',
            'status' => WorkOrderStatus::Open->value,
            'board_stage' => WorkOrderBoardStage::Corte->value,
        ]);

        CorteTimeSegment::query()->create([
            'work_order_id' => $wo->getKey(),
            'segment_type' => 'production',
            'started_at' => now()->subHours(2),
            'ended_at' => now()->subHours(1),
            'user_id' => $user->getKey(),
        ]);

        CorteTimeSegment::query()->create([
            'work_order_id' => $wo->getKey(),
            'segment_type' => 'production',
            'started_at' => now()->subMinutes(10),
            'ended_at' => null,
            'user_id' => $user->getKey(),
        ]);

        $svc = app(AreaBandejaTimeService::class);
        $out = $svc->summariesForWorkOrderIds(collect([$wo->getKey()]), 'corte');

        $this->assertArrayHasKey($wo->getKey(), $out);
        $this->assertGreaterThan(3500, $out[$wo->getKey()]['effective_seconds']);
        $this->assertSame('production', $out[$wo->getKey()]['open_segment_type']);
        $this->assertNotNull($out[$wo->getKey()]['open_started_at']);
    }
}
