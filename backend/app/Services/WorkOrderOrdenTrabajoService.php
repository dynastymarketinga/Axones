<?php

namespace App\Services;

use App\Enums\AreaRequestStatus;
use App\Enums\WorkOrderPriority;
use App\Models\AreaRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Illuminate\Validation\ValidationException;

class WorkOrderOrdenTrabajoService
{
    /**
     * Campos del formulario web que vienen de cliente / producto / pedido (precarga).
     *
     * @return array<string, mixed>
     */
    public function buildPrefill(WorkOrder $workOrder): array
    {
        $workOrder->loadMissing([
            'client',
            'product',
            'clientOrder.lines',
            'productionItems',
        ]);

        $pedidoKg = null;
        $firstItem = $workOrder->productionItems->first();
        if ($firstItem && strtoupper((string) $firstItem->quantity_unit) === 'KG') {
            $pedidoKg = (string) $firstItem->quantity;
        }
        if ($pedidoKg === null && $workOrder->clientOrder) {
            $sum = (string) $workOrder->clientOrder->lines->sum('quantity');
            $pedidoKg = bccomp($sum, '0', 3) === 1 ? $sum : null;
        }
        if ($pedidoKg !== null) {
            $pedidoKg = number_format((float) $pedidoKg, 3, '.', '');
        }

        $barcodeRaw = $workOrder->product?->barcode;
        $codigoBarra = is_string($barcodeRaw) && trim($barcodeRaw) !== '' ? trim($barcodeRaw) : null;

        $printType = $workOrder->product?->print_type;
        $tipoImpresion = null;
        if ($printType !== null && $printType !== '') {
            $t = strtolower((string) $printType);
            if (str_contains($t, 'reverso')) {
                $tipoImpresion = 'Reverso';
            } elseif (str_contains($t, 'superficie') || str_contains($t, 'superf')) {
                $tipoImpresion = 'Superficie';
            }
        }

        $assignmentTitles = [];
        foreach (ProductionNotificationService::PRODUCTIVE_AREAS as $area) {
            $assignmentTitles[$area] = sprintf('OT %s — asignada a %s', $workOrder->code, ucfirst($area));
        }

        $pendingAssignment = AreaRequest::query()
            ->where('work_order_id', $workOrder->getKey())
            ->where('status', AreaRequestStatus::Pending->value)
            ->whereIn('title', array_values($assignmentTitles))
            ->get(['area', 'title']);

        $assignedAreas = [];
        foreach ($assignmentTitles as $area => $title) {
            if ($pendingAssignment->contains(fn (AreaRequest $r): bool => $r->area === $area && $r->title === $title)) {
                $assignedAreas[] = $area;
            }
        }

        return [
            'fechaOrden' => $workOrder->document_date?->format('Y-m-d') ?? now()->format('Y-m-d'),
            'numeroOrden' => $workOrder->document_number ?: $workOrder->code,
            'pedidoKg' => $pedidoKg,
            'cliente' => $workOrder->client?->name,
            'clienteRif' => $workOrder->client?->rif,
            'producto' => $workOrder->product?->name,
            'estructuraMaterial' => $workOrder->product?->structure,
            'cpe' => $workOrder->product?->cpe,
            'mpps' => $workOrder->product?->mps,
            'codigoBarra' => $codigoBarra,
            'tipoImpresion' => $tipoImpresion,
            'client_order_code' => $workOrder->clientOrder?->code,
            'client_order_reference' => $workOrder->client_order_reference,
            'estadoOt' => (string) $workOrder->status,
            'etapaOt' => $workOrder->board_stage?->value ?? (string) $workOrder->board_stage,
            'priority' => $workOrder->priority?->value ?? WorkOrderPriority::Normal->value,
            'assigned_areas' => $assignedAreas,
        ];
    }

    /**
     * @return array{prefill: array<string, mixed>, form: array<string, mixed>|null}
     */
    public function getDocumentPayload(WorkOrder $workOrder): array
    {
        $doc = WorkOrderTechnicalDocument::query()->where('work_order_id', $workOrder->getKey())->first();

        return [
            'prefill' => $this->buildPrefill($workOrder),
            'form' => $doc?->form,
        ];
    }

    /**
     * @param  array<string, mixed>  $form
     */
    public function syncForm(WorkOrder $workOrder, array $form): WorkOrderTechnicalDocument
    {
        return WorkOrderTechnicalDocument::query()->updateOrCreate(
            ['work_order_id' => $workOrder->getKey()],
            ['form' => $form],
        );
    }

    /**
     * Fusiona solo claves del control de impresión (prefijo imp) sobre el formulario guardado.
     *
     * @param  array<string, mixed>  $incoming
     */
    public function mergePrintingKeysIntoForm(WorkOrder $workOrder, array $incoming, ?User $user = null): WorkOrderTechnicalDocument
    {
        $doc = WorkOrderTechnicalDocument::query()->where('work_order_id', $workOrder->getKey())->first();
        /** @var array<string, mixed> $existing */
        $existing = is_array($doc?->form) ? $doc->form : [];

        $this->assertPrintingEstadoAreaAllowed($existing, $incoming, $user);

        foreach ($incoming as $key => $value) {
            $k = (string) $key;
            if ($k !== '' && str_starts_with($k, 'imp')) {
                $existing[$k] = $value;
            }
        }

        return WorkOrderTechnicalDocument::query()->updateOrCreate(
            ['work_order_id' => $workOrder->getKey()],
            ['form' => $existing],
        );
    }

    /**
     * Solo roles de jefe pueden cambiar `impEstadoArea` (abierta / finalizada).
     *
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $incoming
     */
    private function assertPrintingEstadoAreaAllowed(array $existing, array $incoming, ?User $user): void
    {
        if (! array_key_exists('impEstadoArea', $incoming)) {
            return;
        }

        $new = strtolower(trim((string) $incoming['impEstadoArea']));
        $old = isset($existing['impEstadoArea'])
            ? strtolower(trim((string) $existing['impEstadoArea']))
            : 'abierta';

        if ($new === '' || $new === $old) {
            return;
        }

        if ($this->userCanFinalizePrintingArea($user)) {
            return;
        }

        throw ValidationException::withMessages([
            'form.impEstadoArea' => ['Solo personal autorizado puede cambiar el estado del área de impresión.'],
        ]);
    }

    private function userCanFinalizePrintingArea(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        $role = strtolower(trim((string) ($user->role ?? '')));

        return in_array($role, ['boss', 'admin', 'jefe_supremo', 'superadmin'], true);
    }
}
