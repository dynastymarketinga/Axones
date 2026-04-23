<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'tinta_presentacion' => ['nullable', 'string', Rule::in(['original', 'solventada'])],
            'unit' => ['nullable', 'string', 'max:16'],
            'min_stock' => ['nullable', 'numeric', 'min:0'],
            'quantity_on_hand' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
