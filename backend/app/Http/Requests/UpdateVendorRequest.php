<?php

namespace App\Http\Requests;

use App\Models\Vendor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVendorRequest extends FormRequest
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
        /** @var Vendor|null $vendor */
        $vendor = $this->route('vendor');

        return [
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('vendors', 'name')->ignore($vendor?->getKey()),
            ],
            'active' => ['nullable', 'boolean'],
        ];
    }
}

