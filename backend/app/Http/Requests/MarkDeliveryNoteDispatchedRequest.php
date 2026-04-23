<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MarkDeliveryNoteDispatchedRequest extends FormRequest
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
            'driver_name' => ['nullable', 'string', 'max:255'],
            'vehicle_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
