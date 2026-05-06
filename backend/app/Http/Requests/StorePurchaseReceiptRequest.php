<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StorePurchaseReceiptRequest extends FormRequest
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
            'purchase_order_id' => ['required', 'integer', 'exists:purchase_orders,id'],
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'without_purchase_order' => ['sometimes', 'boolean'],
            'exception_reason' => ['nullable', 'string'],
            'supplier_name' => ['nullable', 'string', 'max:191'],
            'invoice_number' => ['nullable', 'string', 'max:191'],
            'purchase_order_reference' => ['nullable', 'string', 'max:191'],
            'notes' => ['nullable', 'string'],
            'received_at' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.material_id' => ['required', 'integer', 'exists:materials,id'],
            'lines.*.item_type' => ['required', 'string', Rule::in(['sustrato', 'miscelaneo', 'consumible', 'tinta', 'quimico'])],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'lines.*.unit' => ['required', 'string', Rule::in(['kg', 'unidad', 'm', 'rollo'])],
            'lines.*.micras' => ['nullable', 'numeric', 'min:0.001'],
            'lines.*.ancho_mm' => ['nullable', 'numeric', 'min:0.001'],
            'lines.*.purchase_order_line_id' => ['required', 'integer', 'exists:purchase_order_lines,id'],
            // Bobina única: si se indica bobina_count, se generan N bobinas y el ingreso se registra por bobina.
            'lines.*.bobina_count' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'lines.*.bobina_weight_kg' => ['nullable', 'numeric', 'min:0.001'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->boolean('without_purchase_order')) {
                $validator->errors()->add(
                    'without_purchase_order',
                    'Las recepciones deben estar ligadas a una orden de compra.'
                );
            }

            $lines = $this->input('lines', []);
            if (! is_array($lines)) {
                return;
            }

            foreach ($lines as $index => $line) {
                $itemType = (string) ($line['item_type'] ?? '');
                $unit = (string) ($line['unit'] ?? '');
                $micras = $line['micras'] ?? null;
                $ancho = $line['ancho_mm'] ?? null;

                $requiresDimensions = $itemType === 'sustrato';
                $allowedUnits = match ($itemType) {
                    'tinta', 'quimico', 'miscelaneo' => ['kg', 'unidad'],
                    default => ['kg', 'unidad', 'm', 'rollo'],
                };

                if (! in_array($unit, $allowedUnits, true)) {
                    $validator->errors()->add(
                        "lines.$index.unit",
                        'Unidad no permitida para el tipo seleccionado.'
                    );
                }

                if ($requiresDimensions) {
                    if ($micras === null || $micras === '') {
                        $validator->errors()->add("lines.$index.micras", 'Micras es obligatorio para este tipo.');
                    }
                    if ($ancho === null || $ancho === '') {
                        $validator->errors()->add("lines.$index.ancho_mm", 'Ancho (mm) es obligatorio para este tipo.');
                    }
                } elseif (($micras !== null && $micras !== '') || ($ancho !== null && $ancho !== '')) {
                    $validator->errors()->add(
                        "lines.$index.item_type",
                        'Micras/Ancho solo aplica para tipos que manejan dimensiones.'
                    );
                }
            }
        });
    }
}
