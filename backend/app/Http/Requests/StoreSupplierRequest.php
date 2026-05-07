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
            'name' => ['required', 'string', 'min:2', 'max:255', Rule::unique('suppliers', 'name')],
            'no_rif' => ['sometimes', 'boolean'],
            'rif' => [
                Rule::requiredIf(fn () => ! $this->boolean('no_rif')),
                'nullable',
                'string',
                'max:32',
                Rule::unique('suppliers', 'rif'),
            ],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $merge = [
            'name' => trim((string) $this->input('name', '')),
        ];

        if ($this->boolean('no_rif')) {
            $merge['rif'] = null;
        } elseif ($this->exists('rif')) {
            $merge['rif'] = RifNormalizer::normalize($this->input('rif'));
        }

        $this->merge($merge);
    }

    public function messages(): array
    {
        return [
            'name.min' => 'El nombre debe tener al menos 2 caracteres.',
            'name.unique' => 'Este proveedor ya existe (nombre).',
            'rif.required' => 'El RIF es obligatorio. Marque «Sin RIF» si el proveedor no lo posee.',
            'rif.unique' => 'Este RIF ya existe.',
        ];
    }
}
