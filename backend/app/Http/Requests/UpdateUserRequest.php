<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\SpanishMultilineValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
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
        $userId = (int) ($this->route('user')?->id ?? 0);

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'username' => [
                'sometimes',
                'string',
                'max:64',
                'regex:/^[a-zA-Z0-9_.-]+$/',
                Rule::unique('users', 'username')->ignore($userId),
            ],
            'role' => ['sometimes', 'string', 'max:32', Rule::in(StoreUserRequest::allowedRoles())],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Este correo ya está registrado.',
            'username.unique' => 'Este nombre de usuario ya existe.',
            'username.regex' => 'El usuario solo puede incluir letras, números, punto, guion y guion bajo.',
            'role.in' => 'Rol no permitido.',
        ];
    }
}
