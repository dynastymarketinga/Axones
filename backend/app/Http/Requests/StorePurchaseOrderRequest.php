<?php

namespace App\Http\Requests;

use App\Enums\PurchaseOrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePurchaseOrderRequest extends FormRequest
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
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'code' => ['required', 'string', 'max:64', 'unique:purchase_orders,code'],
            'status' => ['nullable', 'string', Rule::in(PurchaseOrderStatus::values())],
            'ordered_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.description' => ['nullable', 'string'],
            'lines.*.material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'lines.*.quantity_ordered' => ['required', 'numeric', 'min:0.001'],
            'lines.*.unit' => ['nullable', 'string', 'max:16'],
        ];
    }
}
