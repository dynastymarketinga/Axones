<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ReportPlanillaSustratoShortageRequest extends FormRequest
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
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'client_order_id' => ['nullable', 'integer', 'exists:client_orders,id'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.material_id' => ['required', 'integer', 'exists:materials,id'],
            'lines.*.quantity_requested' => ['required', 'numeric', 'min:0.001'],
            'lines.*.originating_area' => ['required', 'string', 'in:impresion,laminacion'],
            'lines.*.area_label' => ['required', 'string', 'max:32'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $woId = $this->input('work_order_id');
            $coId = $this->input('client_order_id');
            if ($woId === null && $coId === null) {
                $validator->errors()->add(
                    'work_order_id',
                    'Indique work_order_id o client_order_id (borrador de OT).',
                );
            }
        });
    }
}
