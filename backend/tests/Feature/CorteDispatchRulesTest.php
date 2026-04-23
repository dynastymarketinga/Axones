<?php

namespace Tests\Feature;

use App\Enums\DeliveryNoteStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\CorteBobinaUsage;
use App\Models\DeliveryNote;
use App\Models\DeliveryNoteLine;
use App\Models\Material;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CorteDispatchRulesTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    private function createCorteUsageWithFinished(float $finished): CorteBobinaUsage
    {
        $user = User::factory()->create();
        $client = Client::query()->create(['name' => 'C-D', 'rif' => 'J-700']);
        $product = Product::query()->create(['client_id' => $client->id, 'name' => 'P-D', 'cpe' => 'CPE-D']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-D-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-D',
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 0])->save();

        return CorteBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_used_kg' => 120,
            'quantity_finished_kg' => $finished,
            'bobina_id' => null,
        ]);
    }

    public function test_available_lists_remaining_after_dispatch(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $usage = $this->createCorteUsageWithFinished(50);

        $this->getJson('/api/corte-dispatch/available', $h)->assertOk();
        $rows = $this->getJson('/api/corte-dispatch/available', $h)->json('rows');
        $this->assertNotEmpty($rows);
        $match = collect($rows)->firstWhere('corte_bobina_usage_id', $usage->id);
        $this->assertEquals('50.000', $match['quantity_remaining_kg']);

        $this->postJson('/api/delivery-notes', [
            'lines' => [[
                'corte_bobina_usage_id' => $usage->id,
                'work_order_id' => $usage->work_order_id,
                'quantity_kg' => 30,
                'pallet_code' => 'P1',
            ]],
        ], $h)->assertCreated();

        $rows2 = $this->getJson('/api/corte-dispatch/available', $h)->json('rows');
        $match2 = collect($rows2)->firstWhere('corte_bobina_usage_id', $usage->id);
        $this->assertNotNull($match2);
        $this->assertEquals('20.000', $match2['quantity_remaining_kg']);
    }

    public function test_rejects_over_dispatch_from_corte_line(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $usage = $this->createCorteUsageWithFinished(25);

        $this->postJson('/api/delivery-notes', [
            'lines' => [[
                'corte_bobina_usage_id' => $usage->id,
                'work_order_id' => $usage->work_order_id,
                'quantity_kg' => 30,
            ]],
        ], $h)->assertUnprocessable();
    }

    public function test_rejects_mismatched_work_order_with_corte_line(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $usage = $this->createCorteUsageWithFinished(40);
        $otherWo = WorkOrder::query()->create([
            'code' => 'OT-OTHER',
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->postJson('/api/delivery-notes', [
            'lines' => [[
                'corte_bobina_usage_id' => $usage->id,
                'work_order_id' => $otherWo->id,
                'quantity_kg' => 10,
            ]],
        ], $h)->assertUnprocessable();
    }

    public function test_two_lines_same_corte_usage_sum_validated(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $usage = $this->createCorteUsageWithFinished(100);

        $this->postJson('/api/delivery-notes', [
            'lines' => [
                [
                    'corte_bobina_usage_id' => $usage->id,
                    'work_order_id' => $usage->work_order_id,
                    'quantity_kg' => 60,
                ],
                [
                    'corte_bobina_usage_id' => $usage->id,
                    'work_order_id' => $usage->work_order_id,
                    'quantity_kg' => 50,
                ],
            ],
        ], $h)->assertUnprocessable();

        $this->postJson('/api/delivery-notes', [
            'lines' => [
                [
                    'corte_bobina_usage_id' => $usage->id,
                    'work_order_id' => $usage->work_order_id,
                    'quantity_kg' => 60,
                ],
                [
                    'corte_bobina_usage_id' => $usage->id,
                    'work_order_id' => $usage->work_order_id,
                    'quantity_kg' => 40,
                ],
            ],
        ], $h)->assertCreated();
    }

    public function test_cancelled_note_frees_corte_quantity(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $usage = $this->createCorteUsageWithFinished(20);

        $dn = DeliveryNote::query()->create([
            'code' => 'ND-X',
            'status' => DeliveryNoteStatus::Draft->value,
            'user_id' => $user->id,
        ]);
        DeliveryNoteLine::query()->create([
            'delivery_note_id' => $dn->id,
            'corte_bobina_usage_id' => $usage->id,
            'work_order_id' => $usage->work_order_id,
            'quantity_kg' => 20,
        ]);

        $rows = $this->getJson('/api/corte-dispatch/available', $h)->json('rows');
        $this->assertEmpty(collect($rows)->where('corte_bobina_usage_id', $usage->id));

        $dn->update(['status' => DeliveryNoteStatus::Cancelled->value]);

        $rows2 = $this->getJson('/api/corte-dispatch/available', $h)->json('rows');
        $this->assertNotEmpty(collect($rows2)->where('corte_bobina_usage_id', $usage->id));
    }
}
