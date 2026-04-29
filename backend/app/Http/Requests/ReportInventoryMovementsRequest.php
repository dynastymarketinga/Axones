<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReportInventoryMovementsRequest extends FormRequest
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
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'movement_type' => ['sometimes', 'nullable', 'string', Rule::in(InventoryMovementType::values())],
            'inventory_area' => ['sometimes', 'nullable', 'string', Rule::in(InventoryArea::values())],
            'reference_type' => ['sometimes', 'nullable', 'string', Rule::in([
                'purchase_receipt',
                'miscellaneous_receipt',
                'material_request',
                'inventory_return',
                'inventory_adjustment',
            ])],
            'invalid_only' => ['sometimes', 'nullable', 'boolean'],
        ];
    }
}
