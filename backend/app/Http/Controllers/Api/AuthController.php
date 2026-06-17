<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate(
            [
                'login' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9_.-]+$/'],
                'password' => ['required', 'string'],
            ],
            [
                'login.required' => 'El usuario es obligatorio.',
                'login.max' => 'El usuario no debe superar 64 caracteres.',
                'login.regex' => 'El usuario solo puede incluir letras, números, punto, guion y guion bajo.',
                'password.required' => 'La contraseña es obligatoria.',
            ]
        );

        $login = trim($credentials['login']);
        $user = User::findByLogin($login);

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Credenciales incorrectas.'],
            ]);
        }

        if (isset($user->active) && ! $user->active) {
            throw ValidationException::withMessages([
                'login' => ['Esta cuenta está desactivada. Contacte a un administrador.'],
            ]);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->toAuthArray(),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        if (! app()->environment('local')) {
            abort(404);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Sesión cerrada.']);
    }
}
