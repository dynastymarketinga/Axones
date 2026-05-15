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
use App\Models\WorkOrderLine;
use App\Models\WorkOrderTechnicalDocument;
use App\Services\CortePlanillaDispatchSyncService;
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
        $uniq = (string) random_int(100000, 999999);
        $client = Client::query()->create([
            'name' => 'C-D-'.$uniq,
            'rif' => 'J-7'.$uniq,
        ]);
        $product = Product::query()->create(['client_id' => $client->id, 'name' => 'P-D', 'cpe' => 'CPE-D']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-D-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-D-'.uniqid(),
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
        $match = collect($rows)->firstWhere('work_order_id', $usage->work_order_id);
        $this->assertNotNull($match);
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
        $match2 = collect($rows2)->firstWhere('work_order_id', $usage->work_order_id);
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
        $this->assertEmpty(collect($rows)->where('work_order_id', $usage->work_order_id));

        $dn->update(['status' => DeliveryNoteStatus::Cancelled->value]);

        $rows2 = $this->getJson('/api/corte-dispatch/available', $h)->json('rows');
        $this->assertNotEmpty(collect($rows2)->where('work_order_id', $usage->work_order_id));
    }

    public function test_saving_corte_planilla_creates_dispatch_row_grouped_by_work_order(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['role' => 'corte'])->save();
        $h = $this->auth($user);

        $client = Client::query()->create([
            'name' => 'C-PLAN-'.uniqid(),
            'rif' => 'J-'.random_int(10000000, 99999999).'-'.random_int(0, 9),
        ]);
        $product = Product::query()->create(['client_id' => $client->id, 'name' => 'P-PLAN', 'cpe' => 'CPE-PLAN']);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PLAN-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'board_stage' => 'corte',
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-PLAN-'.uniqid(),
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        WorkOrderLine::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity' => 1,
        ]);

        $payload = [
            'form' => [
                'pedidoKg' => '100.000',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'superficie',
                'anchoCorteFinal' => '320±0',
                'pesoBobina' => '19-20',
                'metrosBobina' => '1020 ± 20',
                'distFotoceldaBorde' => '1±1',
                'distFiguraLadoContrario' => '20±1',
                'distFiguraLadoFotocelda' => '30±1',
                'diamBobina' => '400 ± 5',
                'anchoCore' => '460',
                'diamCorePlg' => '3',
                'cantCores' => '10',
                'maxEmpates' => '1',
                'ubicFotoceldaCorte' => 'Borde líder',
                'orientacionEmbalaje' => '1',
                'kgIngresadosCorte' => '100.00',
                'kgSalidaCorte' => '600.10',
                'kgMermaCorte' => '10.00',
                'metrajeCorte' => '1000',
            ],
        ];

        $this->putJson('/api/work-orders/'.$wo->id.'/orden-trabajo', $payload, $h)->assertOk();

        $rows = $this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows');
        $match = collect($rows)->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($match);
        $this->assertEquals('600.100', $match['quantity_finished_kg']);
        $this->assertEquals('600.100', $match['quantity_remaining_kg']);
    }

    public function test_store_from_multiple_work_orders_is_listed_in_delivery_history(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $usageA = $this->createCorteUsageWithFinished(12);
        $usageB = $this->createCorteUsageWithFinished(15);

        $created = $this->postJson('/api/delivery-notes', [
            'work_order_id' => null,
            'lines' => [
                [
                    'corte_bobina_usage_id' => $usageA->id,
                    'work_order_id' => $usageA->work_order_id,
                    'product_id' => $usageA->workOrder?->product_id,
                    'quantity_kg' => 5,
                    'pallet_code' => 'PAL-A',
                    'bobbin_count' => 1,
                ],
                [
                    'corte_bobina_usage_id' => $usageB->id,
                    'work_order_id' => $usageB->work_order_id,
                    'product_id' => $usageB->workOrder?->product_id,
                    'quantity_kg' => 4,
                    'pallet_code' => 'PAL-B',
                    'bobbin_count' => 1,
                ],
            ],
        ], $h)->assertCreated();

        $noteId = $created->json('id');
        $this->assertNotNull($noteId);

        $history = $this->getJson('/api/delivery-notes', $h)->assertOk()->json('data');
        $match = collect($history)->firstWhere('id', $noteId);
        $this->assertNotNull($match);
        $this->assertCount(2, $match['lines'] ?? []);
    }

    public function test_available_lists_ot_from_paletas_in_technical_document_without_prior_usage(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $uniq = (string) random_int(100000, 999999);
        $client = Client::query()->create([
            'name' => 'C-PAL-'.$uniq,
            'rif' => 'J-8'.$uniq,
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P-PAL',
            'cpe' => 'CPE-PAL',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PAL-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-PAL-'.uniqid(),
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        WorkOrderLine::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity' => 1,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'cor_paletas' => [
                    [
                        'id' => 'p-01',
                        'rollosKg' => ['10.500', '20.000'],
                    ],
                ],
            ],
        ]);

        $this->assertDatabaseMissing('corte_bobina_usages', [
            'work_order_id' => $wo->id,
        ]);

        $rows = $this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows');
        $match = collect($rows)->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($match);
        $this->assertEquals('30.500', $match['quantity_finished_kg']);
        $this->assertEquals('30.500', $match['quantity_remaining_kg']);

        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'quantity_finished_kg' => '30.500',
            'notes' => CortePlanillaDispatchSyncService::PLANILLA_NOTES,
        ]);
    }

    public function test_available_lists_ot_from_paletas_using_material_from_existing_usage_when_line_missing(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $uniq = (string) random_int(100000, 999999);
        $client = Client::query()->create([
            'name' => 'C-PAL2-'.$uniq,
            'rif' => 'J-9'.$uniq,
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P-PAL2',
            'cpe' => 'CPE-PAL2',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PAL2-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-PAL2-'.uniqid(),
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        CorteBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_used_kg' => 0,
            'quantity_finished_kg' => 0,
            'notes' => 'manual',
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'cor_paletas' => [
                    [
                        'id' => 'p-01',
                        'rollosKg' => ['15.250'],
                    ],
                ],
            ],
        ]);

        $rows = $this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows');
        $match = collect($rows)->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($match);
        $this->assertEquals('15.250', $match['quantity_remaining_kg']);

        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'quantity_finished_kg' => '15.250',
            'notes' => CortePlanillaDispatchSyncService::PLANILLA_NOTES,
        ]);
    }
}
