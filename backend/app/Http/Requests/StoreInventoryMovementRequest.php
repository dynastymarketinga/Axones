<?php

namespace App\Http\Requests;

use App\Enums\InventoryMovementType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInventoryMovementRequest extends FormRequest
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
            'movement_type' => ['required', 'string', Rule::in(InventoryMovementType::values())],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'reference_type' => ['nullable', 'string', 'max:128'],
            'reference_id' => ['nullable', 'integer'],
            'metadata' => ['nullable', 'array'],
            'occurred_at' => ['nullable', 'date'],
        ];
    }
}
