<?php

namespace App\Http\Requests;

use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderPriority;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Product;
use App\Models\WorkOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class WorkOrderUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        if (! $this->has('status')) {
            return true;
        }

        $next = strtolower(trim((string) $this->input('status')));
        if ($next !== WorkOrderStatus::Cancelled->value) {
            return true;
        }

        $role = strtolower(trim((string) ($this->user()?->role ?? '')));

        return in_array($role, ['admin', 'boss'], true);
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('Solo admin o jefatura (boss) puede desactivar (cancelar) órdenes de trabajo.');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var WorkOrder $wo */
        $wo = $this->route('work_order');

        return [
            'client_order_reference' => ['sometimes', 'nullable', 'string', 'max:128'],
            'client_order_id' => ['sometimes', 'nullable', 'integer', 'exists:client_orders,id'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'document_number' => ['sometimes', 'nullable', 'string', 'max:32', Rule::unique('work_orders', 'document_number')->ignore($wo->getKey())],
            'document_date' => ['sometimes', 'nullable', 'date'],
            'issued_to' => ['sometimes', 'nullable', 'string', 'max:128'],
            'issued_from' => ['sometimes', 'nullable', 'string', 'max:128'],
            'authorized_by_name' => ['sometimes', 'nullable', 'string', 'max:128'],
            'authorized_by_title' => ['sometimes', 'nullable', 'string', 'max:128'],
            'production_items' => ['sometimes', 'array'],
            'production_items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'production_items.*.quantity_unit' => ['nullable', 'string', 'max:16'],
            'production_items.*.product_description' => ['required', 'string', 'max:512'],
            'production_items.*.technical_specs' => ['nullable', 'string', 'max:2000'],
            'production_items.*.position' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'status' => ['sometimes', 'string', Rule::in(WorkOrderStatus::values())],
            'scheduling_status' => ['sometimes', 'string', Rule::in(WorkOrderSchedulingStatus::values())],
            'board_stage' => ['sometimes', 'string', Rule::in(WorkOrderBoardStage::values())],
            'priority' => ['sometimes', 'string', Rule::in(WorkOrderPriority::values())],
            'client_id' => ['sometimes', 'nullable', 'integer', 'exists:clients,id'],
            'product_id' => ['sometimes', 'nullable', 'integer', 'exists:products,id'],
            'winding_figure' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:24'],
            'lines' => ['sometimes', 'array'],
            'lines.*.material_id' => ['required', 'integer', 'exists:materials,id'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'lines.*.notes' => ['nullable', 'string'],
            'auto_create_material_request' => ['sometimes', 'boolean'],
            'originating_area' => ['sometimes', 'nullable', 'string', 'max:32'],
            'material_request_notes' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            /** @var WorkOrder $wo */
            $wo = $this->route('work_order');
            if (! $wo) {
                return;
            }
            if (! $this->has('product_id')) {
                return;
            }
            $pid = $this->input('product_id');
            if ($pid === null || $pid === '') {
                return;
            }
            $newClientId = $this->has('client_id') ? $this->input('client_id') : $wo->client_id;
            if ($newClientId === null) {
                $v->errors()->add('product_id', 'Debe asignar cliente a la OT antes de elegir producto.');

                return;
            }
            $ok = Product::query()
                ->where('id', (int) $pid)
                ->where('client_id', (int) $newClientId)
                ->exists();
            if (! $ok) {
                $v->errors()->add('product_id', 'El producto no pertenece al cliente de esta orden de trabajo.');
            }
        });
    }
}
