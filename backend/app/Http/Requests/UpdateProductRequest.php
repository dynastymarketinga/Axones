<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\SpanishMultilineValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
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
        $productId = (int) ($this->route('product')?->id ?? 0);
        return [
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('products', 'name')
                    ->where(fn ($q) => $q->where('client_id', $this->input('client_id')))
                    ->ignore($productId),
            ],
            'barcode' => ['nullable', 'string', 'max:255'],
            'cpe' => ['nullable', 'string', 'max:255'],
            'mps' => ['nullable', 'string', 'max:255'],
            'print_type' => ['nullable', 'string', 'max:128'],
            'structure' => ['nullable', 'string', 'max:300'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique' => 'Este producto ya existe para ese cliente.',
        ];
    }
}
