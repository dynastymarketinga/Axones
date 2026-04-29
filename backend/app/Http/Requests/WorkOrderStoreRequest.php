<?php

namespace App\Http\Requests;

use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WorkOrderStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        $role = strtolower(trim((string) ($this->user()?->role ?? '')));

        return ! in_array($role, ['printing', 'impresion'], true);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'code' => ['nullable', 'string', 'max:64', Rule::unique('work_orders', 'code')],
            'document_number' => ['nullable', 'string', 'max:32', Rule::unique('work_orders', 'document_number')],
            'document_date' => ['nullable', 'date'],
            'issued_to' => ['nullable', 'string', 'max:128'],
            'issued_from' => ['nullable', 'string', 'max:128'],
            'authorized_by_name' => ['nullable', 'string', 'max:128'],
            'authorized_by_title' => ['nullable', 'string', 'max:128'],
            'production_items' => ['nullable', 'array'],
            'production_items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'production_items.*.quantity_unit' => ['nullable', 'string', 'max:16'],
            'production_items.*.product_description' => ['required', 'string', 'max:512'],
            'production_items.*.technical_specs' => ['nullable', 'string', 'max:2000'],
            'production_items.*.position' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'client_order_reference' => ['nullable', 'string', 'max:128'],
            'client_order_id' => ['nullable', 'integer', 'exists:client_orders,id'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string', Rule::in(WorkOrderStatus::values())],
            'scheduling_status' => ['nullable', 'string', Rule::in(WorkOrderSchedulingStatus::values())],
            'board_stage' => ['nullable', 'string', Rule::in(WorkOrderBoardStage::values())],
            'lines' => ['nullable', 'array'],
            'lines.*.material_id' => ['required', 'integer', 'exists:materials,id'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'lines.*.notes' => ['nullable', 'string'],
            'auto_create_material_request' => ['sometimes', 'boolean'],
            'originating_area' => ['nullable', 'string', 'max:32'],
            'material_request_notes' => ['nullable', 'string'],
            'import_client_order_lines' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (! $this->boolean('import_client_order_lines')) {
                return;
            }
            if (($this->input('lines') ?? []) !== []) {
                $validator->errors()->add(
                    'lines',
                    'No envíe líneas manuales cuando import_client_order_lines es verdadero.',
                );
            }
            if (! $this->filled('client_order_id')) {
                $validator->errors()->add(
                    'client_order_id',
                    'Se requiere client_order_id para importar líneas del pedido.',
                );
            }
        });
    }
}
