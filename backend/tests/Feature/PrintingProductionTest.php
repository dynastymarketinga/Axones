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

class PrintingProductionTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_printing_state_requires_auth(): void
    {
        $wo = WorkOrder::query()->create([
            'code' => 'OT-P-1',
            'status' => WorkOrderStatus::Open->value,
        ]);

        $this->getJson("/api/work-orders/{$wo->id}/printing")->assertUnauthorized();
    }

    public function test_time_segments_mount_production_stop_and_totals(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-04-20 08:00:00'));

        $user = User::factory()->create(['role' => 'boss']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-P-2',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $this->postJson("/api/work-orders/{$wo->id}/printing/time-segments/start", [
            'segment_type' => 'mount',
        ], $h)->assertCreated()->assertJsonPath('segment_type', 'mount');

        Carbon::setTestNow(Carbon::parse('2026-04-20 08:10:00'));

        $this->postJson("/api/work-orders/{$wo->id}/printing/time-segments/start", [
            'segment_type' => 'production',
        ], $h)->assertCreated()->assertJsonPath('segment_type', 'production');

        $state = $this->getJson("/api/work-orders/{$wo->id}/printing", $h)->assertOk();
        $this->assertEquals('600', $state->json('time_totals_seconds.mount'));
        $this->assertEquals('0', $state->json('time_totals_seconds.production'));

        $openId = $state->json('open_time_segment.id');
        $this->assertNotNull($openId);

        Carbon::setTestNow(Carbon::parse('2026-04-20 08:25:00'));

        $this->postJson("/api/work-orders/{$wo->id}/printing/time-segments/{$openId}/stop", [], $h)->assertOk();

        $final = $this->getJson("/api/work-orders/{$wo->id}/printing", $h)->assertOk();
        $this->assertEquals('600', $final->json('time_totals_seconds.mount'));
        $this->assertEquals('900', $final->json('time_totals_seconds.production'));
        $this->assertEquals('0', $final->json('time_totals_seconds.demount'));

        Carbon::setTestNow();
    }

    public function test_time_segment_demount_accumulates_in_totals(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-04-22 10:00:00'));

        $user = User::factory()->create(['role' => 'boss']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-P-DEM',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $this->postJson("/api/work-orders/{$wo->id}/printing/time-segments/start", [
            'segment_type' => 'demount',
        ], $h)->assertCreated()->assertJsonPath('segment_type', 'demount');

        Carbon::setTestNow(Carbon::parse('2026-04-22 10:03:00'));

        $state = $this->getJson("/api/work-orders/{$wo->id}/printing", $h)->assertOk();
        $openId = $state->json('open_time_segment.id');
        $this->postJson("/api/work-orders/{$wo->id}/printing/time-segments/{$openId}/stop", [], $h)->assertOk();

        $final = $this->getJson("/api/work-orders/{$wo->id}/printing", $h)->assertOk();
        $this->assertEquals('180', $final->json('time_totals_seconds.demount'));

        Carbon::setTestNow();
    }

    public function test_rejects_segment_on_cancelled_work_order(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-P-3',
            'status' => WorkOrderStatus::Cancelled->value,
            'created_by' => $user->id,
        ]);

        $this->postJson("/api/work-orders/{$wo->id}/printing/time-segments/start", [
            'segment_type' => 'mount',
        ], $this->auth($user))->assertUnprocessable();
    }

    public function test_bobina_usage_and_summary(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-P-4',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $mat = Material::query()->create([
            'sku' => 'SUB-P',
            'name' => 'Sustrato',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        $bob = Bobina::query()->create([
            'material_id' => $mat->id,
            'code' => 'BOB-P-1',
            'weight_kg' => 50,
            'status' => 'available',
        ]);

        $this->postJson("/api/work-orders/{$wo->id}/printing/bobina-usages", [
            'material_id' => $mat->id,
            'bobina_id' => $bob->id,
            'quantity_used_kg' => 12.5,
            'quantity_finished_kg' => 11,
            'notes' => 'Bobina 1',
        ], $h)->assertCreated()->assertJsonPath('quantity_used_kg', '12.500');

        $this->patchJson("/api/work-orders/{$wo->id}/printing/summary", [
            'scrap_percent' => 2.5,
            'notes' => 'Merma controlada',
        ], $h)->assertOk()->assertJsonPath('scrap_percent', '2.500');

        $state = $this->getJson("/api/work-orders/{$wo->id}/printing", $h)->assertOk();
        $this->assertEquals('2.500', $state->json('summary.scrap_percent'));
        $this->assertCount(1, $state->json('bobina_usages'));
    }

    public function test_bobina_material_mismatch_is_rejected(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-P-5',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $m1 = Material::query()->create([
            'sku' => 'M1',
            'name' => 'M1',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m1->forceFill(['quantity_on_hand' => 0])->save();
        $m2 = Material::query()->create([
            'sku' => 'M2',
            'name' => 'M2',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m2->forceFill(['quantity_on_hand' => 0])->save();

        $bob = Bobina::query()->create([
            'material_id' => $m1->id,
            'code' => 'BOB-X',
            'weight_kg' => 10,
            'status' => 'available',
        ]);

        $this->postJson("/api/work-orders/{$wo->id}/printing/bobina-usages", [
            'material_id' => $m2->id,
            'bobina_id' => $bob->id,
            'quantity_used_kg' => 1,
        ], $this->auth($user))->assertUnprocessable();
    }
}
