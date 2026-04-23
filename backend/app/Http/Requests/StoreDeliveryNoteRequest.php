<?php

namespace App\Http\Requests;

use App\Models\CorteBobinaUsage;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class StoreDeliveryNoteRequest extends FormRequest
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
            'code' => ['nullable', 'string', 'max:64', 'unique:delivery_notes,code'],
            'sequential_number' => ['nullable', 'integer', 'min:1', 'unique:delivery_notes,sequential_number'],
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'document_date' => ['nullable', 'date'],
            'driver_name' => ['nullable', 'string', 'max:255'],
            'vehicle_notes' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.corte_bobina_usage_id' => ['nullable', 'integer', 'exists:corte_bobina_usages,id'],
            'lines.*.work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'lines.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'lines.*.description' => ['nullable', 'string', 'max:512'],
            'lines.*.quantity_kg' => ['required', 'numeric', 'min:0'],
            'lines.*.pallet_code' => ['nullable', 'string', 'max:64'],
            'lines.*.bobbin_count' => ['nullable', 'integer', 'min:1', 'max:100000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $lines = $this->input('lines', []);
            if (! is_array($lines)) {
                return;
            }
            foreach ($lines as $i => $line) {
                if (! is_array($line)) {
                    continue;
                }
                $cid = isset($line['corte_bobina_usage_id']) ? (int) $line['corte_bobina_usage_id'] : null;
                if ($cid === null) {
                    continue;
                }
                $usage = CorteBobinaUsage::query()->find($cid);
                if (! $usage) {
                    continue;
                }
                if (isset($line['work_order_id']) && (int) $line['work_order_id'] !== (int) $usage->work_order_id) {
                    $validator->errors()->add(
                        'lines.'.$i.'.work_order_id',
                        'La OT de la línea debe coincidir con la línea de corte #'.$cid.'.',
                    );
                }
            }
        });
    }
}
