<?php

namespace App\Http\Requests;

use App\Enums\PrintingChemicalType;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePrintingConsumablesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $chem = $this->input('chemical_usages');
            if (! is_array($chem)) {
                return;
            }
            $types = array_filter(array_map(static fn ($r) => $r['chemical_type'] ?? null, $chem));
            if (count($types) !== count(array_unique($types))) {
                $validator->errors()->add('chemical_usages', 'No repita chemical_type en el mismo envío.');
            }
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'ink_lines' => ['sometimes', 'array'],
            'ink_lines.*.material_id' => ['required', 'integer', 'exists:materials,id'],
            'ink_lines.*.quantity_original_kg' => ['nullable', 'numeric', 'min:0'],
            'ink_lines.*.quantity_solventada_kg' => ['nullable', 'numeric', 'min:0'],
            'ink_lines.*.quantity_return_kg' => ['nullable', 'numeric', 'min:0'],
            'ink_lines.*.notes' => ['nullable', 'string', 'max:5000'],
            'ink_lines.*.position' => ['nullable', 'integer', 'min:0', 'max:65535'],

            'chemical_usages' => ['sometimes', 'array'],
            'chemical_usages.*.chemical_type' => ['required', 'string', Rule::in(PrintingChemicalType::values())],
            'chemical_usages.*.quantity_loaded_kg' => ['nullable', 'numeric', 'min:0'],
            'chemical_usages.*.quantity_return_kg' => ['nullable', 'numeric', 'min:0'],
            'chemical_usages.*.notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
