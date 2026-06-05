<?php

namespace Tests\Feature;

use App\Enums\OperationalAlertType;
use App\Enums\PurchaseOrderStatus;
use App\Models\Material;
use App\Models\OperationalAlert;
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

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => OperationalAlertType::PurchaseOrderPendingReceipt->value,
            'metadata->purchase_order_id' => $poResponse->json('id'),
        ]);

        $pendingCount = $this->getJson('/api/purchase-orders/pending-receipt-count', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();
        $this->assertGreaterThanOrEqual(1, (int) $pendingCount->json('count'));

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

        $index = $this->getJson('/api/purchase-orders?has_receipts=true&per_page=100', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $row = collect($index->json('data'))->firstWhere('id', $po->id);
        $this->assertNotNull($row);
        $this->assertSame('40,000 / 100,000 kg', $row['receipt_progress_label']);
        $this->assertArrayNotHasKey('lines', $row);

        $pendingIndex = $this->getJson('/api/purchase-orders?has_receipts=false&per_page=100', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();
        $this->assertFalse(
            collect($pendingIndex->json('data'))->contains('id', $po->id),
        );

        $alert = OperationalAlert::query()
            ->where('alert_type', OperationalAlertType::PurchaseOrderPendingReceipt->value)
            ->where('metadata->purchase_order_id', $po->id)
            ->first();
        $this->assertNotNull($alert);
        $this->assertNotNull($alert->acknowledged_at);

        $pendingCountAfter = $this->getJson('/api/purchase-orders/pending-receipt-count', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();
        $this->assertLessThan(
            (int) $pendingCount->json('count'),
            (int) $pendingCountAfter->json('count'),
        );
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

    public function test_purchase_order_index_filters_by_has_receipts(): void
    {
        $user = User::factory()->create(['role' => 'inventory_chief']);
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $supplier = Supplier::query()->create([
            'name' => 'Prov filtros',
            'rif' => 'J-FILT',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-FILT',
            'name' => 'Material filtros',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $pendingPo = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-PENDING-FILT',
            'lines' => [
                [
                    'description' => 'Sin recepcion',
                    'material_id' => $material->id,
                    'quantity_ordered' => 50,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], $headers);
        $pendingPo->assertCreated();

        $receivedPo = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-RECEIVED-FILT',
            'lines' => [
                [
                    'description' => 'Con recepcion',
                    'material_id' => $material->id,
                    'quantity_ordered' => 80,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], $headers);
        $receivedPo->assertCreated();
        $receivedPoId = $receivedPo->json('id');
        $receivedLineId = $receivedPo->json('lines.0.id');

        $this->postJson('/api/purchase-receipts', [
            'purchase_order_id' => $receivedPoId,
            'supplier_id' => $supplier->id,
            'invoice_number' => 'FAC-FILT-1',
            'lines' => [
                [
                    'purchase_order_line_id' => $receivedLineId,
                    'material_id' => $material->id,
                    'item_type' => 'sustrato',
                    'quantity' => 10,
                    'unit' => 'kg',
                    'micras' => 20,
                    'ancho_mm' => 1200,
                ],
            ],
        ], $headers)->assertCreated();

        $pendingIndex = $this->getJson('/api/purchase-orders?has_receipts=false&per_page=100', $headers);
        $pendingIndex->assertOk();
        $pendingCodes = collect($pendingIndex->json('data'))->pluck('code')->all();
        $this->assertContains('OC-PENDING-FILT', $pendingCodes);
        $this->assertNotContains('OC-RECEIVED-FILT', $pendingCodes);

        $historyIndex = $this->getJson('/api/purchase-orders?has_receipts=true&per_page=100', $headers);
        $historyIndex->assertOk();
        $historyCodes = collect($historyIndex->json('data'))->pluck('code')->all();
        $this->assertContains('OC-RECEIVED-FILT', $historyCodes);
        $this->assertNotContains('OC-PENDING-FILT', $historyCodes);

        $receivedRow = collect($historyIndex->json('data'))->firstWhere('code', 'OC-RECEIVED-FILT');
        $this->assertSame(1, (int) ($receivedRow['receipts_count'] ?? 0));
        $this->assertNotEmpty($receivedRow['last_receipt_at'] ?? null);
    }

    public function test_receipt_rejects_closed_purchase_order_without_full_lines(): void
    {
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

        PurchaseOrder::query()->whereKey($poId)->update([
            'status' => PurchaseOrderStatus::Completed->value,
        ]);

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
            'deactivation_reason' => 'OC duplicada por error de captura; ya no se usar?.',
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
            'notes' => 'Actualizacion de cabecera.',
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors(['change_reason']);

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'notes' => 'Actualizacion de cabecera.',
            'change_reason' => 'Correccion solicitada por compras.',
        ], $headers)->assertOk()->assertJsonPath('notes', 'Actualizacion de cabecera.');
    }

    public function test_purchase_order_patch_lines_requires_change_reason_and_updates(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $supplier = Supplier::query()->create([
            'name' => 'Prov lines',
            'rif' => 'J-445',
        ]);

        $material = Material::query()->create([
            'sku' => 'MAT-LINE',
            'name' => 'Mat line',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $poResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-LINE-1',
            'lines' => [
                [
                    'description' => 'Sustrato | Tipo: sustrato',
                    'material_id' => $material->id,
                    'quantity_ordered' => 5,
                    'unit' => 'kg',
                    'unit_price' => 0,
                ],
            ],
        ], $headers);

        $poResponse->assertCreated();
        $poId = $poResponse->json('id');
        $lineId = $poResponse->json('lines.0.id');

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'lines' => [
                [
                    'id' => $lineId,
                    'description' => 'Sustrato editado | Tipo: sustrato',
                    'material_id' => $material->id,
                    'quantity_ordered' => 8,
                    'unit' => 'kg',
                ],
            ],
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors(['change_reason']);

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'change_reason' => 'Ajuste de cantidad solicitado por compras.',
            'lines' => [
                [
                    'id' => $lineId,
                    'description' => 'Sustrato editado | Tipo: sustrato',
                    'material_id' => $material->id,
                    'quantity_ordered' => 8,
                    'unit' => 'kg',
                ],
            ],
        ], $headers)->assertOk();

        $this->assertDatabaseHas('purchase_order_lines', [
            'id' => $lineId,
            'quantity_ordered' => '8.000',
        ]);
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
            'change_reason' => 'Reactivacion autorizada por jefatura tras revision.',
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
                'change_reason' => 'Reactivacion autorizada por jefatura tras revision.',
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
            'deactivation_reason' => 'Se desactiva por prueba de bloqueo de edicion en inactiva.',
        ], $headers)->assertOk();

        $this->patchJson('/api/purchase-orders/'.$poId, [
            'notes' => 'Intento de nota mientras inactiva.',
            'change_reason' => 'Motivo de cambio con m?s de cinco caracteres.',
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
            'change_reason' => 'Proveedor exonerado de IVA segun contrato vigente.',
        ], $headers)->assertOk()->assertJsonPath('tax_applies', false);
    }

    public function test_purchase_order_store_validation_rules(): void
    {
        $user = User::factory()->create(['role' => 'inventory_chief']);
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $supplier = Supplier::query()->create([
            'name' => 'Prov validacion OC',
            'rif' => 'J-VALID-OC',
        ]);

        $this->postJson('/api/purchase-orders', [], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_id', 'code', 'lines']);

        $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-VALID-1',
            'lines' => [
                ['quantity_ordered' => 0, 'unit' => 'kg'],
            ],
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lines.0.quantity_ordered']);

        $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-VALID-1',
            'lines' => [
                ['description' => 'Pedido minimo', 'quantity_ordered' => 0.001, 'unit' => 'kg'],
            ],
        ], $headers)->assertCreated();

        $duplicateResponse = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'code' => 'OC-VALID-1',
            'lines' => [
                ['description' => 'Duplicado', 'quantity_ordered' => 1, 'unit' => 'kg'],
            ],
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);

        $duplicateMsg = (string) $duplicateResponse->json('errors.code.0');
        $this->assertStringContainsString('registrado', $duplicateMsg);
        $this->assertStringNotContainsString('already been taken', strtolower($duplicateMsg));
    }
}
