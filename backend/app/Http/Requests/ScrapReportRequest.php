<?php

namespace App\Http\Requests;

use App\Models\WorkOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'work_order_code' => ['nullable', 'string', 'max:120'],
            'substrate_group' => ['sometimes', 'string', Rule::in(['all', 'bopp', 'politerlero', 'transparente'])],
            'layout' => ['sometimes', 'string', Rule::in(['detail', 'by_work_order', 'by_area', 'history_kg'])],
            'format' => ['sometimes', 'string', Rule::in(['csv'])],
            'focus_work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'focus_area' => ['nullable', 'string', Rule::in(['printing', 'corte', 'laminacion', 'montaje'])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $data = $v->getData();
            $id = $data['work_order_id'] ?? null;
            $code = $data['work_order_code'] ?? null;
            if ($id === null || $id === '' || ! is_numeric($id)) {
                return;
            }
            if ($code === null || trim((string) $code) === '') {
                return;
            }
            $wo = WorkOrder::query()->find((int) $id);
            if ($wo === null) {
                return;
            }
            if (strcasecmp(trim((string) $code), (string) $wo->code) !== 0) {
                $v->errors()->add('work_order_code', 'El código no corresponde al ID de orden indicado.');
            }
        });
    }
}
