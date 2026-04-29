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
            'is_active' => ['sometimes', 'boolean'],
            'tinta_presentacion' => ['nullable', 'string', Rule::in(['original', 'solventada'])],
            'micras' => ['nullable', 'numeric', 'min:0'],
            'ancho' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:16'],
            'min_stock' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
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
                $hasMicras = $this->exists('micras') ? $this->filled('micras') : !is_null($material?->micras);
                $hasAncho = $this->exists('ancho') ? $this->filled('ancho') : !is_null($material?->ancho);

                if (!$hasMicras) {
                    $validator->errors()->add('micras', 'Micras es obligatorio para este tipo.');
                }
                if (!$hasAncho) {
                    $validator->errors()->add('ancho', 'Ancho es obligatorio para este tipo.');
                }
            }

            $hasPresentation = $this->exists('tinta_presentacion')
                ? $this->filled('tinta_presentacion')
                : !is_null($material?->tinta_presentacion);
            if ($area === InventoryArea::Tintas->value && !$hasPresentation) {
                $validator->errors()->add('tinta_presentacion', 'Presentación es obligatoria para tintas.');
            }

            $allowedUnits = $this->allowedUnitsByArea($area);
            if (!in_array($unit, $allowedUnits, true)) {
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
            InventoryArea::Tintas->value => ['kg', 'litro'],
            InventoryArea::Miscelaneos->value => ['unidad', 'caja', 'pack', 'kg'],
            default => ['kg', 'm', 'rollo', 'litro', 'unidad', 'caja', 'pack'],
        };
    }
}
