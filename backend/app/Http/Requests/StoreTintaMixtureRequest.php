<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Models\Material;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'output_inventory_area' => ['nullable', 'string', Rule::in([InventoryArea::Tintas->value, InventoryArea::CementerioTintas->value])],
            'tinta_presentacion' => ['nullable', 'string', Rule::in(['original', 'solventada'])],
            'unit' => ['nullable', 'string', 'max:16'],
            'notes' => ['nullable', 'string'],
            'components' => ['required', 'array', 'min:1'],
            'components.*.material_id' => ['required', 'integer', 'distinct', 'exists:materials,id'],
            'components.*.quantity' => ['required', 'numeric', 'min:0.001'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function (\Illuminate\Validation\Validator $validator): void {
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
