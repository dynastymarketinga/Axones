<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class InventoryReturnAcceptService
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    /**
     * Acepta una devolución pendiente y aplica el ingreso al inventario cuando corresponde.
     */
    public function accept(InventoryReturn $inventoryReturn, User $user, string $reason): InventoryReturn
    {
        if ($inventoryReturn->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['Esta devolución ya fue procesada.'],
            ]);
        }

        $reasonText = trim($reason);
        if ($reasonText === '') {
            throw ValidationException::withMessages([
                'reason' => ['Debe indicar una razón.'],
            ]);
        }

        $inventoryReturn->load('material');
        $material = $inventoryReturn->material;
        $isRejectedWithoutMaterial =
            ($inventoryReturn->destination_area === InventoryArea::BobinasRechazadas->value) && ! $material;

        if (! $material && ! $isRejectedWithoutMaterial) {
            throw ValidationException::withMessages([
                'material_id' => ['Material no encontrado para esta devolución.'],
            ]);
        }

        if (! $isRejectedWithoutMaterial) {
            $this->applyStockIn($material, $inventoryReturn, $user, $reasonText);
        }

        $inventoryReturn->update([
            'status' => 'accepted',
            'accepted_by' => (int) $user->getAuthIdentifier(),
            'accepted_at' => now(),
            'reason' => $reasonText,
        ]);

        return $inventoryReturn->fresh(['material.supplier:id,name', 'workOrder']);
    }

    /**
     * Devolución buena hacia sustrato: ingresa al material existente en inventario.
     */
    public function isGoodSubstrateReturn(InventoryReturn $inventoryReturn, ?Material $material): bool
    {
        return $material !== null
            && ($inventoryReturn->destination_area ?? '') === InventoryArea::Material->value
            && ($material->inventory_area ?? '') === InventoryArea::Material->value;
    }

    private function applyStockIn(Material $material, InventoryReturn $inventoryReturn, User $user, string $reasonText): void
    {
        $this->ledger->apply(
            $material,
            InventoryMovementType::In,
            (string) $inventoryReturn->quantity,
            $user,
            'inventory_return',
            $inventoryReturn->getKey(),
            [
                'note' => 'Ingreso por devolución aceptada',
                'reason_scope' => 'manual_adjustment',
                'reason_code' => 'inventory_return_accept',
                'reason_text' => $reasonText,
            ],
        );
    }
}
