<?php

namespace Tests\Feature;

use App\Enums\PurchaseOrderStatus;
use App\Models\Material;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MasterDataAndPurchaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_receipt_updates_stock_and_po_status(): void
    {
        $user = User::factory()->create();
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

    public function test_receipt_without_purchase_order_requires_supplier_id(): void
    {
        $user = User::factory()->create();
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

        $this->postJson('/api/purchase-receipts', [
            'without_purchase_order' => true,
            'lines' => [
                ['material_id' => $material->id, 'item_type' => 'quimico', 'quantity' => 5, 'unit' => 'kg'],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertUnprocessable();

        $ok = $this->postJson('/api/purchase-receipts', [
            'without_purchase_order' => true,
            'supplier_id' => $supplier->id,
            'exception_reason' => 'Stock de seguridad sin OC',
            'lines' => [
                ['material_id' => $material->id, 'item_type' => 'quimico', 'quantity' => 5, 'unit' => 'kg'],
            ],
        ], ['Authorization' => 'Bearer '.$token]);

        $ok->assertCreated();
        $material->refresh();
        $this->assertEquals('5.000', (string) $material->quantity_on_hand);
    }
}
