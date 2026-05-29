<?php

namespace Tests\Feature;

use App\Enums\AreaRequestStatus;
use App\Enums\MaterialRequestStatus;
use App\Models\AreaRequest;
use App\Models\MaterialRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\AreaRequestService;
use App\Services\ProductionNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AreaRequestConsolidationTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    private function createWorkOrder(User $user, string $code = 'OT-TEST-00001'): WorkOrder
    {
        return WorkOrder::query()->create([
            'code' => $code,
            'status' => 'open',
            'created_by' => $user->id,
        ]);
    }

    public function test_area_requests_index_insumos_only_excludes_ot_coordination(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = $this->createWorkOrder($user);

        AreaRequest::query()->create([
            'area' => 'impresion',
            'title' => sprintf('OT %s — asignada a Impresion', $wo->code),
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
        ]);
        $mr = MaterialRequest::query()->create([
            'status' => MaterialRequestStatus::Pending->value,
            'requested_by' => $user->id,
            'work_order_id' => $wo->id,
        ]);
        $insumos = AreaRequest::query()->create([
            'area' => 'almacen',
            'title' => 'Solicitud de insumos #'.$mr->id,
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'material_request_id' => $mr->id,
            'requested_by' => $user->id,
        ]);

        $resp = $this->getJson('/api/area-requests?insumos_only=1&status=pending', $h)->assertOk();
        $ids = collect($resp->json('data'))->pluck('id')->all();

        $this->assertSame([$insumos->id], $ids);
    }

    public function test_saved_broadcast_supersedes_older_pending_coordination(): void
    {
        $user = User::factory()->create();
        $wo = $this->createWorkOrder($user);
        $notifications = app(ProductionNotificationService::class);

        $notifications->notifyOnWorkOrderCreated($wo, $user);
        $createdId = (int) AreaRequest::query()
            ->where('work_order_id', $wo->id)
            ->where('area', 'corte')
            ->where('title', sprintf('OT %s creada', $wo->code))
            ->value('id');

        $notifications->notifyOnWorkOrderSavedBroadcast($wo, $user, 'fp-1');

        $this->assertSame(
            AreaRequestStatus::Done->value,
            (string) AreaRequest::query()->find($createdId)?->status,
        );
        $this->assertSame(
            1,
            AreaRequest::query()
                ->where('work_order_id', $wo->id)
                ->where('area', 'corte')
                ->where('status', AreaRequestStatus::Pending->value)
                ->count(),
        );
    }

    public function test_consolidate_command_closes_stale_pending_rows(): void
    {
        $user = User::factory()->create();
        $wo = $this->createWorkOrder($user);

        AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => sprintf('OT %s creada', $wo->code),
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
        ]);
        $keep = AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => sprintf('OT %s — orden guardada', $wo->code),
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
        ]);

        $result = app(AreaRequestService::class)->consolidateDuplicateWorkOrderCoordination();

        $this->assertSame(1, $result['closed']);
        $this->assertSame(
            1,
            AreaRequest::query()
                ->where('work_order_id', $wo->id)
                ->where('area', 'montaje')
                ->where('status', AreaRequestStatus::Pending->value)
                ->count(),
        );
        $this->assertSame($keep->id, (int) AreaRequest::query()
            ->where('work_order_id', $wo->id)
            ->where('area', 'montaje')
            ->where('status', AreaRequestStatus::Pending->value)
            ->value('id'));
    }
}
