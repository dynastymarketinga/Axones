<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBobinaRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:64', 'unique:bobinas,code'],
            'weight_kg' => ['required', 'numeric', 'min:0.001'],
            'status' => ['nullable', 'string', Rule::in(['available', 'consumed', 'rejected'])],
            'inventory_return_id' => ['nullable', 'integer', 'exists:inventory_returns,id'],
        ];
    }
}
