<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MaterialRequestDispatchRequest extends FormRequest
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
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.material_request_line_id' => ['required', 'integer', 'exists:material_request_lines,id'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'lines.*.material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'lines.*.bobina_ids' => ['nullable', 'array'],
            'lines.*.bobina_ids.*' => ['integer', 'distinct', 'exists:bobinas,id'],
        ];
    }
}
