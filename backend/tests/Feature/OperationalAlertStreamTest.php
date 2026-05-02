<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationalAlertStreamTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_alerts_stream_requires_auth(): void
    {
        $this->getJson('/api/alerts/stream')->assertUnauthorized();
    }

    public function test_alerts_stream_returns_event_stream(): void
    {
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);

        $resp = $this->get('/api/alerts/stream', $h);

        $resp->assertOk();
        $this->assertStringContainsString('text/event-stream', (string) $resp->headers->get('content-type'));
    }
}
