<?php

namespace App\Services;

use App\Enums\InventoryMovementType;
use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryLedgerService
{
    public function __construct(
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * Registra un movimiento y actualiza quantity_on_hand en una transacción con bloqueo de fila.
     *
     * @param  array<string, mixed>|null  $metadata
     */
    public function apply(
        Material $material,
        InventoryMovementType $type,
        string $quantity,
        ?User $user = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?array $metadata = null,
        ?\DateTimeInterface $occurredAt = null,
        ?string $warehouseLocation = null, // <-- NUEVO: Recibimos el almacén
    ): InventoryMovement {
        if (bccomp($quantity, '0', 3) !== 1) {
            throw ValidationException::withMessages([
                'quantity' => ['La cantidad debe ser mayor que cero.'],
            ]);
        }

        return DB::transaction(function () use ($material, $type, $quantity, $user, $referenceType, $referenceId, $metadata, $occurredAt, $warehouseLocation) {
            /** @var Material $locked */
            $locked = Material::query()->whereKey($material->getKey())->lockForUpdate()->firstOrFail();

            $delta = $this->deltaForType($type, $quantity);
            $newBalance = bcadd($locked->quantity_on_hand, $delta, 3);

            if (bccomp($newBalance, '0', 3) === -1) {
                throw ValidationException::withMessages([
                    'quantity' => ['Stock insuficiente para esta operación.'],
                ]);
            }

            $locked->quantity_on_hand = $newBalance;
            $locked->save();

            $movement = InventoryMovement::query()->create([
                'material_id' => $locked->getKey(),
                'movement_type' => $type->value,
                'warehouse_location' => $warehouseLocation, // <-- NUEVO: Lo guardamos en la BD
                'quantity' => $quantity,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'user_id' => $user?->getKey(),
                'metadata' => $metadata,
                'occurred_at' => $occurredAt ?? now(),
            ]);

            if (in_array($type, [InventoryMovementType::Out, InventoryMovementType::AdjustmentSub], true)) {
                $this->alerts->evaluateMaterialLowStock($locked->fresh(), $user);
            }

            return $movement;
        });
    }

    private function deltaForType(InventoryMovementType $type, string $quantity): string
    {
        return match ($type) {
            InventoryMovementType::In, InventoryMovementType::AdjustmentAdd => $quantity,
            InventoryMovementType::Out, InventoryMovementType::AdjustmentSub => bcmul($quantity, '-1', 3),
        };
    }
}
