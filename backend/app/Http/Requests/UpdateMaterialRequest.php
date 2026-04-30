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
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['integer', 'distinct', 'exists:products,id'],
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
            if ($area === InventoryArea::Tintas->value && ! $hasSubarea) {
                $validator->errors()->add('tinta_subarea', 'Subárea es obligatoria para tintas.');
            }

            $allowedUnits = $this->allowedUnitsByArea($area);
            if (! in_array($unit, $allowedUnits, true)) {
                $validator->errors()->add('unit', 'Unidad inválida para el área seleccionada.');
            }
        });
    }

    /**
     * @return string[]
     */
    private function allowedUnitsByArea(string $area): array
    {
        return match ($area) {
            InventoryArea::Material->value, InventoryArea::BobinasRechazadas->value => ['kg', 'm', 'rollo'],
            InventoryArea::Miscelaneos->value => ['kg', 'unidad', 'm', 'rollo'],
            InventoryArea::Tintas->value, InventoryArea::Quimicos->value => ['kg', 'unidad'],
            default => ['kg', 'unidad'],
        };
    }
}
