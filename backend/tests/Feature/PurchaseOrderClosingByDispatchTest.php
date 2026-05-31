<?php

namespace Tests\Feature;

use App\Enums\DeliveryNoteStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Bobina;
use App\Models\DeliveryNote;
use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\PrintingBobinaUsage;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\Supplier;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\PurchaseOrderClosingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Cubre los 5 escenarios críticos de la nueva regla:
 *  - Recepción completa NO marca Completada (queda Partial).
 *  - Nota de entrega en draft NO marca Completada.
 *  - markDispatched de la única OT consumidora -> Completada.
 *  - 2 OTs consumidoras y solo 1 despachada -> Partial.
 *
 * Trazabilidad usada: bobinas.id <- inventory_movements (reference_type=bobina,
 * metadata.purchase_order_id) y bobinas consumidas vía printing_bobina_usages.
 */
class PurchaseOrderClosingByDispatchTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_receipt_without_consumption_stays_partial(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $material = $this->createMaterial('MAT-FR');
        $po = $this->createPurchaseOrderWithLine($material, ordered: '100');
        $line = $po->lines()->first();

        $line->update(['quantity_received' => '100']);

        $service = app(PurchaseOrderClosingService::class);
        $service->recompute($po->refresh());

        $this->assertEquals(
            PurchaseOrderStatus::Partial->value,
            $po->fresh()->status,
            'Aunque se recibió todo, sin consumo en OT no debe marcarse Completada.',
        );
    }

    public function test_draft_delivery_note_does_not_close_purchase_order(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $material = $this->createMaterial('MAT-DD');
        $po = $this->createPurchaseOrderWithLine($material, ordered: '50');
        $line = $po->lines()->first();
        $line->update(['quantity_received' => '50']);

        $bobina = $this->createBobinaTraceableTo($po, $material, $user);
        $wo = $this->createWorkOrder($user, code: 'OT-DD-1');
        $this->consumeBobinaInWorkOrder($bobina, $wo, $material);

        DeliveryNote::query()->create([
            'sequential_number' => DeliveryNote::nextSequentialNumber(),
            'code' => DeliveryNote::nextCode(),
            'work_order_id' => $wo->id,
            'document_date' => now(),
            'status' => DeliveryNoteStatus::Draft->value,
            'user_id' => $user->id,
        ]);

        app(PurchaseOrderClosingService::class)->recompute($po->refresh());

        $this->assertEquals(
            PurchaseOrderStatus::Partial->value,
            $po->fresh()->status,
            'Una nota en draft no debe cerrar la OC.',
        );
    }

    public function test_dispatching_unique_consuming_work_order_closes_purchase_order(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $material = $this->createMaterial('MAT-OK');
        $po = $this->createPurchaseOrderWithLine($material, ordered: '60');
        $po->lines()->first()->update(['quantity_received' => '60']);

        $bobina = $this->createBobinaTraceableTo($po, $material, $user);
        $wo = $this->createWorkOrder($user, code: 'OT-OK-1');
        $this->consumeBobinaInWorkOrder($bobina, $wo, $material);

        $note = DeliveryNote::query()->create([
            'sequential_number' => DeliveryNote::nextSequentialNumber(),
            'code' => DeliveryNote::nextCode(),
            'work_order_id' => $wo->id,
            'document_date' => now(),
            'driver_name' => 'Conductor X',
            'vehicle_notes' => 'Camion T',
            'status' => DeliveryNoteStatus::Draft->value,
            'user_id' => $user->id,
        ]);

        app(PurchaseOrderClosingService::class)->recompute($po->refresh());
        $this->assertEquals(PurchaseOrderStatus::Partial->value, $po->fresh()->status);

        $this->postJson("/api/delivery-notes/{$note->id}/dispatch", [
            'driver_name' => 'Conductor X',
            'vehicle_notes' => 'Camion T',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('status', DeliveryNoteStatus::Dispatched->value);

        $this->assertEquals(
            PurchaseOrderStatus::Completed->value,
            $po->fresh()->status,
            'Despachar la única OT consumidora debe cerrar automáticamente la OC.',
        );
    }

    public function test_partial_dispatch_two_consuming_work_orders_keeps_partial(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $material = $this->createMaterial('MAT-2WO');
        $po = $this->createPurchaseOrderWithLine($material, ordered: '120');
        $po->lines()->first()->update(['quantity_received' => '120']);

        $bobinaA = $this->createBobinaTraceableTo($po, $material, $user);
        $bobinaB = $this->createBobinaTraceableTo($po, $material, $user);

        $woA = $this->createWorkOrder($user, code: 'OT-2WO-A');
        $woB = $this->createWorkOrder($user, code: 'OT-2WO-B');

        $this->consumeBobinaInWorkOrder($bobinaA, $woA, $material);
        $this->consumeBobinaInWorkOrder($bobinaB, $woB, $material);

        $noteA = DeliveryNote::query()->create([
            'sequential_number' => DeliveryNote::nextSequentialNumber(),
            'code' => DeliveryNote::nextCode(),
            'work_order_id' => $woA->id,
            'document_date' => now(),
            'driver_name' => 'X',
            'vehicle_notes' => 'Y',
            'status' => DeliveryNoteStatus::Draft->value,
            'user_id' => $user->id,
        ]);

        $this->postJson("/api/delivery-notes/{$noteA->id}/dispatch", [
            'driver_name' => 'X',
            'vehicle_notes' => 'Y',
        ], ['Authorization' => 'Bearer '.$token])->assertOk();

        $this->assertEquals(
            PurchaseOrderStatus::Partial->value,
            $po->fresh()->status,
            'Solo una de dos OTs despachadas: la OC debe seguir Partial.',
        );

        $noteB = DeliveryNote::query()->create([
            'sequential_number' => DeliveryNote::nextSequentialNumber(),
            'code' => DeliveryNote::nextCode(),
            'work_order_id' => $woB->id,
            'document_date' => now(),
            'driver_name' => 'X',
            'vehicle_notes' => 'Y',
            'status' => DeliveryNoteStatus::Draft->value,
            'user_id' => $user->id,
        ]);

        $this->postJson("/api/delivery-notes/{$noteB->id}/dispatch", [
            'driver_name' => 'X',
            'vehicle_notes' => 'Y',
        ], ['Authorization' => 'Bearer '.$token])->assertOk();

        $this->assertEquals(
            PurchaseOrderStatus::Completed->value,
            $po->fresh()->status,
            'Tras despachar la segunda OT, la OC debe quedar Completada.',
        );
    }

    public function test_consuming_work_orders_endpoint_lists_dispatch_state(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $material = $this->createMaterial('MAT-LIST');
        $po = $this->createPurchaseOrderWithLine($material, ordered: '80');
        $po->lines()->first()->update(['quantity_received' => '80']);

        $bobina = $this->createBobinaTraceableTo($po, $material, $user);
        $wo = $this->createWorkOrder($user, code: 'OT-LIST-1');
        $this->consumeBobinaInWorkOrder($bobina, $wo, $material);

        $this->getJson("/api/purchase-orders/{$po->id}/consuming-work-orders", [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('no_consumers', false)
            ->assertJsonPath('all_dispatched', false)
            ->assertJsonPath('work_orders.0.code', 'OT-LIST-1')
            ->assertJsonPath('work_orders.0.dispatched_notes_count', 0);
    }

    private function createMaterial(string $sku): Material
    {
        $material = Material::query()->create([
            'sku' => $sku,
            'name' => 'Test '.$sku,
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        return $material;
    }

    private function createPurchaseOrderWithLine(Material $material, string $ordered): PurchaseOrder
    {
        static $seq = 0;
        $seq++;
        $supplier = Supplier::query()->create([
            'name' => 'Prov '.$seq,
            'rif' => 'J-'.str_pad((string) $seq, 6, '0', STR_PAD_LEFT),
        ]);

        $po = PurchaseOrder::query()->create([
            'supplier_id' => $supplier->id,
            'code' => 'OC-CL-'.$seq,
            'status' => PurchaseOrderStatus::Open->value,
        ]);

        PurchaseOrderLine::query()->create([
            'purchase_order_id' => $po->id,
            'material_id' => $material->id,
            'quantity_ordered' => $ordered,
            'quantity_received' => '0',
            'unit' => 'kg',
        ]);

        return $po->fresh()->load('lines');
    }

    private function createBobinaTraceableTo(PurchaseOrder $po, Material $material, User $user): Bobina
    {
        static $bSeq = 0;
        $bSeq++;
        $bobina = Bobina::query()->create([
            'material_id' => $material->id,
            'code' => 'BOB-T-'.$bSeq,
            'weight_kg' => '20',
            'status' => 'available',
        ]);
        InventoryMovement::query()->create([
            'material_id' => $material->id,
            'movement_type' => 'in',
            'quantity' => '20',
            'reference_type' => 'bobina',
            'reference_id' => $bobina->id,
            'user_id' => $user->id,
            'metadata' => [
                'purchase_order_id' => $po->id,
                'purchase_order_line_id' => $po->lines->first()->id,
            ],
            'occurred_at' => now(),
        ]);

        return $bobina;
    }

    private function createWorkOrder(User $user, string $code): WorkOrder
    {
        return WorkOrder::query()->create([
            'code' => $code,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
    }

    private function consumeBobinaInWorkOrder(Bobina $bobina, WorkOrder $wo, Material $material): void
    {
        PrintingBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'bobina_id' => $bobina->id,
            'material_id' => $material->id,
            'quantity_used_kg' => '20',
            'quantity_finished_kg' => '20',
        ]);
    }
}
