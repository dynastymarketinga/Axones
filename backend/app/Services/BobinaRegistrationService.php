<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Enums\WorkOrderStatus;
use App\Models\Bobina;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BobinaRegistrationService
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    /**
     * @param  array{material_id: int, code: string, weight_kg: string|float, status?: string|null, inventory_return_id?: int|null}  $data
     */
    public function register(array $data, User $user): Bobina
    {
        return DB::transaction(function () use ($data, $user) {
            /** @var Material $material */
            $material = Material::query()->whereKey((int) $data['material_id'])->lockForUpdate()->firstOrFail();

            if ($material->inventory_area === InventoryArea::BobinasRechazadas->value) {
                return $this->registerRejectedBobina($material, $data);
            }

            if (! empty($data['inventory_return_id'])) {
                throw ValidationException::withMessages([
                    'inventory_return_id' => ['Solo las bobinas del área bobinas rechazadas se casan con una devolución.'],
                ]);
            }

            $bobina = Bobina::query()->create([
                'material_id' => $material->getKey(),
                'inventory_return_id' => null,
                'code' => $data['code'],
                'weight_kg' => $data['weight_kg'],
                'status' => $data['status'] ?? 'available',
            ]);

            $this->ledger->apply(
                $material,
                InventoryMovementType::In,
                (string) $data['weight_kg'],
                $user,
                'bobina',
                (int) $bobina->getKey(),
                ['bobina_code' => $bobina->code],
            );

            return $bobina->fresh()->load('material');
        });
    }

    /**
     * Bobina rechazada: el ingreso en kg ya ocurrió al aceptar la devolución; aquí solo se registra la entidad y el vínculo a OT (vía devolución).
     *
     * @param  array{material_id: int, code: string, weight_kg: string|float, status?: string|null, inventory_return_id?: int|null}  $data
     */
    private function registerRejectedBobina(Material $material, array $data): Bobina
    {
        if (empty($data['inventory_return_id'])) {
            throw ValidationException::withMessages([
                'inventory_return_id' => ['Las bobinas rechazadas deben estar casadas con una devolución aceptada de una orden de impresión.'],
            ]);
        }

        /** @var InventoryReturn $ret */
        $ret = InventoryReturn::query()->whereKey((int) $data['inventory_return_id'])->lockForUpdate()->firstOrFail();

        if ((int) $ret->material_id !== (int) $material->getKey()) {
            throw ValidationException::withMessages([
                'inventory_return_id' => ['La devolución no corresponde al material de la bobina.'],
            ]);
        }

        if ($ret->destination_area !== InventoryArea::BobinasRechazadas->value) {
            throw ValidationException::withMessages([
                'inventory_return_id' => ['La devolución debe ser hacia el área bobinas rechazadas.'],
            ]);
        }

        if ($ret->status !== 'accepted') {
            throw ValidationException::withMessages([
                'inventory_return_id' => ['La devolución debe estar aceptada antes de registrar la bobina.'],
            ]);
        }

        if ($ret->work_order_id === null) {
            throw ValidationException::withMessages([
                'inventory_return_id' => ['La devolución debe estar casada con una orden de trabajo (impresión).'],
            ]);
        }

        $wo = $ret->workOrder;
        if (! $wo || $wo->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'inventory_return_id' => ['La orden de trabajo vinculada no es válida o está cancelada.'],
            ]);
        }

        if (Bobina::query()->where('inventory_return_id', $ret->getKey())->exists()) {
            throw ValidationException::withMessages([
                'inventory_return_id' => ['Ya existe una bobina registrada para esta devolución.'],
            ]);
        }

        if (bccomp((string) $ret->quantity, (string) $data['weight_kg'], 3) !== 0) {
            throw ValidationException::withMessages([
                'weight_kg' => ['El peso debe coincidir con la cantidad de la devolución aceptada ('.$ret->quantity.').'],
            ]);
        }

        $bobina = Bobina::query()->create([
            'material_id' => $material->getKey(),
            'inventory_return_id' => $ret->getKey(),
            'code' => $data['code'],
            'weight_kg' => $data['weight_kg'],
            'status' => $data['status'] ?? 'rejected',
        ]);

        return $bobina->fresh()->load(['material', 'inventoryReturn.workOrder']);
    }
}
