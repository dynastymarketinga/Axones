<?php

namespace App\Http\Requests;

use App\Enums\AreaRequestStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFacilityAreaRequest extends FormRequest
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
            'area' => ['required', 'string', 'max:32'],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:10000'],
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'status' => ['sometimes', 'string', Rule::in(AreaRequestStatus::values())],
        ];
    }
}
