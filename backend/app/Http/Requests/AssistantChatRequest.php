<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssistantChatRequest extends FormRequest
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
            'message' => ['required', 'string', 'min:1', 'max:4000'],
            'tool' => ['sometimes', 'string', 'max:128', 'starts_with:axones_'],
            'tool_params' => ['sometimes', 'array'],
            'force_analysis' => ['sometimes', 'boolean'],
            'context' => ['sometimes', 'array'],
            'context.route' => ['sometimes', 'string', 'max:256'],
            'context.entity_type' => ['sometimes', 'string', 'max:64'],
            'context.entity_id' => ['sometimes'],
            'context.area' => ['sometimes', 'string', 'max:32'],
        ];
    }
}
