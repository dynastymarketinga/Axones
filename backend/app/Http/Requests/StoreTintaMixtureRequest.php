<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Models\Material;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreTintaMixtureRequest extends FormRequest
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
            'output_sku' => ['required', 'string', 'max:64', 'unique:materials,sku'],
            'output_name' => ['required', 'string', 'max:255'],
            'output_barcode' => ['nullable', 'string', 'max:64'],
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'output_inventory_area' => ['nullable', 'string', Rule::in([InventoryArea::Tintas->value, InventoryArea::CementerioTintas->value])],
            'output_tinta_subarea' => ['nullable', 'string', Rule::in(['laminacion', 'superficie', 'prueba_laminacion', 'laminacion_nueva'])],
            'unit' => ['nullable', 'string', 'max:16'],
            'notes' => ['nullable', 'string'],
            'components' => ['required', 'array', 'min:1'],
            'components.*.material_id' => ['required', 'integer', 'distinct', 'exists:materials,id'],
            'components.*.quantity' => ['required', 'numeric', 'min:0.001'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function (Validator $validator): void {
            $area = (string) ($this->input('output_inventory_area') ?? InventoryArea::Tintas->value);
            if ($area === InventoryArea::Tintas->value && ! $this->filled('output_tinta_subarea')) {
                $validator->errors()->add('output_tinta_subarea', 'Subárea es obligatoria para mezclas con salida en tintas.');
            }

            $components = $this->input('components', []);
            if (! is_array($components) || $components === []) {
                return;
            }

            $ids = collect($components)->pluck('material_id')->filter()->unique()->values();
            if ($ids->isEmpty()) {
                return;
            }

            $materials = Material::query()->whereIn('id', $ids)->get()->keyBy('id');
            $allowedBases = [
                InventoryArea::Tintas->value,
                InventoryArea::CementerioTintas->value,
                InventoryArea::Quimicos->value,
            ];

            foreach ($components as $i => $row) {
                $mid = $row['material_id'] ?? null;
                if (! $mid) {
                    continue;
                }
                $m = $materials->get($mid);
                if (! $m) {
                    continue;
                }
                if (! in_array($m->inventory_area, $allowedBases, true)) {
                    $validator->errors()->add(
                        "components.$i.material_id",
                        'Los componentes deben ser materiales en áreas tintas, cementerio_tintas o químicos.'
                    );
                }
            }
        });
    }
}
