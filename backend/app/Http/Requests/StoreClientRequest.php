<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\SpanishMultilineValidation;
use App\Support\RifNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreClientRequest extends FormRequest
{
    use SpanishMultilineValidation;

    protected function prepareForValidation(): void
    {
        if ($this->has('rif')) {
            $this->merge([
                'rif' => RifNormalizer::normalize($this->input('rif')),
            ]);
        }
    }

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
            'name' => ['required', 'string', 'max:255', Rule::unique('clients', 'name')],
            'rif' => ['required', 'string', 'max:32', Rule::unique('clients', 'rif')],
            'state' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'vendor_id' => ['nullable', 'integer', 'exists:vendors,id'],
            'address' => ['nullable', 'string', 'max:2000'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => [
                'nullable',
                'string',
                'max:22',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value === null || $value === '') {
                        return;
                    }
                    if (! is_string($value)) {
                        $fail('El teléfono no es válido.');

                        return;
                    }
                    $digits = preg_replace('/\D+/', '', $value) ?? '';
                    if (strlen($digits) < 7) {
                        $fail('El teléfono debe tener al menos 7 dígitos.');
                    }
                    if (strlen($digits) > 15) {
                        $fail('El teléfono no puede superar 15 dígitos.');
                    }
                },
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique' => 'Este cliente ya existe (nombre).',
            'rif.unique' => 'Este RIF ya existe.',
        ];
    }
}
