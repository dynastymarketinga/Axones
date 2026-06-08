<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Enums\MaterialRequestStatus;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\MaterialRequestLine;
use App\Models\TintaMixture;
use App\Models\TintaMixtureComponent;
use App\Models\TintaSubarea;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TintasWarehouseRequestService
{
    public const CONSUMPTION_NOTES_MARKER = '[Origen: consumo tintas OT]';

    public const MIXTURE_NOTES_MARKER = '[Origen: mezcla tintas OT]';

    /** @var array<string, list<string>> */
    private const CHEMICAL_LOOKUP = [
        'alcohol' => ['alcohol', 'etanol'],
        'metoxil' => ['metoxil', 'metoxilo'],
        'npa' => ['npa', 'acetato', 'propil'],
    ];

    public function __construct(
        private readonly MaterialRequestService $materialRequests,
        private readonly InventoryLedgerService $ledger,
        private readonly OperationalAlertService $operationalAlerts,
    ) {}

    /**
     * Sincroniza solicitud de salida al almacén tras anotar consumo en OT (tintas + químicos).
     *
     * @param  list<array{material_id: int, quantity_original_kg?: float|string|null, quantity_solventada_kg?: float|string|null, quantity_return_kg?: float|string|null}>|null  $inkLines
     * @param  list<array{chemical_type: string, quantity_loaded_kg?: float|string|null, quantity_return_kg?: float|string|null}>|null  $chemicalUsages
     */
    public function syncConsumptionRequest(
        WorkOrder $workOrder,
        User $user,
        ?array $inkLines,
        ?array $chemicalUsages,
    ): ?MaterialRequest {
        $lines = $this->buildConsumptionLines($inkLines ?? [], $chemicalUsages ?? []);
        $existing = $this->findOpenConsumptionRequest($workOrder);

        if ($lines === []) {
            if ($existing !== null && $this->canReplaceConsumptionRequest($existing)) {
                $this->materialRequests->cancel($existing);
            }

            return null;
        }

        if ($existing !== null && $this->canReplaceConsumptionRequest($existing)) {
            return $this->replaceConsumptionLines($existing, $lines, $user);
        }

        $notes = self::CONSUMPTION_NOTES_MARKER.' · OT '.($workOrder->code ?? '#'.$workOrder->getKey());

        $mr = $this->materialRequests->storePendingRequest(
            $workOrder,
            $user,
            $lines,
            'tintas',
            $notes,
        );

        $this->operationalAlerts->recordMaterialRequestPendingForWarehouse($mr, $user);

        return $mr;
    }

    /**
     * Registra mezcla pendiente: solicitud a almacén sin mover stock hasta despacho.
     *
     * @param  array{output_sku: string, output_name: string, output_barcode?: string|null, work_order_id?: int|null, output_inventory_area?: string, output_tinta_subarea?: string|null, unit?: string|null, notes?: string|null, components: list<array{material_id: int, quantity: string|float}>}  $data
     */
    public function createMixtureRequest(array $data, User $user): TintaMixture
    {
        $this->assertCanCreateMixture($user);

        return DB::transaction(function () use ($data, $user) {
            $workOrderId = isset($data['work_order_id']) ? (int) $data['work_order_id'] : null;
            $workOrder = $workOrderId ? WorkOrder::query()->find($workOrderId) : null;

            $sorted = collect($data['components'])->sortBy('material_id')->values()->all();
            $total = '0';
            foreach ($sorted as $row) {
                $total = bcadd($total, (string) $row['quantity'], 3);
            }
            if (bccomp($total, '0', 3) !== 1) {
                throw ValidationException::withMessages([
                    'components' => ['La suma de componentes debe ser mayor que cero.'],
                ]);
            }

            $mixture = TintaMixture::query()->create([
                'status' => 'pending',
                'output_material_id' => null,
                'output_sku' => $data['output_sku'],
                'output_name' => $data['output_name'],
                'output_inventory_area' => $data['output_inventory_area'] ?? InventoryArea::Tintas->value,
                'output_tinta_subarea' => $data['output_tinta_subarea'] ?? 'superficie',
                'output_unit' => $data['unit'] ?? 'kg',
                'work_order_id' => $workOrderId ?: null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->getKey(),
            ]);

            foreach ($sorted as $row) {
                TintaMixtureComponent::query()->create([
                    'tinta_mixture_id' => $mixture->getKey(),
                    'material_id' => (int) $row['material_id'],
                    'quantity' => (string) $row['quantity'],
                ]);
            }

            $mrLines = array_map(static fn (array $row) => [
                'material_id' => (int) $row['material_id'],
                'quantity_requested' => (string) $row['quantity'],
            ], $sorted);

            $notes = sprintf(
                "%s · mezcla #%d · salida %s (%s)",
                self::MIXTURE_NOTES_MARKER,
                $mixture->getKey(),
                $data['output_sku'],
                $data['output_name'],
            );

            $mr = $this->materialRequests->storePendingRequest(
                $workOrder,
                $user,
                $mrLines,
                'tintas',
                $notes,
            );

            $mixture->update(['material_request_id' => $mr->getKey()]);
            $this->operationalAlerts->recordMaterialRequestPendingForWarehouse($mr, $user);

            return $mixture->fresh()->load(['components.material', 'creator', 'workOrder']);
        });
    }

    public function fulfillMixtureOnDispatch(MaterialRequest $mr, User $user): void
    {
        if (! $this->isTintasMixtureRequest($mr)) {
            return;
        }

        $mixture = TintaMixture::query()
            ->where('material_request_id', $mr->getKey())
            ->where('status', 'pending')
            ->lockForUpdate()
            ->first();

        if ($mixture === null) {
            return;
        }

        if ($mixture->output_material_id !== null) {
            $mixture->update(['status' => 'completed']);

            return;
        }

        $area = $mixture->output_inventory_area ?? InventoryArea::Tintas->value;
        $output = Material::query()->create([
            'sku' => $mixture->output_sku,
            'name' => $mixture->output_name,
            'barcode' => null,
            'inventory_area' => $area,
            'unit' => $mixture->output_unit ?? 'kg',
            'min_stock' => 0,
            'notes' => $mixture->notes,
        ]);

        if ($area === InventoryArea::Tintas->value) {
            $subarea = trim((string) ($mixture->output_tinta_subarea ?? 'superficie'));
            TintaSubarea::query()->updateOrCreate(
                ['material_id' => $output->getKey()],
                ['subarea' => $subarea === '' ? 'superficie' : $subarea]
            );
        }

        $mixture->load('components');
        $total = '0';
        foreach ($mixture->components as $component) {
            $total = bcadd($total, (string) $component->quantity, 3);
        }

        $this->ledger->apply(
            $output->fresh(),
            InventoryMovementType::In,
            $total,
            $user,
            'tinta_mixture',
            $mixture->getKey(),
            [
                'step' => 'mixture_output',
                'material_request_id' => $mr->getKey(),
                'work_order_id' => $mixture->work_order_id,
            ],
        );

        $mixture->update([
            'output_material_id' => $output->getKey(),
            'status' => 'completed',
        ]);
    }

    public function isTintasConsumptionRequest(MaterialRequest $mr): bool
    {
        return str_starts_with(trim((string) $mr->notes), self::CONSUMPTION_NOTES_MARKER);
    }

    public function isTintasMixtureRequest(MaterialRequest $mr): bool
    {
        return str_starts_with(trim((string) $mr->notes), self::MIXTURE_NOTES_MARKER);
    }

    public function isTintasWarehouseRequest(MaterialRequest $mr): bool
    {
        return $this->isTintasConsumptionRequest($mr) || $this->isTintasMixtureRequest($mr);
    }

    /**
     * @return array{devoluciones: int, solicitudes_area: int, materiales: int, bell: int}
     */
    public function pendingWarehouseCounts(): array
    {
        $devoluciones = (int) \App\Models\InventoryReturn::query()
            ->where('status', 'pending')
            ->whereIn('destination_area', [
                InventoryArea::Tintas->value,
                InventoryArea::CementerioTintas->value,
            ])
            ->count();

        $solicitudesArea = (int) MaterialRequest::query()
            ->whereIn('status', [
                MaterialRequestStatus::Pending->value,
                MaterialRequestStatus::Partial->value,
            ])
            ->where('originating_area', 'tintas')
            ->where(function ($q): void {
                $q->where('notes', 'like', self::CONSUMPTION_NOTES_MARKER.'%')
                    ->orWhere('notes', 'like', self::MIXTURE_NOTES_MARKER.'%');
            })
            ->count();

        $materiales = $devoluciones + $solicitudesArea;
        $bell = max($devoluciones, $solicitudesArea, $materiales);

        return [
            'devoluciones' => $devoluciones,
            'solicitudes_area' => $solicitudesArea,
            'materiales' => $materiales,
            'bell' => $bell,
        ];
    }

    /**
     * @param  list<array{material_id: int, quantity_original_kg?: float|string|null, quantity_solventada_kg?: float|string|null, quantity_return_kg?: float|string|null}>  $inkLines
     * @param  list<array{chemical_type: string, quantity_loaded_kg?: float|string|null, quantity_return_kg?: float|string|null}>  $chemicalUsages
     * @return list<array{material_id?: int|null, description?: string|null, unit?: string|null, quantity_requested: string|float}>
     */
    private function buildConsumptionLines(array $inkLines, array $chemicalUsages): array
    {
        $lines = [];

        foreach ($inkLines as $row) {
            $original = (string) ($row['quantity_original_kg'] ?? 0);
            $solventada = (string) ($row['quantity_solventada_kg'] ?? 0);
            $returned = (string) ($row['quantity_return_kg'] ?? 0);
            $qty = bcsub(bcadd($original, $solventada, 3), $returned, 3);
            if (bccomp($qty, '0', 3) !== 1) {
                continue;
            }
            $lines[] = [
                'material_id' => (int) $row['material_id'],
                'quantity_requested' => $qty,
            ];
        }

        foreach ($chemicalUsages as $row) {
            $loaded = (string) ($row['quantity_loaded_kg'] ?? 0);
            $returned = (string) ($row['quantity_return_kg'] ?? 0);
            $qty = bcsub($loaded, $returned, 3);
            if (bccomp($qty, '0', 3) !== 1) {
                continue;
            }
            $type = strtolower(trim((string) ($row['chemical_type'] ?? '')));
            $material = $this->resolveChemicalMaterial($type);
            if ($material !== null) {
                $lines[] = [
                    'material_id' => $material->getKey(),
                    'quantity_requested' => $qty,
                ];
            } else {
                $lines[] = [
                    'description' => ucfirst($type).' (químico tintas)',
                    'unit' => 'kg',
                    'quantity_requested' => $qty,
                ];
            }
        }

        return $lines;
    }

    private function resolveChemicalMaterial(string $chemicalType): ?Material
    {
        $keywords = self::CHEMICAL_LOOKUP[$chemicalType] ?? [$chemicalType];
        $materials = Material::query()
            ->where('inventory_area', InventoryArea::Quimicos->value)
            ->orderBy('id')
            ->get(['id', 'sku', 'name']);

        foreach ($materials as $material) {
            $hay = mb_strtolower($material->sku.' '.$material->name);
            foreach ($keywords as $keyword) {
                if ($keyword !== '' && str_contains($hay, mb_strtolower($keyword))) {
                    return $material;
                }
            }
        }

        return $materials->first();
    }

    private function findOpenConsumptionRequest(WorkOrder $workOrder): ?MaterialRequest
    {
        return MaterialRequest::query()
            ->where('work_order_id', $workOrder->getKey())
            ->where('originating_area', 'tintas')
            ->where('notes', 'like', self::CONSUMPTION_NOTES_MARKER.'%')
            ->whereIn('status', [
                MaterialRequestStatus::Pending->value,
                MaterialRequestStatus::Partial->value,
            ])
            ->orderByDesc('id')
            ->first();
    }

    private function canReplaceConsumptionRequest(MaterialRequest $mr): bool
    {
        if ($mr->authorized_by !== null) {
            return false;
        }

        return $mr->lines()->where('quantity_dispatched', '>', 0)->doesntExist();
    }

    /**
     * @param  list<array{material_id?: int|null, description?: string|null, unit?: string|null, quantity_requested: string|float}>  $lines
     */
    private function replaceConsumptionLines(MaterialRequest $mr, array $lines, User $user): MaterialRequest
    {
        return DB::transaction(function () use ($mr, $lines, $user) {
            /** @var MaterialRequest $locked */
            $locked = MaterialRequest::query()->whereKey($mr->getKey())->lockForUpdate()->firstOrFail();
            $locked->lines()->delete();

            foreach ($lines as $line) {
                MaterialRequestLine::query()->create([
                    'material_request_id' => $locked->getKey(),
                    'material_id' => isset($line['material_id']) ? (int) $line['material_id'] : null,
                    'description' => $line['description'] ?? null,
                    'quantity_requested' => $line['quantity_requested'],
                    'quantity_dispatched' => 0,
                    'unit' => $line['unit'] ?? null,
                ]);
            }

            $locked = $locked->fresh()->load(['lines.material', 'workOrder']);
            $this->materialRequests->refreshShadowAreaRequest($locked);
            $this->operationalAlerts->recordMaterialRequestPendingForWarehouse($locked, $user);

            return $locked;
        });
    }

    /**
     * @throws AuthorizationException
     */
    private function assertCanCreateMixture(User $user): void
    {
        $role = mb_strtolower(trim((string) ($user->role ?? '')));
        $allowed = ['tintas', 'boss', 'admin', 'jefe_supremo', 'superadmin', 'jefe_operaciones', 'supervisor'];
        if (! in_array($role, $allowed, true)) {
            throw new AuthorizationException('No autorizado para registrar mezclas de tinta.');
        }
    }
}
