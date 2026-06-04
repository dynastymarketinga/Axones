<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReportRejectedBobinasRequest extends FormRequest
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
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'format' => ['sometimes', 'string', Rule::in(['csv', 'pdf'])],
        ];
    }
}
