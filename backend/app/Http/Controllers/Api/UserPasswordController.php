<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PasswordResetRequest;
use App\Models\User;
use App\Services\UserAdminAuditService;
use App\Support\BossAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class UserPasswordController extends Controller
{
    public function __construct(
        private readonly UserAdminAuditService $audit,
    ) {}

    public function updateSelf(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        if (! Hash::check($data['current_password'], (string) $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['La contraseña actual no es correcta.'],
            ]);
        }

        $user->password = $data['password'];
        $user->save();
        $user->tokens()->delete();

        $this->audit->record($user, $user, 'password_changed_self', [], $request);

        return response()->json([
            'message' => 'Contraseña actualizada. Inicie sesión de nuevo.',
            'requires_relogin' => true,
        ]);
    }

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

        $this->audit->record($actor, $user, 'password_changed_admin', [], $request);

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
