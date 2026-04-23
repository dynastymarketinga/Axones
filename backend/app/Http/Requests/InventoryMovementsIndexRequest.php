<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InventoryMovementsIndexRequest extends FormRequest
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
            'from' => ['sometimes', 'nullable', 'string'],
            'to' => ['sometimes', 'nullable', 'string'],
            'movement_type' => ['sometimes', 'nullable', 'string', Rule::in(InventoryMovementType::values())],
            'inventory_area' => ['sometimes', 'nullable', 'string', Rule::in(InventoryArea::values())],
            'material_id' => ['sometimes', 'nullable', 'integer', 'exists:materials,id'],
            'reference_type' => ['sometimes', 'nullable', 'string', 'max:64'],
            'reference_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'user_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'per_page' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:200'],
        ];
    }
}
