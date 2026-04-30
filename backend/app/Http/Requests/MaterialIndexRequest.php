<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MaterialIndexRequest extends FormRequest
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
            'q' => ['nullable', 'string', 'max:255'],
            'inventory_area' => ['nullable', 'string', Rule::in(InventoryArea::values())],
            'tinta_subarea' => ['nullable', 'string', Rule::in(['laminacion', 'superficie', 'prueba_laminacion', 'laminacion_nueva'])],
            'product_id' => ['nullable', 'integer', 'min:1'],
            'unit' => ['nullable', 'string', 'max:16'],
            'stock_state' => ['nullable', 'string', Rule::in(['sin_stock', 'bajo_minimo', 'ok'])],
            'stock_min' => ['nullable', 'numeric', 'min:0'],
            'stock_max' => ['nullable', 'numeric', 'min:0'],
            'sort_by' => ['nullable', 'string', Rule::in(['sku', 'name', 'quantity_on_hand'])],
            'sort_dir' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
            'stock_mode' => ['nullable', 'string', Rule::in(['current', 'as_of_date'])],
            'as_of_date' => ['nullable', 'date'],
        ];
    }
}
