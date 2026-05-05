<?php

namespace App\Http\Requests;

use App\Enums\InventoryMovementType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            'reason' => ['nullable', 'string', 'min:5', 'max:500'],
            'occurred_at' => ['nullable', 'date'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $movementType = (string) $this->input('movement_type');
            $isManualAdjustment = in_array($movementType, [
                InventoryMovementType::AdjustmentAdd->value,
                InventoryMovementType::AdjustmentSub->value,
            ], true);
            if (! $isManualAdjustment) {
                return;
            }

            if (trim((string) $this->input('reason', '')) === '') {
                $validator->errors()->add('reason', 'Debe indicar una razón.');
            }
        });
    }
}
