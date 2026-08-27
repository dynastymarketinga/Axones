<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Support\MaterialNoSupplierPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $raw = $this->input('min_stock');
        if ($raw === null || $raw === '') {
            $this->merge(['min_stock' => 0]);
        }
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
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'no_supplier_reason' => ['nullable', 'string', 'max:1000'],
            'warehouse_location' => ['nullable', 'string', 'max:100'], // <-- AÑADIDO
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['integer', 'distinct', 'exists:products,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'min_stock.numeric' => 'Stock mínimo debe ser numérico.',
            'min_stock.min' => 'Stock mínimo no puede ser negativo.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $area = (string) $this->input('inventory_area', '');
            $unit = (string) $this->input('unit', 'kg');

            if (in_array($area, [InventoryArea::Tintas->value, InventoryArea::CementerioTintas->value], true) && ! $this->filled('tinta_subarea')) {
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
                $hasSupplier = $this->filled('supplier_id');
                $reason = trim((string) ($this->input('no_supplier_reason') ?? ''));
                $hasReason = $reason !== '';
                $mayOmitReason = MaterialNoSupplierPolicy::canOmitNoSupplierReason($this->user());

                if ($hasSupplier && $hasReason) {
                    $validator->errors()->add('no_supplier_reason', 'No puede indicar motivo si seleccionó un proveedor.');
                }
                if (! $hasSupplier && ! $hasReason && ! $mayOmitReason) {
                    $validator->errors()->add('supplier_id', 'Debe seleccionar un proveedor o indicar el motivo por no tener proveedor.');
                }
                if (! $hasSupplier && $hasReason && mb_strlen($reason) < 5 && ! $mayOmitReason) {
                    $validator->errors()->add('no_supplier_reason', 'El motivo debe tener al menos 5 caracteres.');
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

            $opening = $this->input('quantity_on_hand');
            if ($opening !== null && $opening !== '' && bccomp((string) $opening, '0', 3) === 1) {
                $validator->errors()->add(
                    'quantity_on_hand',
                    'No se puede cargar stock al crear el material. Registre las cantidades reales en Inventario → Recepción de material (con orden de compra).',
                );
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
            InventoryArea::Miscelaneos->value => ['kg', 'unidad', 'm', 'rollo', 'otros'],
            InventoryArea::Tintas->value,
            InventoryArea::CementerioTintas->value,
            InventoryArea::Quimicos->value => ['kg', 'unidad'],
            default => ['kg', 'unidad'],
        };
    }
}