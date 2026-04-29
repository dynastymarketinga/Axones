<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ScrapReportRequest extends FormRequest
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
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'format' => ['sometimes', 'string', Rule::in(['csv'])],
        ];
    }
}
