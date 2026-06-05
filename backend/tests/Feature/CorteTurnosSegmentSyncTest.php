<?php

namespace Tests\Feature;

use App\Models\CorteTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CorteTurnosSegmentSyncTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_closed_corte_turnos_create_segments_for_time_report(): void
    {
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-COR-TURNOS-1',
            'status' => 'in_progress',
            'board_stage' => 'corte',
            'created_by' => $user->id,
        ]);

        $closedAt = Carbon::parse('2026-05-28 10:53:36');

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'corOperador' => 'Ana',
                'cor_turnos' => [
                    [
                        'id' => 'turno-1',
                        'turno' => 'diurno',
                        'grupo' => 'B',
                        'operador' => 'Ana',
                        'closed_at' => $closedAt->toIso8601String(),
                        'timer' => [
                            'state' => 'stopped',
                            'effectiveAccSec' => 50,
                            'deadAccSec' => 10,
                            'pauses' => [
                                [
                                    'at' => $closedAt->toIso8601String(),
                                    'reason' => 'Ajuste',
                                    'obs' => '',
                                    'duration_sec' => 10,
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => WorkOrderTechnicalDocument::query()->where('work_order_id', $wo->id)->value('form'),
            'origin_area' => 'corte',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->assertDatabaseHas('corte_time_segments', [
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'notes' => 'cor_turno_sync:turno-1#production',
        ]);

        $from = '2026-05-01';
        $to = '2026-05-31';
        $res = $this->getJson(
            "/api/reports/work-order-time-report/candidates?from={$from}&to={$to}",
            $h,
        )->assertOk();

        $row = collect($res->json('work_orders'))->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($row);
        $this->assertSame(50, (int) $row['production_seconds']);
        $this->assertSame(10, (int) $row['downtime_seconds']);
    }

    public function test_live_mode_includes_open_corte_turno_from_planilla(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-02 12:00:00'));

        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-LIVE-COR-1',
            'status' => 'in_progress',
            'board_stage' => 'corte',
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'corOperador' => 'Op',
                'cor_turnos' => [],
                'corTurnoActual' => [
                    'id' => 'turno-open',
                    'turno' => 'nocturno',
                    'grupo' => 'B',
                    'operador' => 'Op',
                    'started_at' => now()->subMinutes(30)->toIso8601String(),
                    'closed_at' => null,
                    'timer' => [
                        'state' => 'running',
                        'effectiveAccSec' => 60,
                        'deadAccSec' => 0,
                        'lastResumeAtMs' => now()->subMinutes(5)->getTimestampMs(),
                        'pauses' => [],
                    ],
                ],
            ],
        ]);

        $live = $this->getJson(
            '/api/reports/production-time-by-area?from=2026-06-02&to=2026-06-02&live=1',
            $h,
        )->assertOk();

        $row = collect($live->json('rows'))->first(
            fn (array $r) => ($r['area'] ?? '') === 'corte' && ($r['segment_type'] ?? '') === 'production',
        );
        $this->assertNotNull($row);
        $this->assertGreaterThanOrEqual(300, (int) ($row['total_seconds'] ?? 0));

        $candidates = $this->getJson(
            '/api/reports/work-order-time-report/candidates?from=2026-06-02&to=2026-06-02&live=1',
            $h,
        )->assertOk();

        $woRow = collect($candidates->json('work_orders'))->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($woRow);
        $this->assertGreaterThanOrEqual(300, (int) $woRow['production_seconds']);

        Carbon::setTestNow();
    }

    public function test_turno_sync_is_idempotent_on_repeated_save(): void
    {
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-COR-TURNOS-2',
            'status' => 'in_progress',
            'board_stage' => 'corte',
            'created_by' => $user->id,
        ]);

        $form = [
            'corOperador' => 'Op',
            'cor_turnos' => [
                [
                    'id' => 'turno-x',
                    'turno' => 'diurno',
                    'grupo' => 'A',
                    'operador' => 'Op',
                    'closed_at' => now()->toIso8601String(),
                    'timer' => [
                        'state' => 'stopped',
                        'effectiveAccSec' => 30,
                        'deadAccSec' => 0,
                        'pauses' => [],
                    ],
                ],
            ],
        ];

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => $form,
        ]);

        $payload = ['form' => $form, 'origin_area' => 'corte', 'notify_on_production_save' => false];

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", $payload, $h)->assertOk();
        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", $payload, $h)->assertOk();

        $this->assertSame(
            1,
            CorteTimeSegment::query()
                ->where('work_order_id', $wo->id)
                ->where('notes', 'cor_turno_sync:turno-x#production')
                ->count(),
        );
    }
}
