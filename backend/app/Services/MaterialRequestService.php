<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Enums\MaterialRequestStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Bobina;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\MaterialRequestLine;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MaterialRequestService
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    /**
     * Crea una solicitud pendiente ligada a la OT (formulario "Solicitud de materiales y repuestos").
     *
     * @param  list<array{material_id?: int|null, description?: string|null, unit?: string|null, quantity_requested: string|float}>  $lines
     */
    public function storePendingRequest(
        WorkOrder $workOrder,
        User $user,
        array $lines,
        ?string $originatingArea = null,
        ?string $notes = null,
        ?string $documentDate = null,
        ?array $destinationAreas = null,
        ?string $machineCode = null,
    ): MaterialRequest {
        if ($workOrder->status === WorkOrderStatus::Cancelled->value) {
            throw ValidationException::withMessages([
                'work_order_id' => ['No se pueden crear solicitudes sobre una OT cancelada.'],
            ]);
        }

        $this->validateConsumptionLinesForWorkOrder($lines);

        $mr = MaterialRequest::query()->create([
            'work_order_id' => $workOrder->getKey(),
            'document_date' => $documentDate,
            'requested_by' => $user->getKey(),
            'originating_area' => $originatingArea,
            'destination_areas' => $destinationAreas,
            'machine_code' => $machineCode,
            'status' => MaterialRequestStatus::Pending->value,
            'notes' => $notes,
        ]);

        foreach ($lines as $line) {
            MaterialRequestLine::query()->create([
                'material_request_id' => $mr->getKey(),
                'material_id' => isset($line['material_id']) ? (int) $line['material_id'] : null,
                'description' => $line['description'] ?? null,
                'quantity_requested' => $line['quantity_requested'],
                'quantity_dispatched' => 0,
                'unit' => $line['unit'] ?? null,
            ]);
        }

        return $mr->fresh()->load(['lines.material', 'workOrder']);
    }

    /**
     * Valida líneas: con inventario (áreas permitidas) o solo descripción (artículo no catalogado).
     *
     * @param  list<array{material_id?: int|null, description?: string|null, quantity_requested: string|float}>  $lines
     */
    public function validateConsumptionLinesForWorkOrder(array $lines): void
    {
        $allowed = [
            InventoryArea::Material->value,
            InventoryArea::Tintas->value,
            InventoryArea::CementerioTintas->value,
            InventoryArea::Quimicos->value,
        ];

        foreach ($lines as $idx => $line) {
            $mid = $line['material_id'] ?? null;
            $desc = trim((string) ($line['description'] ?? ''));

            if (! $mid && $desc === '') {
                throw ValidationException::withMessages([
                    "lines.$idx.material_id" => ['Indique un material del inventario o una descripción del artículo (ej. trapos, repuesto).'],
                ]);
            }

            if ($mid) {
                $material = Material::query()->find((int) $mid);
                if (! $material || ! in_array($material->inventory_area, $allowed, true)) {
                    throw ValidationException::withMessages([
                        "lines.$idx.material_id" => ['Solo materiales de áreas material, tintas, cementerio de tintas o químicos.'],
                    ]);
                }
            }
        }
    }

    public function authorizeRequest(MaterialRequest $materialRequest, User $user): MaterialRequest
    {
        return DB::transaction(function () use ($materialRequest, $user) {
            /** @var MaterialRequest $mr */
            $mr = MaterialRequest::query()->whereKey($materialRequest->getKey())->lockForUpdate()->firstOrFail();

            if ($mr->status === MaterialRequestStatus::Cancelled->value) {
                throw ValidationException::withMessages([
                    'material_request' => ['La solicitud está cancelada.'],
                ]);
            }

            if ($mr->authorized_by !== null) {
                return $mr->fresh()->load([
                    'lines.material',
                    'workOrder.client',
                    'workOrder.product',
                    'requester',
                    'authorizer',
                    'dispatcher',
                ]);
            }

            $mr->authorized_by = $user->getKey();
            $mr->authorized_at = now();
            $mr->save();

            return $mr->fresh()->load([
                'lines.material',
                'workOrder.client',
                'workOrder.product',
                'requester',
                'authorizer',
                'dispatcher',
            ]);
        });
    }

    /**
     * @param  list<array{material_request_line_id: int, quantity: string|float, bobina_ids?: list<int>|null}>  $lines
     */
    public function dispatch(MaterialRequest $materialRequest, array $lines, User $user): MaterialRequest
    {
        return DB::transaction(function () use ($materialRequest, $lines, $user) {
            /** @var MaterialRequest $mr */
            $mr = MaterialRequest::query()->whereKey($materialRequest->getKey())->lockForUpdate()->firstOrFail();

            if ($mr->status === MaterialRequestStatus::Cancelled->value) {
                throw ValidationException::withMessages([
                    'material_request' => ['La solicitud está cancelada.'],
                ]);
            }
            if ($mr->status === MaterialRequestStatus::Dispatched->value) {
                throw ValidationException::withMessages([
                    'material_request' => ['La solicitud ya fue despachada por completo.'],
                ]);
            }

            $wo = WorkOrder::query()->whereKey($mr->work_order_id)->lockForUpdate()->firstOrFail();
            if ($wo->status === WorkOrderStatus::Cancelled->value) {
                throw ValidationException::withMessages([
                    'work_order' => ['La orden de trabajo está cancelada.'],
                ]);
            }

            foreach ($lines as $idx => $lineInput) {
                $lineId = (int) $lineInput['material_request_line_id'];
                $qty = (string) $lineInput['quantity'];
                $bobinaIds = $lineInput['bobina_ids'] ?? null;

                /** @var MaterialRequestLine $mrl */
                $mrl = MaterialRequestLine::query()->whereKey($lineId)->lockForUpdate()->firstOrFail();
                if ((int) $mrl->material_request_id !== (int) $mr->getKey()) {
                    throw ValidationException::withMessages([
                        "lines.$idx.material_request_line_id" => ['La línea no pertenece a esta solicitud.'],
                    ]);
                }

                $remaining = bcsub((string) $mrl->quantity_requested, (string) $mrl->quantity_dispatched, 3);
                if (bccomp($qty, '0', 3) !== 1) {
                    throw ValidationException::withMessages([
                        "lines.$idx.quantity" => ['La cantidad debe ser mayor que cero.'],
                    ]);
                }
                if (bccomp($qty, $remaining, 3) === 1) {
                    throw ValidationException::withMessages([
                        "lines.$idx.quantity" => ['La cantidad excede lo pendiente de despacho ('.$remaining.').'],
                    ]);
                }

                if ($mrl->material_id === null) {
                    $mrl->quantity_dispatched = bcadd((string) $mrl->quantity_dispatched, $qty, 3);
                    $mrl->save();

                    continue;
                }

                $material = Material::query()->whereKey($mrl->material_id)->lockForUpdate()->firstOrFail();

                if (is_array($bobinaIds) && count($bobinaIds) > 0) {
                    if ($material->inventory_area !== InventoryArea::Material->value) {
                        throw ValidationException::withMessages([
                            "lines.$idx.bobina_ids" => ['Solo se pueden despachar bobinas para materiales del área "material".'],
                        ]);
                    }

                    $uniqueIds = array_values(array_unique(array_map('intval', $bobinaIds)));
                    $bobinas = Bobina::query()
                        ->whereIn('id', $uniqueIds)
                        ->lockForUpdate()
                        ->get();

                    if ($bobinas->count() !== count($uniqueIds)) {
                        throw ValidationException::withMessages([
                            "lines.$idx.bobina_ids" => ['Una o más bobinas no existen.'],
                        ]);
                    }

                    $total = '0';
                    foreach ($bobinas as $b) {
                        if ((int) $b->material_id !== (int) $material->getKey()) {
                            throw ValidationException::withMessages([
                                "lines.$idx.bobina_ids" => ['Una o más bobinas no corresponden al material solicitado.'],
                            ]);
                        }
                        if ($b->status !== 'available') {
                            throw ValidationException::withMessages([
                                "lines.$idx.bobina_ids" => ['Una o más bobinas no están disponibles (status != available).'],
                            ]);
                        }
                        $total = bcadd($total, (string) $b->weight_kg, 3);
                    }

                    if (bccomp($qty, $total, 3) !== 0) {
                        throw ValidationException::withMessages([
                            "lines.$idx.quantity" => ['La cantidad debe coincidir exactamente con la suma de pesos de las bobinas seleccionadas ('.$total.').'],
                        ]);
                    }

                    foreach ($bobinas as $b) {
                        $b->status = 'issued';
                        $b->save();

                        $this->ledger->apply(
                            $material,
                            InventoryMovementType::Out,
                            (string) $b->weight_kg,
                            $user,
                            'material_request_bobina',
                            (int) $mr->getKey(),
                            [
                                'material_request_line_id' => $mrl->getKey(),
                                'work_order_id' => $wo->getKey(),
                                'bobina_id' => $b->getKey(),
                                'bobina_code' => $b->code,
                            ],
                        );
                    }

                    $mrl->quantity_dispatched = bcadd((string) $mrl->quantity_dispatched, $qty, 3);
                    $mrl->save();
                    continue;
                }

                $this->ledger->apply(
                    $material,
                    InventoryMovementType::Out,
                    $qty,
                    $user,
                    'material_request',
                    (int) $mr->getKey(),
                    [
                        'material_request_line_id' => $mrl->getKey(),
                        'work_order_id' => $wo->getKey(),
                    ],
                );

                $mrl->quantity_dispatched = bcadd((string) $mrl->quantity_dispatched, $qty, 3);
                $mrl->save();
            }

            $mr->refresh();
            $mr->load('lines');

            $allComplete = $mr->lines->every(function (MaterialRequestLine $l) {
                return bccomp((string) $l->quantity_dispatched, (string) $l->quantity_requested, 3) === 0;
            });

            $anyDispatched = $mr->lines->contains(function (MaterialRequestLine $l) {
                return bccomp((string) $l->quantity_dispatched, '0', 3) === 1;
            });

            if ($allComplete) {
                $mr->status = MaterialRequestStatus::Dispatched->value;
                $mr->dispatched_by = $user->getKey();
                $mr->dispatched_at = now();
            } elseif ($anyDispatched) {
                $mr->status = MaterialRequestStatus::Partial->value;
            }

            $mr->save();

            return $mr->fresh()->load([
                'lines.material',
                'workOrder.client',
                'workOrder.product',
                'requester',
                'authorizer',
                'dispatcher',
            ]);
        });
    }

    public function cancel(MaterialRequest $materialRequest): void
    {
        DB::transaction(function () use ($materialRequest) {
            /** @var MaterialRequest $mr */
            $mr = MaterialRequest::query()->whereKey($materialRequest->getKey())->lockForUpdate()->firstOrFail();

            if ($mr->status === MaterialRequestStatus::Cancelled->value) {
                return;
            }

            $hasDispatch = MaterialRequestLine::query()
                ->where('material_request_id', $mr->getKey())
                ->where('quantity_dispatched', '>', 0)
                ->exists();

            if ($hasDispatch) {
                throw ValidationException::withMessages([
                    'status' => ['No se puede cancelar una solicitud con despachos registrados.'],
                ]);
            }

            $mr->status = MaterialRequestStatus::Cancelled->value;
            $mr->save();
        });
    }
}
