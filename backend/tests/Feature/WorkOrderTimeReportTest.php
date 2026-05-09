<?php

namespace Tests\Feature;

use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\CorteTimeSegment;
use App\Models\LaminacionTimeSegment;
use App\Models\PrintingTimeSegment;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderTimeReportTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    private function makeWorkOrder(User $creator, string $suffix = '1'): WorkOrder
    {
        $client = Client::query()->create([
            'name' => 'Cliente TR '.$suffix,
            'rif' => 'J-100-'.$suffix,
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Empaque '.$suffix,
            'cpe' => 'CPE-TR-'.$suffix,
        ]);

        return WorkOrder::query()->create([
            'code' => 'OT-TR-'.$suffix,
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $creator->id,
        ]);
    }

    public function test_time_report_aggregates_segments_and_filters_by_work_order(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = $this->makeWorkOrder($user, 'A');
        $other = $this->makeWorkOrder($user, 'B');

        // Segmentos cerrados para la OT objetivo: 1h efectiva + 30min muertos + 15min montaje.
        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'started_at' => '2026-05-10 08:00:00',
            'ended_at' => '2026-05-10 09:00:00',
            'user_id' => $user->id,
            'notes' => null,
        ]);
        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'downtime',
            'started_at' => '2026-05-10 09:00:00',
            'ended_at' => '2026-05-10 09:30:00',
            'user_id' => $user->id,
            'notes' => 'Cambio de anilox',
        ]);
        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'mount',
            'started_at' => '2026-05-10 07:30:00',
            'ended_at' => '2026-05-10 07:45:00',
            'user_id' => $user->id,
            'notes' => null,
        ]);
        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'demount',
            'started_at' => '2026-05-10 07:45:00',
            'ended_at' => '2026-05-10 07:55:00',
            'user_id' => $user->id,
            'notes' => null,
        ]);

        // Segmento abierto (no debe contar).
        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'production',
            'started_at' => '2026-05-11 08:00:00',
            'ended_at' => null,
            'user_id' => $user->id,
        ]);

        // Segmento de OTRA OT (no debe entrar al filtrar).
        PrintingTimeSegment::query()->create([
            'work_order_id' => $other->id,
            'segment_type' => 'downtime',
            'started_at' => '2026-05-10 10:00:00',
            'ended_at' => '2026-05-10 10:10:00',
            'user_id' => $user->id,
            'notes' => 'OT distinta',
        ]);

        $resp = $this->getJson(
            "/api/reports/work-order-time-report?from=2026-05-01&to=2026-05-31&work_order_id={$wo->id}",
            $h,
        );

        $resp->assertOk()
            ->assertJsonStructure([
                'from',
                'to',
                'work_order_id',
                'work_order',
                'summary',
                'totals' => ['production_seconds', 'downtime_seconds', 'mount_seconds', 'demount_seconds', 'total_seconds', 'effective_percent'],
                'downtimes',
                'rows_csv',
            ]);

        $this->assertSame($wo->id, $resp->json('work_order_id'));
        $this->assertSame(3600, $resp->json('totals.production_seconds'));
        $this->assertSame(1800, $resp->json('totals.downtime_seconds'));
        $this->assertSame(900, $resp->json('totals.mount_seconds'));
        $this->assertSame(600, $resp->json('totals.demount_seconds'));
        $this->assertSame(6900, $resp->json('totals.total_seconds'));

        // Solo 1 parada de la OT objetivo (la otra es de "other").
        $downtimes = $resp->json('downtimes');
        $this->assertCount(1, $downtimes);
        $this->assertSame('Cambio de anilox', $downtimes[0]['reason']);
        $this->assertSame('printing', $downtimes[0]['area']);
    }

    public function test_time_report_csv_returns_csv_content(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = $this->makeWorkOrder($user);

        PrintingTimeSegment::query()->create([
            'work_order_id' => $wo->id,
            'segment_type' => 'downtime',
            'started_at' => '2026-05-10 09:00:00',
            'ended_at' => '2026-05-10 09:15:00',
            'user_id' => $user->id,
            'notes' => 'Falla eléctrica',
        ]);

        $resp = $this->withoutExceptionHandling()->getJson(
            '/api/reports/work-order-time-report?from=2026-05-01&to=2026-05-31&format=csv',
            $h,
        );

        $this->assertSame(200, $resp->getStatusCode());
        $this->assertStringContainsString('text/csv', (string) $resp->headers->get('Content-Type'));
        $body = (string) $resp->getContent();
        $this->assertStringContainsString('section', $body);
        $this->assertStringContainsString('Falla eléctrica', $body);
    }

    public function test_time_report_preview_returns_html(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $resp = $this->call('GET', '/api/reports/work-order-time-report/preview', [
            'from' => '2026-05-01',
            'to' => '2026-05-31',
        ], [], [], $this->transformHeadersToServerVars($h));

        $this->assertSame(200, $resp->getStatusCode());
        $this->assertStringContainsString('text/html', (string) $resp->headers->get('Content-Type'));
        $this->assertStringContainsString('Reporte de tiempos de producción', (string) $resp->getContent());
    }

    public function test_time_report_pdf_downloads_pdf(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $resp = $this->call('GET', '/api/reports/work-order-time-report.pdf', [
            'from' => '2026-05-01',
            'to' => '2026-05-31',
        ], [], [], $this->transformHeadersToServerVars($h));

        $this->assertSame(200, $resp->getStatusCode());
        $contentType = (string) $resp->headers->get('Content-Type');
        $this->assertTrue(
            str_contains($contentType, 'pdf') || str_contains($contentType, 'octet-stream'),
            'Expected PDF content type, got: '.$contentType,
        );
    }

    public function test_time_report_requires_auth(): void
    {
        $this->getJson('/api/reports/work-order-time-report?from=2026-05-01&to=2026-05-31')
            ->assertUnauthorized();
    }

    public function test_time_report_candidates_lists_work_orders_and_areas(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $woA = $this->makeWorkOrder($user, 'CA');
        $woB = $this->makeWorkOrder($user, 'CB');

        PrintingTimeSegment::query()->create([
            'work_order_id' => $woA->id,
            'segment_type' => 'production',
            'started_at' => '2026-05-10 08:00:00',
            'ended_at' => '2026-05-10 09:00:00',
            'user_id' => $user->id,
            'notes' => null,
        ]);

        LaminacionTimeSegment::query()->create([
            'work_order_id' => $woA->id,
            'segment_type' => 'production',
            'started_at' => '2026-05-11 10:00:00',
            'ended_at' => '2026-05-11 10:30:00',
            'user_id' => $user->id,
            'notes' => null,
        ]);

        CorteTimeSegment::query()->create([
            'work_order_id' => $woB->id,
            'segment_type' => 'mount',
            'started_at' => '2026-05-12 14:00:00',
            'ended_at' => '2026-05-12 14:20:00',
            'user_id' => $user->id,
            'notes' => null,
        ]);

        // Fuera de rango (no debe listar).
        PrintingTimeSegment::query()->create([
            'work_order_id' => $woB->id,
            'segment_type' => 'production',
            'started_at' => '2026-04-01 08:00:00',
            'ended_at' => '2026-04-01 09:00:00',
            'user_id' => $user->id,
            'notes' => null,
        ]);

        $resp = $this->getJson(
            '/api/reports/work-order-time-report/candidates?from=2026-05-01&to=2026-05-31',
            $h,
        );

        $resp->assertOk()
            ->assertJsonStructure([
                'from',
                'to',
                'work_orders' => [
                    '*' => [
                        'work_order_id',
                        'work_order_code',
                        'client_name',
                        'product_name',
                        'areas',
                        'production_seconds',
                        'downtime_seconds',
                        'mount_seconds',
                        'demount_seconds',
                        'total_seconds',
                        'effective_percent',
                    ],
                ],
            ]);

        $rows = $resp->json('work_orders');
        $this->assertCount(2, $rows);

        $byId = collect($rows)->keyBy('work_order_id');
        $this->assertSame(['printing', 'laminacion'], $byId[$woA->id]['areas']);
        $this->assertSame(['corte'], $byId[$woB->id]['areas']);
        $this->assertSame('OT-TR-CA', $byId[$woA->id]['work_order_code']);
        $this->assertSame('OT-TR-CB', $byId[$woB->id]['work_order_code']);

        $this->assertSame('Empaque CA', $byId[$woA->id]['product_name']);
        $this->assertSame('Empaque CB', $byId[$woB->id]['product_name']);

        // WO A: 1h printing production + 30min laminacion production = 5400 s efectivo
        $this->assertSame(5400, (int) $byId[$woA->id]['production_seconds']);
        $this->assertSame(0, (int) $byId[$woA->id]['downtime_seconds']);
        $this->assertSame(5400, (int) $byId[$woA->id]['total_seconds']);
        $this->assertSame('100.00', $byId[$woA->id]['effective_percent']);

        // WO B: 20min mount on corte = 1200 s
        $this->assertSame(1200, (int) $byId[$woB->id]['mount_seconds']);
        $this->assertSame(0, (int) $byId[$woB->id]['production_seconds']);
        $this->assertSame(1200, (int) $byId[$woB->id]['total_seconds']);
        $this->assertSame('0.00', $byId[$woB->id]['effective_percent']);
    }
}
