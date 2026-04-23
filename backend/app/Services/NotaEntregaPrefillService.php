<?php

namespace App\Services;

use App\Models\DeliveryNote;
use App\Models\WorkOrder;

class NotaEntregaPrefillService
{
    public function __construct(
        private readonly CorteDispatchService $corteDispatch,
    ) {}

    /**
     * Datos sugeridos para "Nota de entrega" al seleccionar una OT desde corte.
     * Vehículo y conductor van vacíos para que los complete despacho.
     *
     * @return array<string, mixed>
     */
    public function buildForWorkOrder(WorkOrder $workOrder): array
    {
        $workOrder->load(['client', 'product']);

        $client = $workOrder->client;
        $product = $workOrder->product;

        $address = null;
        if ($client) {
            $address = $client->address;
            if ($address === null || $address === '') {
                $address = trim(implode(', ', array_filter([$client->city, $client->state], fn ($v) => $v !== null && $v !== '')));
            }
        }

        $materialTypeDescription = null;
        if ($product) {
            $materialTypeDescription = 'MATERIAL DE EMPAQUE PARA PRODUCTO "'.$product->name.'"';
        }

        $available = $this->corteDispatch->listAvailableForDispatch($workOrder->getKey());
        $suggestedLines = [];
        $position = 1;
        foreach ($available as $row) {
            $suggestedLines[] = [
                'pallet_position' => $position,
                'pallet_code' => (string) $position,
                'bobbin_count' => 1,
                'quantity_kg' => $row['quantity_remaining_kg'],
                'corte_bobina_usage_id' => $row['corte_bobina_usage_id'],
                'work_order_id' => $workOrder->getKey(),
                'product_id' => $workOrder->product_id,
                'description' => null,
            ];
            $position++;
        }

        $totalBobinas = array_sum(array_column($suggestedLines, 'bobbin_count'));
        $totalKg = '0.000';
        foreach ($suggestedLines as $line) {
            $totalKg = bcadd($totalKg, (string) $line['quantity_kg'], 3);
        }

        return [
            'work_order' => [
                'id' => $workOrder->getKey(),
                'code' => $workOrder->code,
                'document_number' => $workOrder->document_number,
            ],
            'client' => $client ? [
                'id' => $client->getKey(),
                'name' => $client->name,
                'rif' => $client->rif,
                'address' => $address,
            ] : null,
            'material_type_description' => $materialTypeDescription,
            'suggested_document_date' => now()->toDateString(),
            'next_sequential_number' => DeliveryNote::nextSequentialNumber(),
            'suggested_lines' => $suggestedLines,
            'totals_preview' => [
                'total_bobbin_count' => $totalBobinas,
                'total_kg' => $totalKg,
            ],
            'transport' => [
                'driver_name' => null,
                'vehicle_notes' => null,
            ],
        ];
    }
}
