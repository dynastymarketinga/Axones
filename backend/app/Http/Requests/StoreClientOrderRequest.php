<?php

namespace App\Http\Requests;

use App\Enums\ClientOrderStatus;
use App\Models\Product;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreClientOrderRequest extends FormRequest
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
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'code' => ['nullable', 'string', 'max:64', Rule::unique('client_orders', 'code')],
            'status' => ['nullable', 'string', Rule::in(ClientOrderStatus::values())],
            'ordered_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'lines' => ['nullable', 'array'],
            'lines.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'lines.*.material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'lines.*.material_imprimir_id' => ['nullable', 'integer', 'exists:materials,id'],   // <-- AÑADIDO
            'lines.*.material_laminar_id' => ['nullable', 'integer', 'exists:materials,id'],    // <-- AÑADIDO
            'lines.*.material_trilaminar_id' => ['nullable', 'integer', 'exists:materials,id'], // <-- AÑADIDO
            'lines.*.description' => ['nullable', 'string', 'max:512'],
            'lines.*.quantity' => ['required_with:lines', 'numeric', 'min:0.001'],
            'lines.*.unit' => ['nullable', 'string', 'max:16'],
            'lines.*.notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $lines = $this->input('lines');
            if (! is_array($lines) || $lines === []) {
                return;
            }
            $clientId = (int) $this->input('client_id');
            foreach ($lines as $i => $line) {
                if (! is_array($line)) {
                    continue;
                }
                $pid = isset($line['product_id']) && $line['product_id'] !== '' && $line['product_id'] !== null
                    ? (int) $line['product_id']
                    : null;
                $mid = isset($line['material_id']) && $line['material_id'] !== '' && $line['material_id'] !== null
                    ? (int) $line['material_id']
                    : null;
                
                // Atrapamos los nuevos para la validación
                $mImp = isset($line['material_imprimir_id']) && $line['material_imprimir_id'] !== '' && $line['material_imprimir_id'] !== null
                    ? (int) $line['material_imprimir_id'] : null;
                $mLam = isset($line['material_laminar_id']) && $line['material_laminar_id'] !== '' && $line['material_laminar_id'] !== null
                    ? (int) $line['material_laminar_id'] : null;
                $mTri = isset($line['material_trilaminar_id']) && $line['material_trilaminar_id'] !== '' && $line['material_trilaminar_id'] !== null
                    ? (int) $line['material_trilaminar_id'] : null;

                $desc = trim((string) ($line['description'] ?? ''));

                $hasProduct = $pid !== null && $pid > 0;
                $hasMaterial = ($mid !== null && $mid > 0) || ($mImp !== null && $mImp > 0) || ($mLam !== null && $mLam > 0) || ($mTri !== null && $mTri > 0);
                $hasDescription = $desc !== '';

                if (! $hasProduct && ! $hasMaterial && ! $hasDescription) {
                    $validator->errors()->add(
                        'lines.'.$i,
                        'Cada línea debe incluir un producto, un material o una descripción.',
                    );

                    continue;
                }

                if ($hasProduct) {
                    $product = Product::query()->find($pid);
                    if ($product && $product->client_id !== null && (int) $product->client_id !== $clientId) {
                        $validator->errors()->add(
                            'lines.'.$i.'.product_id',
                            'El producto no pertenece al cliente del pedido.',
                        );
                    }
                }
            }
        });
    }
}