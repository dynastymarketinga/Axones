<?php

namespace App\Http\Requests;

use App\Enums\ClientOrderStatus;
use App\Enums\WorkOrderStatus;
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
            'client_id' => ['sometimes', 'integer', 'exists:clients,id'],
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
            /** @var ClientOrder|null $order */
            $order = $this->route('client_order');
            if (! $order instanceof ClientOrder) {
                return;
            }

            $effectiveClientIdForLines = $this->has('client_id')
                ? (int) $this->input('client_id')
                : (int) $order->client_id;

            if ($this->has('client_id')) {
                $newId = (int) $this->input('client_id');
                if ($newId !== (int) $order->client_id) {
                    if ($order->status !== ClientOrderStatus::Open->value) {
                        $validator->errors()->add(
                            'client_id',
                            'Solo puede cambiar el cliente cuando la orden está abierta.',
                        );
                    } elseif ($order->workOrders()->where('status', '!=', WorkOrderStatus::Cancelled->value)->exists()) {
                        $validator->errors()->add(
                            'client_id',
                            'No puede cambiar el cliente mientras existan órdenes de trabajo activas vinculadas a este pedido.',
                        );
                    } elseif (! $this->has('lines')) {
                        foreach ($order->lines()->whereNotNull('product_id')->cursor() as $line) {
                            $product = Product::query()->find((int) $line->product_id);
                            if ($product && $product->client_id !== null && (int) $product->client_id !== $newId) {
                                $validator->errors()->add(
                                    'client_id',
                                    'Las líneas incluyen un producto que no pertenece al nuevo cliente.',
                                );
                                break;
                            }
                        }
                    }
                }
            }

            if (! $this->has('lines')) {
                return;
            }

            $lines = $this->input('lines', []);
            if (! is_array($lines)) {
                return;
            }
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
                $desc = trim((string) ($line['description'] ?? ''));

                $hasProduct = $pid !== null && $pid > 0;
                $hasMaterial = $mid !== null && $mid > 0;
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
                    if ($product && $product->client_id !== null && (int) $product->client_id !== $effectiveClientIdForLines) {
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
