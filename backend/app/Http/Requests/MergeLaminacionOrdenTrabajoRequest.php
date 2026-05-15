<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class MergeLaminacionOrdenTrabajoRequest extends FormRequest
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
            'form' => ['required', 'array'],
            'origin_area' => ['sometimes', 'nullable', 'string', 'max:32'],
            'notify_on_production_save' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $form = $this->input('form');
            if (! is_array($form)) {
                return;
            }
            foreach (array_keys($form) as $key) {
                $k = (string) $key;
                if ($k !== '' && ! str_starts_with($k, 'lam')) {
                    $v->errors()->add(
                        'form',
                        'Solo se permiten campos del control de laminación (prefijo lam).',
                    );

                    return;
                }
            }
        });
    }
}
