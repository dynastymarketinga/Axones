<?php

namespace App\Support;

use App\Enums\InventoryArea;
use App\Models\ClientOrderLine;
use App\Models\CorteBobinaUsage;
use App\Models\Material;
use App\Models\MaterialRequestLine;
use App\Models\Product;
use App\Models\WorkOrder;
use App\Models\WorkOrderLine;
use App\Models\WorkOrderProductionItem;
use App\Models\WorkOrderTechnicalDocument;
use Illuminate\Support\Str;

final class CorteDispatchMaterialResolver
{
    /** Claves del formulario OT que pueden traer material_id (sustratos / consumos). */
    private const FORM_MATERIAL_ARRAY_KEYS = [
        'sustratosVirgenImp',
        'sustratosVirgenLam',
        'sustratosImpresoLam',
        'corSustratos',
    ];

    public static function resolveForWorkOrder(WorkOrder $workOrder): ?int
    {
        $fromLine = WorkOrderLine::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNotNull('material_id')
            ->orderBy('id')
            ->value('material_id');

        if ($fromLine !== null) {
            return (int) $fromLine;
        }

        $fromUsage = CorteBobinaUsage::query()
            ->where('work_order_id', $workOrder->getKey())
            ->whereNotNull('material_id')
            ->orderByDesc('id')
            ->value('material_id');

        if ($fromUsage !== null) {
            return (int) $fromUsage;
        }

        return self::resolveFromFallbacks($workOrder);
    }

    /**
     * Resuelve material para despacho y, si hace falta, crea línea de OT y material terminado del producto.
     */
    public static function ensureForWorkOrder(WorkOrder $workOrder): ?int
    {
        $existing = self::resolveForWorkOrder($workOrder);
        if ($existing !== null) {
            self::ensureWorkOrderLine($workOrder, $existing);

            return $existing;
        }

        $workOrder->loadMissing(['product']);
        if ($workOrder->product_id === null) {
            return null;
        }

        $fromProduct = self::findOrCreateFinishedMaterialForProduct($workOrder->product);
        if ($fromProduct === null) {
            return null;
        }

        self::ensureWorkOrderLine($workOrder, $fromProduct);

        return $fromProduct;
    }

    public static function canEnsureForWorkOrder(WorkOrder $workOrder): bool
    {
        if (self::resolveForWorkOrder($workOrder) !== null) {
            return true;
        }

        return $workOrder->product_id !== null;
    }

    private static function resolveFromFallbacks(WorkOrder $workOrder): ?int
    {
        $fromMr = MaterialRequestLine::query()
            ->whereHas('materialRequest', fn ($q) => $q->where('work_order_id', $workOrder->getKey()))
            ->whereNotNull('material_id')
            ->orderBy('id')
            ->value('material_id');
        if ($fromMr !== null) {
            return (int) $fromMr;
        }

        if ($workOrder->client_order_id !== null) {
            $fromCo = ClientOrderLine::query()
                ->where('client_order_id', $workOrder->client_order_id)
                ->whereNotNull('material_id')
                ->orderBy('id')
                ->value('material_id');
            if ($fromCo !== null) {
                return (int) $fromCo;
            }
        }

        $workOrder->loadMissing(['product.substrateMaterials']);
        $substrate = $workOrder->product?->substrateMaterials?->first();
        if ($substrate !== null) {
            return (int) $substrate->getKey();
        }

        return self::materialIdFromTechnicalDocument($workOrder);
    }

    private static function materialIdFromTechnicalDocument(WorkOrder $workOrder): ?int
    {
        $doc = WorkOrderTechnicalDocument::query()
            ->where('work_order_id', $workOrder->getKey())
            ->first();
        if ($doc === null || ! is_array($doc->form)) {
            return null;
        }

        foreach (self::FORM_MATERIAL_ARRAY_KEYS as $key) {
            $id = self::firstMaterialIdFromFormRows($doc->form[$key] ?? null);
            if ($id !== null) {
                return $id;
            }
        }

        return null;
    }

    private static function firstMaterialIdFromFormRows(mixed $raw): ?int
    {
        if (! is_array($raw)) {
            return null;
        }
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }
            $mid = $row['material_id'] ?? null;
            if ($mid === null || $mid === '') {
                continue;
            }
            if (is_numeric($mid) && (int) $mid > 0) {
                return (int) $mid;
            }
        }

        return null;
    }

    private static function findOrCreateFinishedMaterialForProduct(?Product $product): ?int
    {
        if ($product === null) {
            return null;
        }

        $sku = self::finishedMaterialSku($product);
        $existing = Material::query()->where('sku', $sku)->value('id');
        if ($existing !== null) {
            self::linkMaterialToProduct($product, (int) $existing);

            return (int) $existing;
        }

        $cpe = trim((string) ($product->cpe ?? ''));
        $name = trim((string) $product->name);
        $label = $name !== '' ? $name : 'Producto #'.$product->getKey();
        if ($cpe !== '') {
            $label .= ' ('.$cpe.')';
        }

        $material = Material::query()->create([
            'sku' => $sku,
            'name' => $label.' · terminado',
            'inventory_area' => InventoryArea::Material->value,
            'unit' => 'kg',
            'min_stock' => 0,
            'notes' => 'Material terminado generado para despacho desde corte (producto #'.$product->getKey().').',
        ]);

        self::linkMaterialToProduct($product, (int) $material->getKey());

        return (int) $material->getKey();
    }

    private static function finishedMaterialSku(Product $product): string
    {
        $cpe = Str::upper(Str::slug(trim((string) ($product->cpe ?? '')), '-'));
        if ($cpe !== '') {
            return 'PT-'.$cpe;
        }

        return 'PT-P'.$product->getKey();
    }

    private static function linkMaterialToProduct(Product $product, int $materialId): void
    {
        $product->substrateMaterials()->syncWithoutDetaching([$materialId]);
    }

    private static function ensureWorkOrderLine(WorkOrder $workOrder, int $materialId): void
    {
        $exists = WorkOrderLine::query()
            ->where('work_order_id', $workOrder->getKey())
            ->where('material_id', $materialId)
            ->exists();
        if ($exists) {
            return;
        }

        $qty = WorkOrderProductionItem::query()
            ->where('work_order_id', $workOrder->getKey())
            ->orderBy('position')
            ->value('quantity');

        WorkOrderLine::query()->create([
            'work_order_id' => $workOrder->getKey(),
            'material_id' => $materialId,
            'quantity' => $qty !== null && (string) $qty !== '' ? (string) $qty : '0.000',
            'notes' => 'Material para despacho · producto terminado (corte)',
        ]);
    }
}
