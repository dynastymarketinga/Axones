<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserAdminEvent;
use Illuminate\Http\Request;

class UserAdminAuditService
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function record(
        ?User $actor,
        User $target,
        string $eventType,
        array $metadata = [],
        ?Request $request = null,
    ): UserAdminEvent {
        if ($request !== null) {
            $metadata['ip'] = $request->ip();
        }

        return UserAdminEvent::query()->create([
            'actor_user_id' => $actor?->getKey(),
            'target_user_id' => $target->getKey(),
            'event_type' => $eventType,
            'metadata' => $metadata === [] ? null : $metadata,
        ]);
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return array<string, array{from: mixed, to: mixed}>
     */
    public function diffFields(array $before, array $after, array $fields): array
    {
        $changes = [];
        foreach ($fields as $field) {
            $from = $before[$field] ?? null;
            $to = $after[$field] ?? null;
            if ((string) $from !== (string) $to) {
                $changes[$field] = ['from' => $from, 'to' => $to];
            }
        }

        return $changes;
    }
}
