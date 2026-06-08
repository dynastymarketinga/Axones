<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use App\Services\UserAdminAuditService;
use App\Support\BossAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        private readonly UserAdminAuditService $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! BossAccess::allows($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $query = User::query()->orderByDesc('created_at');

        if (($active = $request->query('active')) !== null && $active !== '') {
            $query->where('active', filter_var($active, FILTER_VALIDATE_BOOLEAN));
        }

        if (($raw = trim((string) $request->query('q', ''))) !== '') {
            $escaped = addcslashes($raw, '%_\\');
            $query->where(function ($w) use ($escaped) {
                $w->where('name', 'like', '%'.$escaped.'%')
                    ->orWhere('email', 'like', '%'.$escaped.'%')
                    ->orWhere('username', 'like', '%'.$escaped.'%')
                    ->orWhere('role', 'like', '%'.$escaped.'%');
            });
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 200)));
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $actor = $request->user();
        if (! BossAccess::allows($actor)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $payload = $request->validated();
        $payload['active'] = true;

        $user = User::query()->create($payload);

        $this->audit->record($actor, $user, 'created', [
            'role' => $user->role,
            'username' => $user->username,
        ], $request);

        return response()->json($this->serializeUser($user), 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        if (! BossAccess::allows($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        return response()->json($this->serializeUser($user));
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $actor = $request->user();
        if (! BossAccess::allows($actor)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $payload = $request->validated();

        if (array_key_exists('active', $payload) && $payload['active'] === false) {
            if ((int) $actor->getKey() === (int) $user->getKey()) {
                return response()->json([
                    'message' => 'No puede desactivar su propia cuenta.',
                ], 422);
            }
        }

        $before = $this->snapshotForAudit($user);
        $user->update($payload);
        $fresh = $user->fresh();
        $after = $this->snapshotForAudit($fresh);

        $changes = $this->audit->diffFields($before, $after, ['name', 'email', 'username', 'role', 'active']);

        if ($changes !== []) {
            $eventType = 'updated';
            if (isset($changes['active'])) {
                $eventType = ($changes['active']['to'] ?? false) ? 'activated' : 'deactivated';
            }
            $this->audit->record($actor, $fresh, $eventType, ['changes' => $changes], $request);
        }

        if (array_key_exists('active', $payload) && $payload['active'] === false) {
            $user->tokens()->delete();
        }

        return response()->json($this->serializeUser($fresh));
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshotForAudit(User $user): array
    {
        return [
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'role' => $user->role ?? 'general',
            'active' => (bool) ($user->active ?? true),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'role' => $user->role ?? 'general',
            'active' => (bool) ($user->active ?? true),
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }
}
