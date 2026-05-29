<?php

namespace Tests\Feature;

use App\Enums\PurchaseOrderStatus;
use App\Models\Material;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use App\Support\BossAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MasterDataAndPurchaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_receipt_updates_stock_and_po_status(): void
    {
        $user = User::factory()->create(['role' => 'inventory_chief']);
        $token = $user->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Prov test',
            'rif' => 'J-123',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-001',
            'name' => 'Bobina test',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-TEST-1',
            'lines' => [
                [
                    'description' => 'Pedido 1',
                    'material_id' => $material->id,
                    'quantity_ordered' => 100,
                    'unit' => 'kg',
                    'unit_price' => 1.25,
                ],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $poResponse->assertCreated();
        $lineId = $poResponse->json('lines.0.id');

        $recResponse = $this->postJson('/api/purchase-receipts', [
            'purchase_order_id' => $poResponse->json('id'),
            'supplier_id' => $supplier->id,
            'lines' => [
                [
                    'purchase_order_line_id' => $lineId,
                    'material_id' => $material->id,
                    'item_type' => 'sustrato',
                    'quantity' => 40,
                    'unit' => 'kg',
                    'micras' => 20,
                    'ancho_mm' => 1200,
                ],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $recResponse->assertCreated();

        $material->refresh();
        $this->assertEquals('40.000', (string) $material->quantity_on_hand);

        $po = PurchaseOrder::query()->find($poResponse->json('id'));
        $this->assertEquals(PurchaseOrderStatus::Partial->value, $po->status);
        $this->assertEquals('40.000', (string) $po->lines->first()->quantity_received);
    }

    public function test_receipt_without_purchase_order_updates_stock(): void
    {
        $user = User::factory()->create(['role' => 'inventory_chief']);
        $token = $user->createToken('t')->plainTextToken;
        $supplier = Supplier::query()->create([
            'name' => 'Proveedor libre',
            'rif' => 'J-456',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-002',
            'name' => 'Extra',
            'inventory_area' => 'quimicos',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $recResponse = $this->postJson('/api/purchase-receipts', [
            'supplier_id' => $supplier->id,
            'without_purchase_order' => true,
            'invoice_number' => 'FAC-001',
            'lines' => [
                ['material_id' => $material->id, 'item_type' => 'quimico', 'quantity' => 5, 'unit' => 'kg'],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $recResponse->assertCreated();
        $recResponse->assertJsonPath('without_purchase_order', true);

        $material->refresh();
        $this->assertEquals('5.000', (string) $material->quantity_on_hand);

        $this->postJson('/api/purchase-receipts', [
            'supplier_id' => $supplier->id,
            'lines' => [
                ['material_id' => $material->id, 'item_type' => 'quimico', 'quantity' => 5, 'unit' => 'kg'],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertUnprocessable();
    }

    public function test_receipt_with_purchase_order_rejects_quantity_over_pending(): void
    {
        $user = User::factory()->create(['role' => 'inventory_chief']);
        $token = $user->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Prov tope',
            'rif' => 'J-TOPE',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-TOPE',
            'name' => 'Material tope',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-TOPE-1',
            'lines' => [
                [
                    'description' => 'Pedido tope',
                    'material_id' => $material->id,
                    'quantity_ordered' => 100,
                    'unit' => 'kg',
                    'unit_price' => 1,
                ],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $poResponse->assertCreated();
        $poId = $poResponse->json('id');
        $lineId = $poResponse->json('lines.0.id');

        $this->postJson('/api/purchase-receipts', [
            'purchase_order_id' => $poId,
            'supplier_id' => $supplier->id,
            'lines' => [
                [
                    'purchase_order_line_id' => $lineId,
                    'material_id' => $material->id,
                    'item_type' => 'sustrato',
                    'quantity' => 150,
                    'unit' => 'kg',
                    'micras' => 20,
                    'ancho_mm' => 1200,
                ],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertUnprocessable();

        $okResponse = $this->postJson('/api/purchase-receipts', [
            'purchase_order_id' => $poId,
            'supplier_id' => $supplier->id,
            'lines' => [
                [
                    'purchase_order_line_id' => $lineId,
                    'material_id' => $material->id,
                    'item_type' => 'sustrato',
                    'quantity' => 40,
                    'unit' => 'kg',
                    'micras' => 20,
                    'ancho_mm' => 1200,
                ],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $okResponse->assertCreated();
        $material->refresh();
        $this->assertEquals('40.000', (string) $material->quantity_on_hand);
    }

    public function test_receipt_rejects_closed_purchase_order_without_full_lines(): void
    {
        $boss = User::factory()->create(['role' => 'boss']);

        $inventoryUser = User::factory()->create(['role' => 'inventory_chief']);
        $inventoryToken = $inventoryUser->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Prov cerrado',
            'rif' => 'J-789',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-CLOSE',
            'name' => 'Material cerrado',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-CLOSE-1',
            'lines' => [
                [
                    'description' => 'Pendiente',
                    'material_id' => $material->id,
                    'quantity_ordered' => 50,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], ['Authorization' => 'Bearer '.$inventoryToken]);

        $poResponse->assertCreated();
        $poId = $poResponse->json('id');
        $lineId = $poResponse->json('lines.0.id');

        $this->actingAs($boss, 'sanctum')
            ->postJson('/api/purchase-orders/'.$poId.'/manual-close', [
                'reason' => 'Proveedor desistió, cerrar sin recibir nada.',
            ])
            ->assertOk()
            ->assertJsonPath('status', PurchaseOrderStatus::Completed->value);

        $this->actingAs($inventoryUser, 'sanctum')
            ->postJson('/api/purchase-receipts', [
                'purchase_order_id' => $poId,
                'supplier_id' => $supplier->id,
                'lines' => [
                    [
                        'purchase_order_line_id' => $lineId,
                        'material_id' => $material->id,
                        'item_type' => 'sustrato',
                        'quantity' => 10,
                        'unit' => 'kg',
                        'micras' => 20,
                        'ancho_mm' => 1200,
                    ],
                ],
            ])
            ->assertUnprocessable();
    }

    public function test_purchase_order_deactivate_requires_reason_and_hides_from_index(): void
    {
        $user = User::factory()->create(['role' => 'inventory_chief']);
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $supplier = Supplier::query()->create([
            'name' => 'Prov deactivate',
            'rif' => 'J-333',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-OFF',
            'name' => 'Mat off',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-OFF-1',
            'lines' => [
                [
                    'description' => 'L1',
                    'material_id' => $material->id,
                    'quantity_ordered' => 10,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], $headers);

        $poResponse->assertCreated();
        $poId = $poResponse->json('id');
        $lineId = $poResponse->json('lines.0.id');

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'is_active' => false,
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors(['deactivation_reason']);

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'is_active' => false,
            'deactivation_reason' => 'OC duplicada por error de captura; ya no se usará.',
        ], $headers)->assertOk();

        $this->assertDatabaseHas('purchase_orders', [
            'id' => $poId,
            'is_active' => false,
        ]);

        $index = $this->getJson('/api/purchase-orders', $headers)->assertOk()->json('data');
        $this->assertEmpty(collect($index)->where('id', $poId)->all());

        $this->postJson('/api/purchase-receipts', [
            'purchase_order_id' => $poId,
            'supplier_id' => $supplier->id,
            'lines' => [
                [
                    'purchase_order_line_id' => $lineId,
                    'material_id' => $material->id,
                    'item_type' => 'sustrato',
                    'quantity' => 2,
                    'unit' => 'kg',
                    'micras' => 20,
                    'ancho_mm' => 1200,
                ],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertUnprocessable()->assertJsonValidationErrors(['purchase_order_id']);
    }

    public function test_purchase_order_patch_notes_requires_change_reason(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $supplier = Supplier::query()->create([
            'name' => 'Prov notes',
            'rif' => 'J-444',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-NOTE',
            'name' => 'Mat note',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-NOTE-1',
            'lines' => [
                [
                    'description' => 'L1',
                    'material_id' => $material->id,
                    'quantity_ordered' => 5,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], $headers);

        $poResponse->assertCreated();
        $poId = $poResponse->json('id');

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'notes' => 'Actualización de cabecera.',
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors(['change_reason']);

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'notes' => 'Actualización de cabecera.',
            'change_reason' => 'Corrección solicitada por compras.',
        ], $headers)->assertOk()->assertJsonPath('notes', 'Actualización de cabecera.');
    }

    public function test_purchase_order_index_visibility_only_boss_sees_inactive(): void
    {
        $inventory = User::factory()->create(['role' => 'inventory_chief']);
        $invToken = $inventory->createToken('t')->plainTextToken;
        $invHeaders = ['Authorization' => 'Bearer '.$invToken];

        $boss = User::factory()->create(['role' => 'boss']);

        $supplier = Supplier::query()->create([
            'name' => 'Prov vis',
            'rif' => 'J-777',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-VIS',
            'name' => 'Mat vis',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-VIS-1',
            'lines' => [
                [
                    'description' => 'L1',
                    'material_id' => $material->id,
                    'quantity_ordered' => 3,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], $invHeaders);

        $poResponse->assertCreated();
        $poId = $poResponse->json('id');

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'is_active' => false,
            'deactivation_reason' => 'OC creada por duplicado; se desactiva la copia sobrante.',
        ], $invHeaders)->assertOk();

        $this->assertTrue(BossAccess::allows($boss->fresh()));
        $this->assertDatabaseHas('purchase_orders', [
            'id' => $poId,
            'is_active' => false,
        ]);

        $nonBossAll = collect(
            $this->getJson('/api/purchase-orders?visibility=all', $invHeaders)->assertOk()->json('data'),
        )->pluck('id')->all();
        $this->assertNotContains($poId, $nonBossAll);

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'is_active' => true,
            'change_reason' => 'Reactivación autorizada por jefatura tras revisión.',
        ], $invHeaders)->assertForbidden();

        $inactiveForBoss = collect(
            $this->actingAs($boss, 'sanctum')
                ->getJson('/api/purchase-orders?visibility=inactive')
                ->assertOk()
                ->json('data'),
        )->pluck('id')->all();
        $this->assertContains($poId, $inactiveForBoss);

        $this->actingAs($boss, 'sanctum')
            ->patchJson('/api/purchase-orders/'.$poId, [
                'is_active' => true,
                'change_reason' => 'Reactivación autorizada por jefatura tras revisión.',
            ])
            ->assertOk()
            ->assertJsonPath('is_active', true);

        $this->assertDatabaseHas('purchase_orders', [
            'id' => $poId,
            'is_active' => true,
            'deactivated_at' => null,
        ]);
    }

    public function test_purchase_order_inactive_cannot_patch_notes_until_reactivated(): void
    {
        $user = User::factory()->create(['role' => 'inventory_chief']);
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $supplier = Supplier::query()->create([
            'name' => 'Prov lock',
            'rif' => 'J-888',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-LOCK',
            'name' => 'Mat lock',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-LOCK-1',
            'lines' => [
                [
                    'description' => 'L1',
                    'material_id' => $material->id,
                    'quantity_ordered' => 2,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], $headers);

        $poId = $poResponse->json('id');

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'is_active' => false,
            'deactivation_reason' => 'Se desactiva por prueba de bloqueo de edición en inactiva.',
        ], $headers)->assertOk();

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'notes' => 'Intento de nota mientras inactiva.',
            'change_reason' => 'Motivo de cambio con más de cinco caracteres.',
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors(['is_active']);
    }

    public function test_purchase_order_patch_tax_applies_requires_change_reason(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $supplier = Supplier::query()->create([
            'name' => 'Prov tax',
            'rif' => 'J-999',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-TAX',
            'name' => 'Mat tax',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-TAX-1',
            'lines' => [
                [
                    'description' => 'L1',
                    'material_id' => $material->id,
                    'quantity_ordered' => 1,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], $headers);

        $poId = $poResponse->json('id');

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'tax_applies' => false,
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors(['change_reason']);

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'tax_applies' => false,
            'change_reason' => 'Proveedor exonerado de IVA según contrato vigente.',
        ], $headers)->assertOk()->assertJsonPath('tax_applies', false);
    }
}
