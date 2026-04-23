<?php

namespace Tests\Feature;

use App\Enums\WorkOrderStatus;
use App\Models\Bobina;
use App\Models\Material;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CorteProductionTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_corte_state_requires_auth(): void
    {
        $wo = WorkOrder::query()->create([
            'code' => 'OT-C-1',
            'status' => WorkOrderStatus::Open->value,
        ]);

        $this->getJson("/api/work-orders/{$wo->id}/corte")->assertUnauthorized();
    }

    public function test_time_segments_and_totals(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-04-21 08:00:00'));

        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-C-2',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $this->postJson("/api/work-orders/{$wo->id}/corte/time-segments/start", [
            'segment_type' => 'mount',
        ], $h)->assertCreated();

        Carbon::setTestNow(Carbon::parse('2026-04-21 08:10:00'));

        $this->postJson("/api/work-orders/{$wo->id}/corte/time-segments/start", [
            'segment_type' => 'production',
        ], $h)->assertCreated();

        $state = $this->getJson("/api/work-orders/{$wo->id}/corte", $h)->assertOk();
        $this->assertEquals('600', $state->json('time_totals_seconds.mount'));

        $openId = $state->json('open_time_segment.id');
        Carbon::setTestNow(Carbon::parse('2026-04-21 08:20:00'));
        $this->postJson("/api/work-orders/{$wo->id}/corte/time-segments/{$openId}/stop", [], $h)->assertOk();

        $final = $this->getJson("/api/work-orders/{$wo->id}/corte", $h)->assertOk();
        $this->assertEquals('600', $final->json('time_totals_seconds.mount'));
        $this->assertEquals('600', $final->json('time_totals_seconds.production'));

        Carbon::setTestNow();
    }

    public function test_rejects_segment_on_cancelled_work_order(): void
    {
        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-C-3',
            'status' => WorkOrderStatus::Cancelled->value,
            'created_by' => $user->id,
        ]);

        $this->postJson("/api/work-orders/{$wo->id}/corte/time-segments/start", [
            'segment_type' => 'mount',
        ], $this->auth($user))->assertUnprocessable();
    }

    public function test_bobina_usage_and_summary(): void
    {
        $user = User::factory()->create();
        $wo = WorkOrder::query()->create([
            'code' => 'OT-C-4',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $mat = Material::query()->create([
            'sku' => 'SUB-C',
            'name' => 'Rollo corte',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        $bob = Bobina::query()->create([
            'material_id' => $mat->id,
            'code' => 'BOB-C-1',
            'weight_kg' => 40,
            'status' => 'available',
        ]);

        $this->postJson("/api/work-orders/{$wo->id}/corte/bobina-usages", [
            'material_id' => $mat->id,
            'bobina_id' => $bob->id,
            'quantity_used_kg' => 8,
            'quantity_finished_kg' => 7,
        ], $h)->assertCreated();

        $this->patchJson("/api/work-orders/{$wo->id}/corte/summary", [
            'scrap_percent' => 1.2,
        ], $h)->assertOk();

        $state = $this->getJson("/api/work-orders/{$wo->id}/corte", $h)->assertOk();
        $this->assertEquals('1.200', $state->json('summary.scrap_percent'));
        $this->assertCount(1, $state->json('bobina_usages'));
    }
}
