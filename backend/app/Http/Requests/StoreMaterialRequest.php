<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreMaterialRequest extends FormRequest
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
        return [
            'sku' => ['required', 'string', 'max:64', 'unique:materials,sku'],
            'name' => ['required', 'string', 'max:255'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'inventory_area' => ['required', 'string', Rule::in(InventoryArea::values())],
            'tinta_subarea' => ['nullable', 'string', Rule::in(['laminacion', 'superficie', 'prueba_laminacion', 'laminacion_nueva'])],
            'micras' => ['nullable', 'numeric', 'min:0'],
            'ancho' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:16'],
            'min_stock' => ['nullable', 'numeric', 'min:0'],
            'quantity_on_hand' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['integer', 'distinct', 'exists:products,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $area = (string) $this->input('inventory_area', '');
            $unit = (string) $this->input('unit', 'kg');

            $requiresDimensions = in_array($area, [
                InventoryArea::Material->value,
                InventoryArea::BobinasRechazadas->value,
            ], true);

            if ($requiresDimensions) {
                if (! $this->filled('micras')) {
                    $validator->errors()->add('micras', 'Micras es obligatorio para este tipo.');
                }
                if (! $this->filled('ancho')) {
                    $validator->errors()->add('ancho', 'Ancho es obligatorio para este tipo.');
                }
            }

            if ($area === InventoryArea::Tintas->value && ! $this->filled('tinta_subarea')) {
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
