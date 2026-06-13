<?php

namespace App\Services\Assistant;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Rate limit diario por usuario, basado en filas en assistant_messages con
 * status ok. Devuelve cuántos quedan y bloquea con excepción cuando supera.
 */
final class AssistantRateLimitService
{
    public function limit(): int
    {
        return max(0, (int) config('axones.assistant.daily_limit_per_user', 50));
    }

    public function usedToday(User $user): int
    {
        return (int) DB::table('assistant_messages')
            ->where('user_id', $user->getKey())
            ->where('status', 'ok')
            ->whereDate('created_at', now()->toDateString())
            ->count();
    }

    /** @return array{limit:int, used:int, remaining:int} */
    public function snapshot(User $user): array
    {
        $limit = $this->limit();
        $used = $this->usedToday($user);

        return ['limit' => $limit, 'used' => $used, 'remaining' => max(0, $limit - $used)];
    }

    public function check(User $user): void
    {
        $snap = $this->snapshot($user);
        if ($snap['limit'] > 0 && $snap['remaining'] <= 0) {
            throw new \App\Exceptions\Assistant\AssistantRateLimitException(
                "Has alcanzado el límite diario del asistente ({$snap['limit']} consultas).",
                used: $snap['used'],
                limit: $snap['limit'],
            );
        }
    }
}
