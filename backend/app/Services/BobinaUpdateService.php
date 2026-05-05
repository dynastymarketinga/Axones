<?php

namespace App\Services;

use App\Enums\InventoryMovementType;
use App\Models\Bobina;
use App\Models\CorteBobinaUsage;
use App\Models\InventoryMovement;
use App\Models\LaminacionBobinaUsage;
use App\Models\Material;
use App\Models\PrintingBobinaUsage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BobinaUpdateService
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    /**
     * Código, material y kg solo si la bobina sigue "disponible" y sin usos en OT ni devolución rechazada.
     */
    public function canEditStructural(Bobina $bobina): bool
    {
        if ($bobina->inventory_return_id !== null) {
            return false;
        }
        if (! in_array((string) $bobina->status, ['available'], true)) {
            return false;
        }
        if (PrintingBobinaUsage::query()->where('bobina_id', $bobina->getKey())->exists()) {
            return false;
        }
        if (LaminacionBobinaUsage::query()->where('bobina_id', $bobina->getKey())->exists()) {
            return false;
        }
        if (CorteBobinaUsage::query()->where('bobina_id', $bobina->getKey())->exists()) {
            return false;
        }

        return true;
    }

    /**
     * @param  array{material_id?: int, code?: string, weight_kg?: string|float, status?: string}  $data
     */
    public function update(Bobina $bobina, array $data, User $user): Bobina
    {
        return DB::transaction(function () use ($bobina, $data, $user) {
            /** @var Bobina $locked */
            $locked = Bobina::query()->whereKey($bobina->getKey())->lockForUpdate()->firstOrFail();

            $structural = $this->canEditStructural($locked);
            $oldMaterialId = (int) $locked->material_id;
            $oldWeight = (string) $locked->weight_kg;
            $oldCode = (string) $locked->code;

            $newMaterialId = array_key_exists('material_id', $data) ? (int) $data['material_id'] : $oldMaterialId;
            $newWeight = array_key_exists('weight_kg', $data) ? (string) $data['weight_kg'] : $oldWeight;
            $newCode = array_key_exists('code', $data) ? (string) $data['code'] : $oldCode;
            $newStatus = array_key_exists('status', $data) ? (string) $data['status'] : (string) $locked->status;
            $reasonText = trim((string) ($data['change_reason'] ?? ''));

            if (! $structural) {
                if ($newMaterialId !== $oldMaterialId) {
                    throw ValidationException::withMessages([
                        'material_id' => ['No se puede cambiar el material: la bobina ya fue despachada, usada en producción o es rechazada.'],
                    ]);
                }
                if ($newWeight !== $oldWeight) {
                    throw ValidationException::withMessages([
                        'weight_kg' => ['No se puede cambiar el peso: la bobina ya no está en estado editable.'],
                    ]);
                }
                if ($newCode !== $oldCode) {
                    throw ValidationException::withMessages([
                        'code' => ['No se puede cambiar el código: la bobina ya no está en estado editable.'],
                    ]);
                }
            } else {
                if ($newMaterialId !== $oldMaterialId || $newWeight !== $oldWeight) {
                    /** @var Material $oldMaterial */
                    $oldMaterial = Material::query()->whereKey($oldMaterialId)->lockForUpdate()->firstOrFail();
                    /** @var Material $newMaterial */
                    $newMaterial = Material::query()->whereKey($newMaterialId)->lockForUpdate()->firstOrFail();

                    if ($newMaterialId === $oldMaterialId) {
                        $delta = bcsub($newWeight, $oldWeight, 3);
                        if (bccomp($delta, '0', 3) !== 0) {
                            if (bccomp($delta, '0', 3) === 1) {
                                $this->ledger->apply(
                                    $oldMaterial,
                                    InventoryMovementType::AdjustmentAdd,
                                    $delta,
                                    $user,
                                    'bobina',
                                    (int) $locked->getKey(),
                                    [
                                        'bobina_code' => $newCode,
                                        'reason_scope' => 'manual_adjustment',
                                        'reason_code' => 'bobina_weight_update',
                                        'reason_text' => $reasonText,
                                    ],
                                );
                            } else {
                                $neg = bcmul($delta, '-1', 3);
                                $this->ledger->apply(
                                    $oldMaterial,
                                    InventoryMovementType::AdjustmentSub,
                                    $neg,
                                    $user,
                                    'bobina',
                                    (int) $locked->getKey(),
                                    [
                                        'bobina_code' => $newCode,
                                        'reason_scope' => 'manual_adjustment',
                                        'reason_code' => 'bobina_weight_update',
                                        'reason_text' => $reasonText,
                                    ],
                                );
                            }
                        }
                    } else {
                        $this->ledger->apply(
                            $oldMaterial,
                            InventoryMovementType::AdjustmentSub,
                            $oldWeight,
                            $user,
                            'bobina',
                            (int) $locked->getKey(),
                            [
                                'bobina_code' => $oldCode,
                                'reason_scope' => 'manual_adjustment',
                                'reason_code' => 'bobina_material_change',
                                'reason_text' => $reasonText,
                            ],
                        );
                        $this->ledger->apply(
                            $newMaterial,
                            InventoryMovementType::In,
                            $newWeight,
                            $user,
                            'bobina',
                            (int) $locked->getKey(),
                            [
                                'bobina_code' => $newCode,
                                'reason_scope' => 'manual_adjustment',
                                'reason_code' => 'bobina_material_change',
                                'reason_text' => $reasonText,
                            ],
                        );
                    }
                }
            }

            $locked->fill([
                'material_id' => $newMaterialId,
                'code' => $newCode,
                'weight_kg' => $newWeight,
                'status' => $newStatus,
            ]);
            $locked->save();

            $statusChanged = $newStatus !== (string) $bobina->status;
            $codeChanged = $newCode !== $oldCode;
            if (($statusChanged || $codeChanged) && $reasonText !== '') {
                InventoryMovement::query()->create([
                    'material_id' => $newMaterialId,
                    'movement_type' => InventoryMovementType::AdjustmentAdd->value,
                    'quantity' => '0',
                    'reference_type' => 'inventory_adjustment',
                    'reference_id' => (int) $locked->getKey(),
                    'user_id' => $user->getKey(),
                    'metadata' => [
                        'reason_scope' => $statusChanged ? 'status_change' : 'master_edit',
                        'reason_code' => $statusChanged ? 'bobina_status_change' : 'bobina_code_change',
                        'reason_text' => $reasonText,
                        'bobina_code' => $newCode,
                        'before' => [
                            'status' => (string) $bobina->status,
                            'code' => $oldCode,
                        ],
                        'after' => [
                            'status' => $newStatus,
                            'code' => $newCode,
                        ],
                    ],
                    'occurred_at' => now(),
                ]);
            }

            return $locked->fresh()->load(['material.supplier:id,name', 'inventoryReturn.workOrder']);
        });
    }
}
