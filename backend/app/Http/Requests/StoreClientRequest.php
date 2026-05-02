<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreClientRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'rif' => ['required', 'string', 'max:32'],
            'state' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
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
}
