<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateBobinaRequest extends FormRequest
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
        $bobina = $this->route('bobina');
        $id = $bobina?->getKey() ?? 0;

        return [
            'material_id' => ['sometimes', 'integer', 'exists:materials,id'],
            'code' => ['sometimes', 'string', 'max:64', Rule::unique('bobinas', 'code')->ignore($id)],
            'weight_kg' => ['sometimes', 'numeric', 'min:0.001'],
            'status' => ['sometimes', 'string', Rule::in(['available', 'issued', 'consumed', 'rejected'])],
            'change_reason' => ['nullable', 'string', 'min:5', 'max:500'],
            'request_approval' => ['nullable', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $bobina = $this->route('bobina');
            if (! $bobina) {
                return;
            }

            $critical = ['material_id', 'code', 'weight_kg', 'status'];
            $hasCriticalChange = false;
            foreach ($critical as $field) {
                if (! $this->exists($field)) {
                    continue;
                }
                if ((string) $this->input($field) !== (string) $bobina->getAttribute($field)) {
                    $hasCriticalChange = true;
                    break;
                }
            }

            if ($hasCriticalChange && trim((string) $this->input('change_reason', '')) === '') {
                $validator->errors()->add('change_reason', 'Debe indicar una razón.');
            }
        });
    }
}
