<?php

namespace Tests\Feature;

use App\Models\PrintingTimeSegment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductionTimeLiveReportTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_live_mode_includes_open_printing_segment(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-02 14:00:00'));

        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-LIVE-PRINT-1',
            'status' => 'in_progress',
            'board_stage' => 'impresion',
            'created_by' => $user->id,
        ]);

        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'machine_code' => 'FLEXO 1',
            'segment_type' => 'production',
            'started_at' => Carbon::parse('2026-06-02 13:30:00'),
            'ended_at' => null,
            'user_id' => $user->id,
            'notes' => null,
        ]);

        $closed = $this->getJson(
            '/api/reports/production-time-by-area?from=2026-06-02&to=2026-06-02',
            $h,
        )->assertOk();

        $this->assertSame([], $closed->json('rows'));

        $live = $this->getJson(
            '/api/reports/production-time-by-area?from=2026-06-02&to=2026-06-02&live=1',
            $h,
        )->assertOk();

        $this->assertTrue((bool) $live->json('live'));
        $row = collect($live->json('rows'))->first(
            fn (array $r) => ($r['area'] ?? '') === 'printing' && ($r['segment_type'] ?? '') === 'production',
        );
        $this->assertNotNull($row);
        $this->assertSame(1800, (int) ($row['total_seconds'] ?? 0));

        $candidates = $this->getJson(
            '/api/reports/work-order-time-report/candidates?from=2026-06-02&to=2026-06-02&live=1',
            $h,
        )->assertOk();

        $woRow = collect($candidates->json('work_orders'))->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($woRow);
        $this->assertSame(1800, (int) $woRow['production_seconds']);

        $active = collect($candidates->json('live_active'));
        $this->assertTrue($active->contains(
            fn (array $row) => ($row['area'] ?? '') === 'printing'
                && (int) ($row['work_order_id'] ?? 0) === $wo->id
                && in_array('production', (array) ($row['segment_types'] ?? []), true),
        ));

        Carbon::setTestNow();
    }

    public function test_live_mode_includes_montaje_planilla_turno_actual(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-02 12:00:00'));

        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-LIVE-MONT-1',
            'status' => 'in_progress',
            'board_stage' => 'montaje',
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'pedidoKg' => '100',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'superficie',
                'montTurnoActual' => [
                    'id' => 'turno-live-1',
                    'started_at' => '2026-06-02T10:00:00+00:00',
                    'timer' => [
                        'state' => 'running',
                        'effectiveAccSec' => 120,
                        'deadAccSec' => 0,
                        'arranqueAccSec' => 30,
                        'montajeOpAccSec' => 0,
                        'demountAccSec' => 0,
                        'lastResumeAtMs' => Carbon::parse('2026-06-02 11:58:00')->getTimestampMs(),
                        'pauses' => [],
                    ],
                ],
                'montTurnosMontaje' => [],
            ],
        ]);

        $live = $this->getJson(
            '/api/reports/production-time-by-area?from=2026-06-02&to=2026-06-02&live=1',
            $h,
        )->assertOk();

        $prod = collect($live->json('rows'))->first(
            fn (array $r) => ($r['area'] ?? '') === 'montaje' && ($r['segment_type'] ?? '') === 'production',
        );
        $mount = collect($live->json('rows'))->first(
            fn (array $r) => ($r['area'] ?? '') === 'montaje' && ($r['segment_type'] ?? '') === 'mount',
        );

        $this->assertNotNull($prod);
        $this->assertSame(240, (int) ($prod['total_seconds'] ?? 0));
        $this->assertNotNull($mount);
        $this->assertSame(30, (int) ($mount['total_seconds'] ?? 0));

        $candidates = $this->getJson(
            '/api/reports/work-order-time-report/candidates?from=2026-06-02&to=2026-06-02&live=1',
            $h,
        )->assertOk();

        $active = collect($candidates->json('live_active'));
        $this->assertTrue($active->contains(
            fn (array $row) => ($row['area'] ?? '') === 'montaje'
                && (int) ($row['work_order_id'] ?? 0) === $wo->id,
        ));

        Carbon::setTestNow();
    }
}
