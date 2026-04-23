<?php

namespace App\Http\Requests;

use App\Enums\PrintingTimeSegmentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StartMontajeTimeSegmentRequest extends FormRequest
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
            'segment_type' => ['required', 'string', Rule::in(PrintingTimeSegmentType::values())],
            'machine_code' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
