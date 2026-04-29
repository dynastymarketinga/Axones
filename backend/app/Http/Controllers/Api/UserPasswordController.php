<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PasswordResetRequest;
use App\Models\User;
use App\Support\BossAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class UserPasswordController extends Controller
{
    public function update(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        if (! BossAccess::allows($actor)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        $user->password = $data['password'];
        $user->save();
        $user->tokens()->delete();

        PasswordResetRequest::query()
            ->where('user_id', $user->getKey())
            ->where('status', PasswordResetRequest::STATUS_PENDING)
            ->update([
                'status' => PasswordResetRequest::STATUS_RESOLVED,
                'resolved_by' => $actor->getKey(),
                'resolved_at' => now(),
            ]);

        return response()->json([
            'message' => 'Contraseña actualizada.',
            'user' => [
                'id' => $user->getKey(),
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role ?? 'general',
            ],
        ]);
    }
}
