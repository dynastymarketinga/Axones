<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\SpanishMultilineValidation;
use App\Support\RifNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSupplierRequest extends FormRequest
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
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('suppliers', 'name')],
            'rif' => ['nullable', 'string', 'max:32', Rule::unique('suppliers', 'rif')],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('rif')) {
            $this->merge([
                'rif' => RifNormalizer::normalize($this->input('rif')),
            ]);
        }
    }

    public function messages(): array
    {
        return [
            'name.unique' => 'Este proveedor ya existe (nombre).',
            'rif.unique' => 'Este RIF ya existe.',
        ];
    }
}
