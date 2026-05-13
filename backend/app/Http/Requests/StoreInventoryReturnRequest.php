<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Enums\WorkOrderStatus;
use App\Models\WorkOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Contracts\Validation\Validator;

class StoreInventoryReturnRequest extends FormRequest
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
            'material_id' => ['required', 'integer', 'exists:materials,id'],
            'work_order_id' => [
                Rule::requiredIf(fn () => $this->input('destination_area') === InventoryArea::BobinasRechazadas->value),
                'nullable',
                'integer',
                'exists:work_orders,id',
            ],
            'destination_area' => ['required', 'string', Rule::in(InventoryArea::values())],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'reason' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->input('destination_area') !== InventoryArea::BobinasRechazadas->value) {
                return;
            }
            $id = $this->input('work_order_id');
            if (! $id) {
                return;
            }
            $wo = WorkOrder::query()->find($id);
            if (! $wo || $wo->status === WorkOrderStatus::Cancelled->value) {
                $validator->errors()->add(
                    'work_order_id',
                    'La orden de trabajo es obligatoria para devoluciones a bobinas rechazadas y no debe estar cancelada.',
                );
            }
        });
    }
}
