<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductRequest extends FormRequest
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
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'cpe' => ['nullable', 'string', 'max:255'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'mps' => ['nullable', 'string', 'max:255'],
            'print_type' => ['nullable', 'string', 'max:128'],
            'structure' => ['nullable', 'string'],
        ];
    }
}
