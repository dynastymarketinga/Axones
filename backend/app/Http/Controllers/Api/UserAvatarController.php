<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\UserAvatarService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserAvatarController extends Controller
{
    public function __construct(
        private readonly UserAvatarService $avatars,
    ) {}

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'avatar' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
        ], [
            'avatar.required' => 'Seleccione una imagen.',
            'avatar.image' => 'El archivo debe ser una imagen.',
            'avatar.mimes' => 'Formatos permitidos: JPEG, PNG o WebP.',
            'avatar.max' => 'La imagen no debe superar 2 MB.',
        ]);

        $fresh = $this->avatars->store($user, $data['avatar']);

        return response()->json([
            'message' => 'Foto de perfil actualizada.',
            'user' => $fresh->toAuthArray(),
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $fresh = $this->avatars->destroy($user);

        return response()->json([
            'message' => 'Foto de perfil eliminada.',
            'user' => $fresh->toAuthArray(),
        ]);
    }
}
