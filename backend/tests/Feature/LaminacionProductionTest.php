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

class LaminacionProductionTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_laminacion_state_requires_auth(): void
    {
        $wo = WorkOrder::query()->create([
            'code' => 'OT-L-1',
            'status' => WorkOrderStatus::Open->value,
        ]);

        $this->getJson("/api/work-orders/{$wo->id}/laminacion")->assertUnauthorized();
    }

    public function test_time_segments_and_totals(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-04-22 10:00:00'));

        $user = User::factory()->create(['role' => 'laminacion']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-L-2',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $this->postJson("/api/work-orders/{$wo->id}/laminacion/time-segments/start", [
            'segment_type' => 'production',
        ], $h)->assertCreated();

        $openId = $this->getJson("/api/work-orders/{$wo->id}/laminacion", $h)->json('open_time_segment.id');
        Carbon::setTestNow(Carbon::parse('2026-04-22 10:15:00'));
        $this->postJson("/api/work-orders/{$wo->id}/laminacion/time-segments/{$openId}/stop", [], $h)->assertOk();

        $final = $this->getJson("/api/work-orders/{$wo->id}/laminacion", $h)->assertOk();
        $this->assertEquals('900', $final->json('time_totals_seconds.production'));

        Carbon::setTestNow();
    }

    public function test_rejects_segment_on_cancelled_work_order(): void
    {
        $user = User::factory()->create(['role' => 'laminacion']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-L-3',
            'status' => WorkOrderStatus::Cancelled->value,
            'created_by' => $user->id,
        ]);

        $this->postJson("/api/work-orders/{$wo->id}/laminacion/time-segments/start", [
            'segment_type' => 'mount',
        ], $this->auth($user))->assertUnprocessable();
    }

    public function test_bobina_usage_summary_scrap_and_solvent(): void
    {
        $user = User::factory()->create(['role' => 'laminacion']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-L-4',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $h = $this->auth($user);

        $mat = Material::query()->create([
            'sku' => 'SUB-L',
            'name' => 'Film lam',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        $bob = Bobina::query()->create([
            'material_id' => $mat->id,
            'code' => 'BOB-L-1',
            'weight_kg' => 30,
            'status' => 'available',
        ]);

        $this->postJson("/api/work-orders/{$wo->id}/laminacion/bobina-usages", [
            'material_id' => $mat->id,
            'bobina_id' => $bob->id,
            'quantity_used_kg' => 5,
            'quantity_finished_kg' => 4.5,
        ], $h)->assertCreated();

        $this->patchJson("/api/work-orders/{$wo->id}/laminacion/summary", [
            'scrap_percent' => 0.8,
            'solvent_quantity_kg' => 1.25,
            'solvent_notes' => 'Etil acetato lote A-12',
            'notes' => 'Laminado OK',
        ], $h)->assertOk()
            ->assertJsonPath('scrap_percent', '0.800')
            ->assertJsonPath('solvent_quantity_kg', '1.250')
            ->assertJsonPath('solvent_notes', 'Etil acetato lote A-12');

        $state = $this->getJson("/api/work-orders/{$wo->id}/laminacion", $h)->assertOk();
        $this->assertCount(1, $state->json('bobina_usages'));
        $this->assertEquals('Laminado OK', $state->json('summary.notes'));
    }

    public function test_bobina_material_mismatch_is_rejected(): void
    {
        $user = User::factory()->create(['role' => 'laminacion']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-L-5',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $m1 = Material::query()->create([
            'sku' => 'LM1',
            'name' => 'M1',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m1->forceFill(['quantity_on_hand' => 0])->save();
        $m2 = Material::query()->create([
            'sku' => 'LM2',
            'name' => 'M2',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $m2->forceFill(['quantity_on_hand' => 0])->save();

        $bob = Bobina::query()->create([
            'material_id' => $m1->id,
            'code' => 'BOB-LM',
            'weight_kg' => 10,
            'status' => 'available',
        ]);

        $this->postJson("/api/work-orders/{$wo->id}/laminacion/bobina-usages", [
            'material_id' => $m2->id,
            'bobina_id' => $bob->id,
            'quantity_used_kg' => 1,
        ], $this->auth($user))->assertUnprocessable();
    }
}
