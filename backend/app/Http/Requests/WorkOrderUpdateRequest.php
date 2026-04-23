<?php

namespace App\Http\Requests;

use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use App\Models\WorkOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WorkOrderUpdateRequest extends FormRequest
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
}
