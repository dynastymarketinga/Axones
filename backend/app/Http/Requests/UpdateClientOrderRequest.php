<?php

namespace App\Http\Requests;

use App\Enums\ClientOrderStatus;
use App\Models\ClientOrder;
use App\Models\Product;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClientOrderRequest extends FormRequest
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
            'status' => ['sometimes', 'string', Rule::in(ClientOrderStatus::values())],
            'ordered_at' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'lines' => ['sometimes', 'array'],
            'lines.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'lines.*.material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'lines.*.description' => ['nullable', 'string', 'max:512'],
            'lines.*.quantity' => ['required_with:lines', 'numeric', 'min:0.001'],
            'lines.*.unit' => ['nullable', 'string', 'max:16'],
            'lines.*.notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (! $this->has('lines')) {
                return;
            }
            /** @var ClientOrder|null $order */
            $order = $this->route('client_order');
            if (! $order instanceof ClientOrder) {
                return;
            }
            $clientId = (int) $order->client_id;
            $lines = $this->input('lines', []);
            if (! is_array($lines)) {
                return;
            }
            foreach ($lines as $i => $line) {
                if (! is_array($line)) {
                    continue;
                }
                $pid = isset($line['product_id']) ? (int) $line['product_id'] : null;
                $mid = isset($line['material_id']) ? (int) $line['material_id'] : null;
                $desc = isset($line['description']) ? trim((string) $line['description']) : '';
                if ($pid === null && $desc === '' && $mid === null) {
                    $validator->errors()->add(
                        'lines.'.$i,
                        'Cada línea debe incluir product_id, material_id o descripción.',
                    );

                    continue;
                }
                if ($pid !== null) {
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
