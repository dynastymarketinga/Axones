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
                'cor_paletas' => [
                    [
                        'id' => 'p-plan',
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
                        'rollosKg' => array_merge(['600.100'], array_fill(0, 47, '0')),
                    ],
                ],
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
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
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
            'notes' => CortePlanillaDispatchSyncService::paletaNotes('p-01'),
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
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
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
            'notes' => CortePlanillaDispatchSyncService::paletaNotes('p-01'),
        ]);
    }

    public function test_open_paleta_kg_appears_as_provisional_until_closed(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $uniq = (string) random_int(100000, 999999);
        $client = Client::query()->create([
            'name' => 'C-OPEN-'.$uniq,
            'rif' => 'J-OPEN'.$uniq,
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P-OPEN',
            'cpe' => 'CPE-OPEN',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-OPEN-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-OPEN-'.uniqid(),
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
                        'label' => 'Paleta #01',
                        'status' => 'en_progreso',
                        'rollosKg' => ['25.000'],
                    ],
                ],
            ],
        ]);

        $rows = $this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows');
        $openMatch = collect($rows)->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($openMatch);
        $this->assertTrue($openMatch['is_provisional']);
        $this->assertEquals('25.000', $openMatch['quantity_remaining_kg']);

        $doc = WorkOrderTechnicalDocument::query()->where('work_order_id', $wo->id)->first();
        $form = is_array($doc->form) ? $doc->form : [];
        $form['cor_paletas'][0]['status'] = 'cerrada';
        $doc->update(['form' => $form]);

        $rows2 = $this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows');
        $match = collect($rows2)->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($match);
        $this->assertFalse($match['is_provisional']);
        $this->assertEquals('25.000', $match['quantity_remaining_kg']);
    }

    public function test_patch_corte_control_with_two_closed_paletas_creates_two_dispatch_rows(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $uniq = (string) random_int(100000, 999999);
        $client = Client::query()->create([
            'name' => 'C-2PAL-'.$uniq,
            'rif' => 'J-2P'.$uniq,
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P-2PAL',
            'cpe' => 'CPE-2PAL',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-2PAL-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-2PAL-'.uniqid(),
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

        $rollosA = array_merge(['10.500'], array_fill(0, 47, '0'));
        $rollosB = array_merge(['20.250'], array_fill(0, 47, '0'));

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [
                    [
                        'id' => 'p-01',
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
                        'rollosKg' => $rollosA,
                    ],
                    [
                        'id' => 'p-02',
                        'label' => 'Paleta #02',
                        'status' => 'cerrada',
                        'rollosKg' => $rollosB,
                    ],
                ],
            ],
        ], $h)
            ->assertOk()
            ->assertJsonPath('dispatch_sync.material_resolved', true)
            ->assertJsonPath('dispatch_sync.closed_paletas_with_kg', 2)
            ->assertJsonPath('dispatch_sync.usages_synced', 2);

        $rows = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->where('work_order_id', $wo->id)
            ->values();

        $this->assertCount(2, $rows);
        $this->assertNotNull($rows->firstWhere('paleta_id', 'p-01'));
        $this->assertNotNull($rows->firstWhere('paleta_id', 'p-02'));
        $this->assertNotNull($rows->firstWhere('corte_bobina_usage_id'));

        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'notes' => CortePlanillaDispatchSyncService::paletaNotes('p-01'),
            'quantity_finished_kg' => '10.500',
        ]);
        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'notes' => CortePlanillaDispatchSyncService::paletaNotes('p-02'),
            'quantity_finished_kg' => '20.250',
        ]);
    }

    /**
     * @return array{user: User, h: array<string, string>, wo: WorkOrder}
     */
    private function createCorteWoWithMaterialLine(): array
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $uniq = (string) random_int(100000, 999999);
        $client = Client::query()->create([
            'name' => 'C-PROV-'.$uniq,
            'rif' => 'J-P'.$uniq,
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P-PROV',
            'cpe' => 'CPE-PROV',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PROV-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-PROV-'.uniqid(),
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

        return ['user' => $user, 'h' => $h, 'wo' => $wo];
    }

    public function test_open_paleta_with_kg_syncs_provisional_dispatch_row(): void
    {
        ['h' => $h, 'wo' => $wo] = $this->createCorteWoWithMaterialLine();
        $rollos = array_merge(['15.500'], array_fill(0, 47, '0'));

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [
                    [
                        'id' => 'p-open',
                        'label' => 'Paleta #01',
                        'status' => 'en_progreso',
                        'rollosKg' => $rollos,
                    ],
                ],
            ],
        ], $h)
            ->assertOk()
            ->assertJsonPath('dispatch_sync.provisional_paletas_with_kg', 1)
            ->assertJsonPath('dispatch_sync.provisional_synced', 1);

        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'notes' => CortePlanillaDispatchSyncService::paletaProvisionalNotes('p-open'),
            'quantity_finished_kg' => '15.500',
        ]);

        $rows = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->where('work_order_id', $wo->id);
        $this->assertCount(1, $rows);
        $row = $rows->first();
        $this->assertTrue($row['is_provisional']);
        $this->assertEquals('15.500', $row['quantity_remaining_kg']);
    }

    public function test_closed_paleta_in_cor_turnos_syncs_definitive_dispatch_after_turn_close(): void
    {
        ['h' => $h, 'wo' => $wo] = $this->createCorteWoWithMaterialLine();
        $rollos = array_merge(['22.000'], array_fill(0, 47, '0'));

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_turnos' => [[
                    'id' => 'turn-1',
                    'closed_at' => '2026-06-05T12:00:00Z',
                    'turno' => 'nocturno',
                    'grupo' => 'A',
                    'operador' => 'Op',
                    'paletas' => [[
                        'id' => 'p-turn',
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
                        'rollosKg' => $rollos,
                    ]],
                ]],
                'cor_paletas' => [[
                    'id' => 'p-turn',
                    'label' => 'Paleta #01',
                    'status' => 'cerrada',
                    'rollosKg' => $rollos,
                ], [
                    'id' => 'p-02',
                    'label' => 'Paleta #02',
                    'status' => 'en_progreso',
                    'rollosKg' => array_fill(0, 48, '0'),
                ]],
            ],
        ], $h)
            ->assertOk()
            ->assertJsonPath('dispatch_sync.closed_paletas_with_kg', 1)
            ->assertJsonPath('dispatch_sync.usages_synced', 1);

        $rows = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->where('work_order_id', $wo->id);
        $this->assertCount(1, $rows);
        $row = $rows->first();
        $this->assertFalse($row['is_provisional']);
        $this->assertEquals('22.000', $row['quantity_remaining_kg']);
    }

    public function test_closing_paleta_promotes_provisional_to_definitive_usage(): void
    {
        ['h' => $h, 'wo' => $wo] = $this->createCorteWoWithMaterialLine();
        $rollos = array_merge(['8.250'], array_fill(0, 47, '0'));

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [
                    [
                        'id' => 'p-close',
                        'label' => 'Paleta #01',
                        'status' => 'en_progreso',
                        'rollosKg' => $rollos,
                    ],
                ],
            ],
        ], $h)->assertOk();

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [
                    [
                        'id' => 'p-close',
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
                        'rollosKg' => $rollos,
                    ],
                ],
            ],
        ], $h)
            ->assertOk()
            ->assertJsonPath('dispatch_sync.closed_paletas_with_kg', 1)
            ->assertJsonPath('dispatch_sync.usages_synced', 1);

        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'notes' => CortePlanillaDispatchSyncService::paletaNotes('p-close'),
            'quantity_finished_kg' => '8.250',
        ]);
        $this->assertDatabaseMissing('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'notes' => CortePlanillaDispatchSyncService::paletaProvisionalNotes('p-close'),
        ]);

        $rows = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->where('work_order_id', $wo->id);
        $this->assertCount(1, $rows);
        $this->assertFalse($rows->first()['is_provisional']);
    }

    public function test_closed_paleta_without_work_order_line_syncs_via_product_material(): void
    {
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $uniq = (string) random_int(100000, 999999);
        $client = Client::query()->create([
            'name' => 'C-NOMAT-'.$uniq,
            'rif' => 'J-N'.$uniq,
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P-NOMAT',
            'cpe' => 'CPE-NOMAT',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-NOMAT-'.uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $rollos = array_merge(['12.000'], array_fill(0, 47, '0'));

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [
                    [
                        'id' => 'p-nomat',
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
                        'rollosKg' => $rollos,
                    ],
                ],
            ],
        ], $h)
            ->assertOk()
            ->assertJsonPath('dispatch_sync.material_resolved', true)
            ->assertJsonPath('dispatch_sync.closed_paletas_with_kg', 1)
            ->assertJsonPath('dispatch_sync.usages_synced', 1);

        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'notes' => CortePlanillaDispatchSyncService::paletaNotes('p-nomat'),
            'quantity_finished_kg' => '12.000',
        ]);
        $this->assertDatabaseHas('work_order_lines', [
            'work_order_id' => $wo->id,
        ]);
        $this->assertDatabaseHas('materials', [
            'sku' => 'PT-CPE-NOMAT',
        ]);
    }

    public function test_closed_paleta_without_product_does_not_sync_dispatch(): void
    {
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-NOPROD-'.uniqid(),
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $rollos = array_merge(['5.000'], array_fill(0, 47, '0'));

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [
                    [
                        'id' => 'p-noprod',
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
                        'rollosKg' => $rollos,
                    ],
                ],
            ],
        ], $h)
            ->assertOk()
            ->assertJsonPath('dispatch_sync.material_resolved', false)
            ->assertJsonPath('dispatch_sync.closed_paletas_with_kg', 1)
            ->assertJsonPath('dispatch_sync.usages_synced', 0);

        $this->assertDatabaseMissing('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'notes' => CortePlanillaDispatchSyncService::paletaNotes('p-noprod'),
        ]);
    }

    public function test_open_paleta_kg_accumulates_on_same_dispatch_row_while_in_production(): void
    {
        ['h' => $h, 'wo' => $wo] = $this->createCorteWoWithMaterialLine();
        $rollos25 = array_merge(['10', '10', '5'], array_fill(0, 45, '0'));
        $rollos40 = array_merge(['10', '10', '20'], array_fill(0, 45, '0'));

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [[
                    'id' => 'p-01',
                    'label' => 'Paleta #01',
                    'status' => 'en_progreso',
                    'rollosKg' => $rollos25,
                ]],
            ],
        ], $h)->assertOk();

        $row1 = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->firstWhere('paleta_id', 'p-01');
        $this->assertNotNull($row1);
        $this->assertTrue($row1['is_provisional']);
        $this->assertEquals('25.000', $row1['quantity_remaining_kg']);
        $this->assertEquals(3, $row1['rollos_count']);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [[
                    'id' => 'p-01',
                    'label' => 'Paleta #01',
                    'status' => 'en_progreso',
                    'rollosKg' => $rollos40,
                ]],
            ],
        ], $h)->assertOk();

        $row2 = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->firstWhere('paleta_id', 'p-01');
        $this->assertNotNull($row2);
        $this->assertEquals('40.000', $row2['quantity_remaining_kg']);
        $this->assertEquals(3, $row2['rollos_count']);
    }

    public function test_closed_paleta_accumulates_kg_on_same_row_from_turno_merge(): void
    {
        ['h' => $h, 'wo' => $wo] = $this->createCorteWoWithMaterialLine();
        $rollos100 = array_merge(['40', '30', '30'], array_fill(0, 45, '0'));
        $rollos150 = array_merge(['40', '30', '30', '50'], array_fill(0, 44, '0'));

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [[
                    'id' => 'p-01',
                    'label' => 'Paleta #01',
                    'status' => 'cerrada',
                    'rollosKg' => $rollos100,
                ]],
            ],
        ], $h)->assertOk();

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [[
                    'id' => 'p-01',
                    'label' => 'Paleta #01',
                    'status' => 'cerrada',
                    'rollosKg' => $rollos100,
                ], [
                    'id' => 'p-02',
                    'label' => 'Paleta #02',
                    'status' => 'en_progreso',
                    'rollosKg' => array_fill(0, 48, '0'),
                ]],
                'corTurnoActual' => [
                    'id' => 'turn-live',
                    'turno' => 'diurno',
                    'grupo' => 'A',
                    'operador' => 'Op',
                    'paletas' => [[
                        'id' => 'p-01',
                        'label' => 'Paleta #01',
                        'status' => 'en_progreso',
                        'rollosKg' => $rollos150,
                    ]],
                    'timer' => ['state' => 'running', 'effectiveAccSec' => 10, 'deadAccSec' => 0],
                ],
            ],
        ], $h)->assertOk();

        $row = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->firstWhere('paleta_id', 'p-01');
        $this->assertNotNull($row);
        $this->assertEquals('150.000', $row['quantity_remaining_kg']);
        $this->assertEquals(4, $row['rollos_count']);
        $this->assertFalse($row['is_provisional']);

        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'notes' => CortePlanillaDispatchSyncService::paletaNotes('p-01'),
            'quantity_finished_kg' => '150.000',
        ]);
    }

    public function test_two_work_orders_same_paleta_label_isolated_dispatch_rows(): void
    {
        ['h' => $h, 'wo' => $woA] = $this->createCorteWoWithMaterialLine();
        ['wo' => $woB] = $this->createCorteWoWithMaterialLine();

        $rollos60 = array_merge(array_fill(0, 6, '10'), array_fill(0, 42, '0'));
        $rollos550 = array_merge(['100', '120', '130', '30', '40', '40', '30', '40', '20'], array_fill(0, 39, '0'));

        foreach ([
            [$woA, $rollos60, '60.000', 6],
            [$woB, $rollos550, '550.000', 9],
        ] as [$wo, $rollos, $expectedKg, $expectedRollos]) {
            $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
                'form' => [
                    'cor_paletas' => [[
                        'id' => 'p-01',
                        'label' => 'Paleta #01',
                        'status' => 'cerrada',
                        'rollosKg' => $rollos,
                    ]],
                ],
            ], $h)->assertOk();
        }

        $rows = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->whereIn('work_order_id', [$woA->id, $woB->id])
            ->values();

        $this->assertCount(2, $rows);

        $rowA = $rows->firstWhere('work_order_id', $woA->id);
        $rowB = $rows->firstWhere('work_order_id', $woB->id);
        $this->assertNotNull($rowA);
        $this->assertNotNull($rowB);
        $this->assertEquals('p-01', $rowA['paleta_id']);
        $this->assertEquals('p-01', $rowB['paleta_id']);
        $this->assertEquals('Paleta #01', $rowA['pallet_label']);
        $this->assertEquals('Paleta #01', $rowB['pallet_label']);
        $this->assertEquals('60.000', $rowA['quantity_remaining_kg']);
        $this->assertEquals('550.000', $rowB['quantity_remaining_kg']);
        $this->assertEquals(6, $rowA['rollos_count']);
        $this->assertEquals(9, $rowB['rollos_count']);
        $this->assertCount(6, $rowA['rollos_kg_filled']);
        $this->assertCount(9, $rowB['rollos_kg_filled']);
        $this->assertNotEquals($rowA['corte_bobina_usage_id'], $rowB['corte_bobina_usage_id']);
    }

    public function test_legacy_aggregate_row_hidden_when_paleta_rows_exist(): void
    {
        ['h' => $h, 'wo' => $wo] = $this->createCorteWoWithMaterialLine();
        $materialId = (int) (WorkOrderLine::query()->where('work_order_id', $wo->id)->value('material_id') ?? 0);
        $this->assertGreaterThan(0, $materialId);

        CorteBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $materialId,
            'quantity_used_kg' => 0,
            'quantity_finished_kg' => 610,
            'bobina_id' => null,
            'notes' => CortePlanillaDispatchSyncService::PLANILLA_NOTES,
        ]);

        $rollos = array_merge(['10', '20'], array_fill(0, 46, '0'));
        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_paletas' => [[
                    'id' => 'p-01',
                    'label' => 'Paleta #01',
                    'status' => 'cerrada',
                    'rollosKg' => $rollos,
                ]],
            ],
        ], $h)->assertOk();

        $rows = collect($this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows'))
            ->where('work_order_id', $wo->id)
            ->values();

        $this->assertCount(1, $rows);
        $this->assertEquals('p-01', $rows[0]['paleta_id']);
        $this->assertEquals('30.000', $rows[0]['quantity_remaining_kg']);
        $this->assertCount(2, $rows[0]['rollos_kg_filled']);
    }
}
