<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReportWorkOrderMaterialSummaryRequest extends FormRequest
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
            'work_order_id' => ['required', 'integer', 'exists:work_orders,id'],
        ];
    }
}
