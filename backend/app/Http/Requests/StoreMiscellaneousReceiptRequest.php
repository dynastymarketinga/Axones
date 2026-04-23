<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMiscellaneousReceiptRequest extends FormRequest
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
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'invoice_reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string'],
            'received_at' => ['nullable', 'date'],
            'attachments' => ['required', 'array', 'min:1'],
            'attachments.*' => ['file', 'max:10240', 'mimes:jpeg,jpg,png,webp,pdf'],
        ];
    }

    public function messages(): array
    {
        return [
            'attachments.required' => 'Debe adjuntar al menos un comprobante o foto.',
            'attachments.min' => 'Debe adjuntar al menos un comprobante o foto.',
        ];
    }
}
