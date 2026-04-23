<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Models\Material;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'tinta_presentacion' => ['nullable', 'string', Rule::in(['original', 'solventada'])],
            'unit' => ['nullable', 'string', 'max:16'],
            'min_stock' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
