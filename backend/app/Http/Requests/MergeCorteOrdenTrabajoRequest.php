<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class MergeCorteOrdenTrabajoRequest extends FormRequest
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
                if (! self::isCorteControlKey((string) $key)) {
                    $v->errors()->add(
                        'form',
                        'Solo se permiten campos del control de corte (prefijo cor / métricas Corte).',
                    );

                    return;
                }
            }
        });
    }

    public static function isCorteControlKey(string $key): bool
    {
        if ($key === '') {
            return false;
        }

        if (str_starts_with($key, 'cor') || str_starts_with($key, 'cor_')) {
            return true;
        }

        return str_contains($key, 'Corte');
    }
}
