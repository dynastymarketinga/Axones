<?php

namespace App\Http\Controllers\Api;

use App\Enums\AlertSeverity;
use App\Http\Controllers\Controller;
use App\Models\OperationalAlert;
use App\Models\PasswordResetRequest;
use App\Models\User;
use App\Services\UserAdminAuditService;
use App\Support\BossAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PasswordResetRequestController extends Controller
{
    public function __construct(
        private readonly UserAdminAuditService $audit,
    ) {}
    /**
     * Solicitud anónima (notificación interna, sin correo).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(
            [
                'login' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9_.-]+$/'],
            ],
            [
                'login.required' => 'El usuario es obligatorio.',
                'login.max' => 'El usuario no debe superar 64 caracteres.',
                'login.regex' => 'El usuario solo puede incluir letras, números, punto, guion y guion bajo.',
            ]
        );

        $login = trim($data['login']);
        $user = User::findByLogin($login);

        if ($user !== null) {
            $recentPending = PasswordResetRequest::query()
                ->where('user_id', $user->getKey())
                ->where('status', PasswordResetRequest::STATUS_PENDING)
                ->where('created_at', '>', now()->subDay())
                ->exists();

            if (! $recentPending) {
                DB::transaction(function () use ($user): void {
                    $prRequest = PasswordResetRequest::query()->create([
                        'user_id' => $user->getKey(),
                        'status' => PasswordResetRequest::STATUS_PENDING,
                    ]);

                    $identifier = (string) $user->username;
                    OperationalAlert::query()->create([
                        'alert_type' => 'password_reset_requested',
                        'severity' => AlertSeverity::Warning->value,
                        'message' => sprintf(
                            'Solicitud de restablecimiento de contraseña: %s (%s)',
                            $user->name,
                            $identifier,
                        ),
                        'work_order_id' => null,
                        'material_id' => null,
                        'metadata' => [
                            'password_reset_request_id' => $prRequest->getKey(),
                            'target_user_id' => $user->getKey(),
                        ],
                        'created_by' => null,
                    ]);
                });
            }
        }

        return response()->json([
            'message' => 'Si la cuenta existe, se notificará a un administrador en el sistema.',
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (! BossAccess::allows($actor)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $query = PasswordResetRequest::query()
            ->with(['user:id,name,email,username,role', 'resolver:id,name'])
            ->where('status', PasswordResetRequest::STATUS_PENDING)
            ->orderByDesc('created_at');

        return response()->json($query->paginate(min((int) $request->query('per_page', 30), 100)));
    }

    public function resolve(Request $request, PasswordResetRequest $password_reset_request): JsonResponse
    {
        $actor = $request->user();
        if (! BossAccess::allows($actor)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($password_reset_request->status !== PasswordResetRequest::STATUS_PENDING) {
            return response()->json(['message' => 'La solicitud ya está cerrada.'], 422);
        }

        $password_reset_request->update([
            'status' => PasswordResetRequest::STATUS_RESOLVED,
            'resolved_by' => $actor->getKey(),
            'resolved_at' => now(),
            'notes' => $request->input('notes'),
        ]);

        $fresh = $password_reset_request->fresh()->load(['user:id,name,email,username,role', 'resolver:id,name']);
        $target = $fresh->user;
        if ($target instanceof User) {
            $this->audit->record($actor, $target, 'password_reset_resolved', [
                'password_reset_request_id' => $fresh->getKey(),
            ], $request);
        }

        return response()->json($fresh);
    }
}
