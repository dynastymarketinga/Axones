<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReportInventoryAreaDailyRequest extends FormRequest
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
            'date' => ['required', 'date'],
            'inventory_area' => ['sometimes', 'nullable', 'string', Rule::in(InventoryArea::values())],
        ];
    }
}
