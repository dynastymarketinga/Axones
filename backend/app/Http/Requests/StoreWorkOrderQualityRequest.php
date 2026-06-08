<?php

/**
 * Calidad — request desactivado (UI: Próximamente). Descomentar al reactivar API.
 */

/*
namespace App\Http\Requests;

use App\Enums\QualityOutcome;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorkOrderQualityRequest extends FormRequest
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
            'outcome' => ['required', 'string', Rule::in(QualityOutcome::values())],
            'notes' => ['nullable', 'string', 'max:10000'],
            'certificate_body' => ['nullable', 'string', 'max:65000'],
        ];
    }
}
*/
