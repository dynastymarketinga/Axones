<?php

namespace App\Services;

use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;

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
            'codigoBarra' => $workOrder->product?->barcode,
            'tipoImpresion' => $tipoImpresion,
            'client_order_code' => $workOrder->clientOrder?->code,
            'client_order_reference' => $workOrder->client_order_reference,
            'estadoOt' => (string) $workOrder->status,
            'etapaOt' => $workOrder->board_stage?->value ?? (string) $workOrder->board_stage,
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
    public function mergePrintingKeysIntoForm(WorkOrder $workOrder, array $incoming): WorkOrderTechnicalDocument
    {
        $doc = WorkOrderTechnicalDocument::query()->where('work_order_id', $workOrder->getKey())->first();
        /** @var array<string, mixed> $existing */
        $existing = is_array($doc?->form) ? $doc->form : [];

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
}
