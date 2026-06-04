<?php

namespace Tests\Feature;

use App\Models\MontajeTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MontajeTurnosSegmentSyncTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_closed_montaje_turnos_create_segments_for_time_report(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MONT-TURNOS-1',
            'status' => 'in_progress',
            'board_stage' => 'montaje',
            'created_by' => $user->id,
        ]);

        $closedAt = Carbon::parse('2026-05-28 10:53:36');

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'pedidoKg' => '100',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'superficie',
                'montTurnosMontaje' => [
                    [
                        'id' => 'turno-1',
                        'turno' => 'diurno',
                        'grupo' => 'B',
                        'operador' => 'AAAA',
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

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", [
            'form' => WorkOrderTechnicalDocument::query()->where('work_order_id', $wo->id)->value('form'),
            'origin_area' => 'montaje',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->assertDatabaseHas('montaje_time_segments', [
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'notes' => 'mont_turno_sync:turno-1#production',
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
        $this->assertSame(0, (int) $row['mount_seconds']);
    }

    public function test_turno_sync_is_idempotent_on_repeated_save(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MONT-TURNOS-2',
            'status' => 'in_progress',
            'board_stage' => 'montaje',
            'created_by' => $user->id,
        ]);

        $form = [
            'pedidoKg' => '100',
            'maquina' => 'COMEXI 1',
            'tipoImpresionEstructura' => 'superficie',
            'montTurnosMontaje' => [
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

        $payload = ['form' => $form, 'origin_area' => 'montaje', 'notify_on_production_save' => false];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();
        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();

        $this->assertSame(
            1,
            MontajeTimeSegment::query()
                ->where('work_order_id', $wo->id)
                ->where('notes', 'mont_turno_sync:turno-x#production')
                ->count(),
        );
    }

    public function test_open_montaje_turno_syncs_segments_on_save_for_time_report(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MONT-OPEN-1',
            'status' => 'in_progress',
            'board_stage' => 'montaje',
            'created_by' => $user->id,
        ]);

        $form = [
            'pedidoKg' => '100',
            'maquina' => 'COMEXI 1',
            'montTurnosMontaje' => [],
            'montTurnoActual' => [
                'id' => 'turno-open',
                'turno' => 'nocturno',
                'grupo' => 'B',
                'operador' => 'AAA',
                'started_at' => now()->subHour()->toIso8601String(),
                'closed_at' => null,
                'timer' => [
                    'state' => 'pending',
                    'effectiveAccSec' => 0,
                    'deadAccSec' => 0,
                    'arranqueState' => 'stopped',
                    'arranqueAccSec' => 35,
                    'montajeOpState' => 'idle',
                    'montajeOpAccSec' => 0,
                    'demountState' => 'idle',
                    'demountAccSec' => 0,
                    'pauses' => [],
                ],
            ],
        ];

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => $form,
        ]);

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", [
            'form' => $form,
            'origin_area' => 'montaje',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->assertDatabaseHas('montaje_time_segments', [
            'work_order_id' => $wo->id,
            'segment_type' => 'mount',
            'notes' => 'mont_turno_sync:turno-open#mount',
        ]);

        $from = now()->startOfMonth()->toDateString();
        $to = now()->endOfMonth()->toDateString();
        $res = $this->getJson(
            "/api/reports/work-order-time-report/candidates?from={$from}&to={$to}",
            $h,
        )->assertOk();

        $row = collect($res->json('work_orders'))->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($row);
        $this->assertGreaterThanOrEqual(35, (int) $row['mount_seconds']);
    }
}
