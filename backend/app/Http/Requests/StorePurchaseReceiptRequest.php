<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseReceiptRequest extends FormRequest
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
            'purchase_order_id' => ['nullable', 'integer', 'exists:purchase_orders,id'],
            'without_purchase_order' => ['sometimes', 'boolean'],
            'exception_reason' => ['required_if:without_purchase_order,true', 'nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'received_at' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.material_id' => ['required', 'integer', 'exists:materials,id'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'lines.*.purchase_order_line_id' => ['nullable', 'integer', 'exists:purchase_order_lines,id'],
            // Bobina única: si se indica bobina_count, se generan N bobinas y el ingreso se registra por bobina.
            'lines.*.bobina_count' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'lines.*.bobina_weight_kg' => ['nullable', 'numeric', 'min:0.001'],
        ];
    }
}
