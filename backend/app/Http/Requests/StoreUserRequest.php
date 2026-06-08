<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\SpanishMultilineValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'username' => [
                'required',
                'string',
                'max:64',
                'regex:/^[a-zA-Z0-9_.-]+$/',
                Rule::unique('users', 'username'),
            ],
            'role' => ['required', 'string', 'max:32', Rule::in($this->allowedRoles())],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ];
    }

    /**
     * @return list<string>
     */
    public static function allowedRoles(): array
    {
        return [
            'boss',
            'admin',
            'superadmin',
            'jefe_supremo',
            'jefe_operaciones',
            'inventory',
            'inventario',
            'inventory_chief',
            'jefe_inventario',
            'jefe_almacen',
            'impresion',
            'printing',
            'laminacion',
            'corte',
            'tintas',
            'montaje',
            'calidad',
            'quality',
            'vigilancia',
            'gate',
            'solicitante',
            'admin_area',
            'administracion',
            'planificador',
            'supervisor',
            'general',
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
