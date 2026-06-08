<?php

/**
 * Vigilancia — request desactivado (UI: Próximamente). Descomentar al reactivar API.
 */

/*
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreGateMovementRequest extends FormRequest
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
            'direction' => ['required', 'string', Rule::in(['in', 'out'])],
            'notes' => ['nullable', 'string', 'max:5000'],
            'occurred_at' => ['nullable', 'date'],
            'photo' => ['nullable', 'file', 'image', 'max:5120'],
        ];
    }
}
*/
