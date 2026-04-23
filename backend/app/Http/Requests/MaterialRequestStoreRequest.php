<?php

namespace App\Http\Requests;

use App\Enums\MaterialRequestDestinationArea;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MaterialRequestStoreRequest extends FormRequest
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
            'work_order_id' => ['required', 'integer', 'exists:work_orders,id'],
            'document_date' => ['nullable', 'date'],
            'originating_area' => ['nullable', 'string', 'max:32'],
            'destination_areas' => ['nullable', 'array'],
            'destination_areas.*' => ['string', Rule::in(MaterialRequestDestinationArea::values())],
            'machine_code' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'lines.*.description' => ['nullable', 'string', 'max:512'],
            'lines.*.unit' => ['nullable', 'string', 'max:16'],
            'lines.*.quantity_requested' => ['required', 'numeric', 'min:0.001'],
        ];
    }
}
