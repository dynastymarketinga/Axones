<?php

namespace App\Http\Requests;

use App\Enums\DeliveryNoteStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateDeliveryNoteRequest extends FormRequest
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
            'document_date' => ['nullable', 'date'],
            'driver_name' => ['nullable', 'string', 'max:255'],
            'vehicle_notes' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $note = $this->route('delivery_note');
            if ($note && $note->status !== DeliveryNoteStatus::Draft->value) {
                $validator->errors()->add('status', 'Solo se puede editar una nota en borrador.');
            }
        });
    }
}
