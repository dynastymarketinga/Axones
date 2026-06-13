<?php

namespace App\Services;

use App\Enums\InventoryMovementType;
use App\Enums\OperationalAlertType;
use App\Enums\PurchaseOrderStatus;
use App\Models\OperationalAlert;
use App\Models\Bobina;
use App\Models\Material;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\PurchaseReceipt;
use App\Models\PurchaseReceiptLine;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseReceiptService
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
        private readonly PurchaseOrderClosingService $purchaseOrderClosing,
    ) {}

    /**
     * @param  array{
     *   purchase_order_id?: int|null,
     *   supplier_id: int,
     *   without_purchase_order?: bool,
     *   exception_reason?: string|null,
     *   supplier_name?: string|null,
     *   invoice_number?: string|null,
     *   purchase_order_reference?: string|null,
     *   notes?: string|null,
     *   received_at?: string|null,
     *   lines: list<array{
     *      purchase_order_line_id?: int|null,
     *      material_id: int,
     *      item_type: string,
     *      quantity: string|float,
     *      unit: string,
     *      micras?: string|float|null,
     *      ancho_mm?: string|float|null,
     *      bobina_count?: int|null,
     *      bobina_weight_kg?: string|float|null
     *   }>
     * }  $data
     */
    public function store(array $data, User $user): PurchaseReceipt
    {
        $this->assertCanStoreReceipt($user);

        $linesInput = Collection::make($data['lines'])->sortBy('material_id')->values()->all();

        return DB::transaction(function () use ($data, $user, $linesInput) {
            $hasPurchaseOrderId = ! empty($data['purchase_order_id']);
            $without = (bool) ($data['without_purchase_order'] ?? false) || ! $hasPurchaseOrderId;
            $supplier = Supplier::query()->whereKey((int) $data['supplier_id'])->lockForUpdate()->firstOrFail();

            if ($without && $hasPurchaseOrderId) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['No debe indicar OC administrativa cuando la recepción es por referencia.'],
                ]);
            }

            $receipt = PurchaseReceipt::query()->create([
                'purchase_order_id' => $hasPurchaseOrderId ? (int) $data['purchase_order_id'] : null,
                'supplier_id' => (int) $supplier->getKey(),
                'supplier_name' => $data['supplier_name'] ?? (string) $supplier->name,
                'invoice_number' => $data['invoice_number'] ?? null,
                'purchase_order_reference' => $data['purchase_order_reference'] ?? null,
                'without_purchase_order' => $without,
                'exception_reason' => $without ? ($data['exception_reason'] ?? null) : null,
                'user_id' => $user->getKey(),
                'received_at' => isset($data['received_at']) ? new \DateTimeImmutable($data['received_at']) : now(),
                'notes' => $data['notes'] ?? null,
            ]);

            $po = null;
            if (! $without) {
                $po = PurchaseOrder::query()->whereKey((int) $data['purchase_order_id'])->lockForUpdate()->firstOrFail();
                $po->load('lines');
                if (! $po->is_active) {
                    throw ValidationException::withMessages([
                        'purchase_order_id' => ['La orden de compra está desactivada.'],
                    ]);
                }
                if ($po->status === PurchaseOrderStatus::Completed->value) {
                    foreach ($po->lines as $line) {
                        if (bccomp((string) $line->quantity_received, (string) $line->quantity_ordered, 3) === -1) {
                            throw ValidationException::withMessages([
                                'purchase_order_id' => ['La orden de compra está cerrada.'],
                            ]);
                        }
                    }
                }
            }

            foreach ($linesInput as $index => $line) {
                $qty = (string) $line['quantity'];
                $materialId = (int) $line['material_id'];
                $material = Material::query()->whereKey($materialId)->lockForUpdate()->firstOrFail();

                $polId = isset($line['purchase_order_line_id']) ? (int) $line['purchase_order_line_id'] : null;
                $pol = null;

                if (! $without && $po) {
                    if (! $polId) {
                        throw ValidationException::withMessages([
                            "lines.$index.purchase_order_line_id" => ['Con OC debe indicar la línea de pedido.'],
                        ]);
                    }
                    $pol = PurchaseOrderLine::query()->whereKey($polId)->lockForUpdate()->firstOrFail();
                    if ((int) $pol->purchase_order_id !== (int) $po->getKey()) {
                        throw ValidationException::withMessages([
                            "lines.$index.purchase_order_line_id" => ['La línea no pertenece a esta OC.'],
                        ]);
                    }
                    if ($pol->material_id && (int) $pol->material_id !== $materialId) {
                        throw ValidationException::withMessages([
                            "lines.$index.material_id" => ['El material debe coincidir con el definido en la línea de OC.'],
                        ]);
                    }
                    $pending = bcsub((string) $pol->quantity_ordered, (string) $pol->quantity_received, 3);
                    if (bccomp($qty, $pending, 3) === 1) {
                        throw ValidationException::withMessages([
                            "lines.$index.quantity" => ['La cantidad supera el pendiente de la línea de OC ('.$pending.').'],
                        ]);
                    }
                    $pol->quantity_received = bcadd((string) $pol->quantity_received, $qty, 3);
                    $pol->save();
                }

                $bobinaCount = isset($line['bobina_count']) ? (int) $line['bobina_count'] : null;
                $bobinaWeight = isset($line['bobina_weight_kg']) && $line['bobina_weight_kg'] !== null && $line['bobina_weight_kg'] !== ''
                    ? (string) $line['bobina_weight_kg']
                    : null;

                $receiptLine = PurchaseReceiptLine::query()->create([
                    'purchase_receipt_id' => $receipt->getKey(),
                    'purchase_order_line_id' => $polId,
                    'material_id' => $materialId,
                    'item_type' => $line['item_type'] ?? $this->defaultItemTypeFromMaterial($material),
                    'quantity' => $qty,
                    'unit' => $line['unit'] ?? (($material->unit && trim((string) $material->unit) !== '') ? (string) $material->unit : 'kg'),
                    'micras' => isset($line['micras']) && $line['micras'] !== '' ? (string) $line['micras'] : null,
                    'ancho_mm' => isset($line['ancho_mm']) && $line['ancho_mm'] !== '' ? (string) $line['ancho_mm'] : null,
                    'bobina_count' => $bobinaCount ?: null,
                    'bobina_weight_kg' => $bobinaWeight,
                ]);

                // Si se indica bobina_count, registrar la entrada por bobina (sin duplicar el movimiento del total).
                if ($bobinaCount && $bobinaCount > 0) {
                    if ($bobinaWeight !== null) {
                        // Validar que bobina_weight_kg * bobina_count = quantity (a 3 decimales)
                        $expected = bcmul($bobinaWeight, (string) $bobinaCount, 3);
                        if (bccomp($expected, $qty, 3) !== 0) {
                            throw ValidationException::withMessages([
                                "lines.$index.bobina_weight_kg" => ['El peso por bobina no cuadra con el total: '.$bobinaWeight.' × '.$bobinaCount.' = '.$expected.' (debe ser '.$qty.').'],
                            ]);
                        }
                    }

                    $this->createBobinasFromReceiptLine(
                        material: $material,
                        receipt: $receipt,
                        receiptLine: $receiptLine,
                        totalQty: $qty,
                        bobinaCount: $bobinaCount,
                        bobinaWeightKg: $bobinaWeight,
                        user: $user,
                        purchaseOrderLineId: $polId,
                    );
                } else {
                    // Entrada normal (por cantidad)
                    $this->ledger->apply(
                        $material,
                        InventoryMovementType::In,
                        $qty,
                        $user,
                        'purchase_receipt',
                        $receipt->getKey(),
                        [
                            'entry_kind' => 'physical_receipt',
                            'purchase_receipt_line_id' => $receiptLine->getKey(),
                            'purchase_order_id' => $receipt->purchase_order_id,
                            'purchase_order_line_id' => $polId,
                            'invoice_number' => $receipt->invoice_number,
                            'purchase_order_reference' => $receipt->purchase_order_reference,
                        ],
                        $receipt->received_at,
                    );
                }
            }

            if ($po) {
                $po->refresh()->load('lines');
                $this->purchaseOrderClosing->recompute($po);
                OperationalAlert::query()
                    ->unread()
                    ->where('alert_type', OperationalAlertType::PurchaseOrderPendingReceipt->value)
                    ->where('metadata->purchase_order_id', $po->getKey())
                    ->update([
                        'acknowledged_at' => now(),
                        'acknowledged_by' => $user->getKey(),
                    ]);
            }

            return $receipt->fresh(['supplier', 'lines.material', 'purchaseOrder.supplier', 'user']);
        });
    }

    private function createBobinasFromReceiptLine(
        Material $material,
        PurchaseReceipt $receipt,
        PurchaseReceiptLine $receiptLine,
        string $totalQty,
        int $bobinaCount,
        ?string $bobinaWeightKg,
        User $user,
        ?int $purchaseOrderLineId,
    ): void {
        $prefix = 'PR'.$receipt->getKey().'-L'.$receiptLine->getKey().'-';

        // Distribución de peso: si no se especifica, dividir y ajustar la última para que cuadre.
        if ($bobinaWeightKg === null) {
            $base = bcdiv($totalQty, (string) $bobinaCount, 3);
            $acc = '0';
            for ($i = 1; $i <= $bobinaCount; $i++) {
                $w = $i < $bobinaCount ? $base : bcsub($totalQty, $acc, 3);
                $acc = bcadd($acc, $w, 3);
                $this->createOneBobina(
                    material: $material,
                    receipt: $receipt,
                    receiptLine: $receiptLine,
                    code: $prefix.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                    weightKg: $w,
                    user: $user,
                    purchaseOrderLineId: $purchaseOrderLineId,
                );
            }

            return;
        }

        for ($i = 1; $i <= $bobinaCount; $i++) {
            $this->createOneBobina(
                material: $material,
                receipt: $receipt,
                receiptLine: $receiptLine,
                code: $prefix.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                weightKg: $bobinaWeightKg,
                user: $user,
                purchaseOrderLineId: $purchaseOrderLineId,
            );
        }
    }

    private function createOneBobina(
        Material $material,
        PurchaseReceipt $receipt,
        PurchaseReceiptLine $receiptLine,
        string $code,
        string $weightKg,
        User $user,
        ?int $purchaseOrderLineId,
    ): void {
        $bobina = Bobina::query()->create([
            'material_id' => $material->getKey(),
            'code' => $code,
            'weight_kg' => $weightKg,
            'status' => 'available',
        ]);

        $this->ledger->apply(
            $material,
            InventoryMovementType::In,
            $weightKg,
            $user,
            'bobina',
            (int) $bobina->getKey(),
            [
                'entry_kind' => 'physical_receipt_bobina',
                'bobina_code' => $bobina->code,
                'purchase_receipt_id' => $receipt->getKey(),
                'purchase_receipt_line_id' => $receiptLine->getKey(),
                'purchase_order_id' => $receipt->purchase_order_id,
                'purchase_order_line_id' => $purchaseOrderLineId,
                'invoice_number' => $receipt->invoice_number,
                'purchase_order_reference' => $receipt->purchase_order_reference,
            ],
            $receipt->received_at,
        );
    }

    private function defaultItemTypeFromMaterial(Material $material): string
    {
        return match ($material->inventory_area) {
            'tintas' => 'tinta',
            'quimicos' => 'quimico',
            'miscelaneos' => 'miscelaneo',
            default => 'sustrato',
        };
    }

    /**
     * @throws AuthorizationException
     */
    private function assertCanStoreReceipt(User $user): void
    {
        $role = mb_strtolower(trim((string) ($user->role ?? '')));
        $allowed = ['inventory', 'inventario', 'inventory_chief', 'jefe_inventario', 'jefe_almacen', 'boss', 'admin', 'jefe_supremo', 'superadmin', 'jefe_operaciones'];
        if (! in_array($role, $allowed, true)) {
            throw new AuthorizationException('No autorizado para registrar recepciones de compra.');
        }
    }
}
