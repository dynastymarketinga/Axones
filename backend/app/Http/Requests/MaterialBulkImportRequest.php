<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MaterialBulkImportRequest extends FormRequest
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
            'dry_run' => ['nullable', 'boolean'],
            'source_filename' => ['nullable', 'string', 'max:255'],
            'rows' => ['required', 'array', 'min:1', 'max:5000'],
            'rows.*.sheet_name' => ['nullable', 'string', 'max:64'],
            'rows.*.row_number' => ['nullable', 'integer', 'min:1'],
            'rows.*.sku' => ['required', 'string', 'max:64'],
            'rows.*.name' => ['required', 'string', 'max:255'],
            'rows.*.inventory_area' => ['required', 'string', Rule::in(InventoryArea::values())],
            'rows.*.unit' => ['nullable', 'string', 'max:16'],
            'rows.*.micras' => ['nullable', 'numeric', 'min:0'],
            'rows.*.ancho' => ['nullable', 'numeric', 'min:0'],
            'rows.*.tinta_subarea' => ['nullable', 'string', Rule::in(['laminacion', 'superficie', 'prueba_laminacion', 'laminacion_nueva'])],
            'rows.*.quantity' => ['required', 'numeric', 'min:0'],
        ];
    }
}
