<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\SpanishMultilineValidation;
use App\Support\RifNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateSupplierRequest extends FormRequest
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
        $supplierId = (int) ($this->route('supplier')?->id ?? 0);

        return [
            'name' => ['sometimes', 'string', 'min:2', 'max:255', Rule::unique('suppliers', 'name')->ignore($supplierId)],
            'no_rif' => ['sometimes', 'boolean'],
            'rif' => ['sometimes', 'nullable', 'string', 'max:32', Rule::unique('suppliers', 'rif')->ignore($supplierId)],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        if ($this->exists('name')) {
            $merge['name'] = trim((string) $this->input('name'));
        }

        if ($this->boolean('no_rif')) {
            $merge['rif'] = null;
        } elseif ($this->exists('rif')) {
            $merge['rif'] = RifNormalizer::normalize($this->input('rif'));
        }

        if ($merge !== []) {
            $this->merge($merge);
        }
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->exists('no_rif') && ! $this->exists('rif')) {
                return;
            }

            if ($this->boolean('no_rif')) {
                return;
            }

            $rif = $this->input('rif');
            if ($rif === null || $rif === '') {
                $validator->errors()->add(
                    'rif',
                    'El RIF es obligatorio. Marque «Sin RIF» si el proveedor no lo posee.',
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'name.min' => 'El nombre debe tener al menos 2 caracteres.',
            'name.unique' => 'Este proveedor ya existe (nombre).',
            'rif.unique' => 'Este RIF ya existe.',
        ];
    }
}
