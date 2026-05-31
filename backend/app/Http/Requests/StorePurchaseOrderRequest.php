<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\SpanishMultilineValidation;
use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseOrderRequest extends FormRequest
{
    use SpanishMultilineValidation;

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
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'code' => ['required', 'string', 'max:64', 'unique:purchase_orders,code'],
            'ordered_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'tax_applies' => ['sometimes', 'boolean'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.description' => ['nullable', 'string'],
            'lines.*.material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'lines.*.quantity_ordered' => ['required', 'numeric', 'min:0.001'],
            'lines.*.unit' => ['nullable', 'string', 'max:16'],
            'lines.*.unit_price' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'supplier_id.required' => 'Seleccione un proveedor.',
            'supplier_id.integer' => 'El proveedor no es válido.',
            'supplier_id.exists' => 'El proveedor seleccionado no existe.',
            'code.required' => 'El código único es obligatorio.',
            'code.max' => 'El código no puede superar 64 caracteres.',
            'code.unique' => 'Ese código de orden ya está registrado. Use otro correlativo.',
            'ordered_at.date' => 'La fecha del pedido no es válida.',
            'notes.string' => 'Las notas deben ser texto.',
            'tax_applies.boolean' => 'El indicador de IVA no es válido.',
            'lines.required' => 'Agregue al menos una línea al pedido.',
            'lines.array' => 'Las líneas del pedido no son válidas.',
            'lines.min' => 'Agregue al menos una línea al pedido.',
            'lines.*.description.string' => 'La descripción de la línea debe ser texto.',
            'lines.*.material_id.integer' => 'El material de la línea no es válido.',
            'lines.*.material_id.exists' => 'El material seleccionado no existe.',
            'lines.*.quantity_ordered.required' => 'Indique la cantidad pedida en cada línea.',
            'lines.*.quantity_ordered.numeric' => 'La cantidad pedida debe ser un número.',
            'lines.*.quantity_ordered.min' => 'La cantidad pedida debe ser al menos 0,001.',
            'lines.*.unit.max' => 'La unidad no puede superar 16 caracteres.',
            'lines.*.unit_price.numeric' => 'El precio unitario debe ser un número.',
            'lines.*.unit_price.min' => 'El precio unitario no puede ser negativo.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'supplier_id' => 'proveedor',
            'code' => 'código único',
            'ordered_at' => 'fecha del pedido',
            'notes' => 'notas',
            'lines' => 'líneas del pedido',
            'lines.*.description' => 'descripción',
            'lines.*.material_id' => 'material',
            'lines.*.quantity_ordered' => 'cantidad pedida',
            'lines.*.unit' => 'unidad',
            'lines.*.unit_price' => 'precio unitario',
        ];
    }
}
