<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WorkOrderTimeReportRequest extends FormRequest
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
            'work_order_id' => ['nullable', 'integer', 'min:1', 'exists:work_orders,id'],
            'format' => ['sometimes', 'string', Rule::in(['csv'])],
        ];
    }
}
