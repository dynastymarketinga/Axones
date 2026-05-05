<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Models\Material;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Material|null $material */
        $material = $this->route('material');

        return [
            'sku' => ['sometimes', 'string', 'max:64', Rule::unique('materials', 'sku')->ignore($material)],
            'name' => ['sometimes', 'string', 'max:255'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'inventory_area' => ['sometimes', 'string', Rule::in(InventoryArea::values())],
            'tinta_subarea' => ['nullable', 'string', Rule::in(['laminacion', 'superficie', 'prueba_laminacion', 'laminacion_nueva'])],
            'micras' => ['nullable', 'numeric', 'min:0'],
            'ancho' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:16'],
            'min_stock' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['integer', 'distinct', 'exists:products,id'],
            'change_reason' => ['nullable', 'string', 'min:5', 'max:500'],
            'request_approval' => ['nullable', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Material|null $material */
            $material = $this->route('material');
            $area = (string) ($this->input('inventory_area') ?? $material?->inventory_area ?? '');
            $unit = (string) ($this->input('unit') ?? $material?->unit ?? 'kg');

            $requiresDimensions = in_array($area, [
                InventoryArea::Material->value,
                InventoryArea::BobinasRechazadas->value,
            ], true);

            if ($requiresDimensions) {
                $hasMicras = $this->exists('micras') ? $this->filled('micras') : ! is_null($material?->micras);
                $hasAncho = $this->exists('ancho') ? $this->filled('ancho') : ! is_null($material?->ancho);

                if (! $hasMicras) {
                    $validator->errors()->add('micras', 'Micras es obligatorio para este tipo.');
                }
                if (! $hasAncho) {
                    $validator->errors()->add('ancho', 'Ancho es obligatorio para este tipo.');
                }
            }

            $hasSubarea = $this->exists('tinta_subarea')
                ? $this->filled('tinta_subarea')
                : ($material?->tintaSubareas()->exists() ?? false);
            if (in_array($area, [InventoryArea::Tintas->value, InventoryArea::CementerioTintas->value], true) && ! $hasSubarea) {
                $validator->errors()->add('tinta_subarea', 'Subárea es obligatoria para tintas.');
            }

            $allowedUnits = $this->allowedUnitsByArea($area);
            if (! in_array($unit, $allowedUnits, true)) {
                $validator->errors()->add('unit', 'Unidad inválida para el área seleccionada.');
            }

            $supplierRequiredAreas = [
                InventoryArea::Material->value,
                InventoryArea::Tintas->value,
                InventoryArea::CementerioTintas->value,
                InventoryArea::Quimicos->value,
                InventoryArea::Miscelaneos->value,
            ];
            if (in_array($area, $supplierRequiredAreas, true)) {
                if ($this->exists('supplier_id') && ($this->input('supplier_id') === null || $this->input('supplier_id') === '')) {
                    $validator->errors()->add('supplier_id', 'El proveedor es obligatorio para sustratos, tintas, cementerio de tintas, químicos y misceláneos.');
                } elseif (! $this->exists('supplier_id') && (! $material?->supplier_id || (int) $material->supplier_id < 1)) {
                    $validator->errors()->add('supplier_id', 'El proveedor es obligatorio para sustratos, tintas, cementerio de tintas, químicos y misceláneos.');
                }
            }

            if ($this->filled('supplier_id')) {
                $supplierAllowedAreas = [
                    InventoryArea::Material->value,
                    InventoryArea::Tintas->value,
                    InventoryArea::CementerioTintas->value,
                    InventoryArea::Quimicos->value,
                    InventoryArea::Miscelaneos->value,
                ];
                if (! in_array($area, $supplierAllowedAreas, true)) {
                    $validator->errors()->add('supplier_id', 'El proveedor solo aplica a sustratos, tintas, cementerio de tintas, químicos o misceláneos.');
                }
            }

            if ($material && $this->hasCriticalChanges($material)) {
                $reason = trim((string) $this->input('change_reason', ''));
                if ($reason === '') {
                    $validator->errors()->add('change_reason', 'Debe indicar una razón.');
                }
            }
        });
    }

    private function hasCriticalChanges(Material $material): bool
    {
        $criticalFields = [
            'sku',
            'name',
            'barcode',
            'inventory_area',
            'tinta_subarea',
            'micras',
            'ancho',
            'unit',
            'min_stock',
            'notes',
            'supplier_id',
            'product_ids',
        ];

        foreach ($criticalFields as $field) {
            if (! $this->exists($field)) {
                continue;
            }

            if ($field === 'tinta_subarea') {
                $currentSubarea = optional($material->tintaSubareas()->first())->subarea;
                $incomingSubarea = $this->filled('tinta_subarea')
                    ? trim((string) $this->input('tinta_subarea'))
                    : null;
                if ($incomingSubarea !== $currentSubarea) {
                    return true;
                }
                continue;
            }

            if ($field === 'product_ids') {
                $current = $material->substrateProducts()->pluck('products.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
                $incoming = collect($this->input('product_ids', []))
                    ->map(fn ($id) => (int) $id)
                    ->filter(fn ($id) => $id > 0)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();
                if ($incoming !== $current) {
                    return true;
                }
                continue;
            }

            $incoming = $this->input($field);
            $current = $material->getAttribute($field);
            if ((string) $incoming !== (string) $current) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return string[]
     */
    private function allowedUnitsByArea(string $area): array
    {
        return match ($area) {
            InventoryArea::Material->value, InventoryArea::BobinasRechazadas->value => ['kg', 'm', 'rollo'],
            InventoryArea::Miscelaneos->value => ['kg', 'unidad', 'm', 'rollo'],
            InventoryArea::Tintas->value,
            InventoryArea::CementerioTintas->value,
            InventoryArea::Quimicos->value => ['kg', 'unidad'],
            default => ['kg', 'unidad'],
        };
    }
}
