<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\SpanishMultilineValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVendorRequest extends FormRequest
{
    use SpanishMultilineValidation;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $vendorId = (int) ($this->route('vendor')?->id ?? 0);

        return [
            'name' => ['sometimes', 'string', 'max:255', Rule::unique('vendors', 'name')->ignore($vendorId)],
            'active' => ['nullable', 'boolean'],
            'phone_primary' => ['nullable', 'string', 'max:64'],
            'phone_secondary' => ['nullable', 'string', 'max:64'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique' => 'Este vendedor ya existe (nombre).',
        ];
    }
}

