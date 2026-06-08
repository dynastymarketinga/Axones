<?php

namespace App\Services;

use App\Models\TintaMixture;
use App\Models\User;

class TintaMixtureService
{
    public function __construct(
        private readonly TintasWarehouseRequestService $warehouseRequests,
    ) {}

    /**
     * Registra mezcla pendiente de aprobación/despacho en almacén (Leonardo).
     *
     * @param  array{output_sku: string, output_name: string, output_barcode?: string|null, work_order_id?: int|null, output_inventory_area?: string, output_tinta_subarea?: string|null, unit?: string|null, notes?: string|null, components: list<array{material_id: int, quantity: string|float}>}  $data
     */
    public function create(array $data, User $user): TintaMixture
    {
        return $this->warehouseRequests->createMixtureRequest($data, $user);
    }
}
