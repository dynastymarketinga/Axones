<?php

namespace Tests\Feature;

use App\Models\AssistantMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AssistantApiTest extends TestCase
{
    use RefreshDatabase;

    private function authHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    private function enableAssistant(string $apiKey = 'test-key', string $provider = 'anthropic'): void
    {
        config([
            'axones.assistant.enabled' => true,
            'axones.assistant.provider' => $provider,
            'axones.assistant.anthropic_api_key' => $apiKey,
            'axones.assistant.allowed_roles' => ['boss', 'admin', 'jefe_supremo', 'superadmin', 'jefe_operaciones', 'planificador', 'supervisor'],
            'axones.assistant.daily_limit_per_user' => 50,
            'axones.assistant.max_tokens' => 1024,
            'axones.assistant.timeout_seconds' => 10,
            'axones.assistant.model' => 'claude-3-5-haiku-latest',
            'axones.assistant.analysis_model' => 'claude-sonnet-4-20250514',
        ]);
    }

    private function enableLocalAssistant(): void
    {
        $this->enableAssistant(apiKey: '', provider: 'local');
    }

    public function test_status_returns_disabled_when_flag_off(): void
    {
        config(['axones.assistant.enabled' => false]);
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_st']);

        $res = $this->getJson('/api/assistant/status', $this->authHeaders($user));
        $res->assertOk()->assertJson([
            'enabled' => false,
            'allowed' => false,
        ]);
    }

    public function test_status_returns_allowed_for_boss_when_enabled(): void
    {
        $this->enableAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_ok']);

        $res = $this->getJson('/api/assistant/status', $this->authHeaders($user));
        $res->assertOk()->assertJsonPath('enabled', true)
            ->assertJsonPath('allowed', true)
            ->assertJsonPath('tools_count', 15)
            ->assertJsonPath('rate_limit.limit', 50)
            ->assertJsonPath('rate_limit.used', 0);
    }

    public function test_status_blocks_role_not_in_allowed_list(): void
    {
        $this->enableAssistant();
        config(['axones.assistant.allowed_roles' => ['planificador']]);
        $user = User::factory()->create(['role' => 'corte', 'username' => 'corte_nope']);

        $res = $this->getJson('/api/assistant/status', $this->authHeaders($user));
        $res->assertOk()->assertJsonPath('enabled', true)
            ->assertJsonPath('allowed', false);
    }

    public function test_chat_rejects_when_flag_off(): void
    {
        config(['axones.assistant.enabled' => false]);
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_chat_off']);
        $res = $this->postJson('/api/assistant/chat', ['message' => 'hola'], $this->authHeaders($user));
        $res->assertForbidden()->assertJsonPath('code', 'assistant_disabled');
    }

    public function test_chat_simple_round_trip_with_no_tool_use(): void
    {
        $this->enableAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_chat_ok']);

        Http::fake([
            'https://api.anthropic.com/*' => Http::response([
                'id' => 'msg_test1',
                'type' => 'message',
                'model' => 'claude-3-5-haiku-latest',
                'role' => 'assistant',
                'stop_reason' => 'end_turn',
                'usage' => ['input_tokens' => 42, 'output_tokens' => 13],
                'content' => [
                    ['type' => 'text', 'text' => 'Estoy en línea y listo.'],
                ],
            ], 200),
        ]);

        $res = $this->postJson('/api/assistant/chat', [
            'message' => 'Hola, ¿estás ahí?',
        ], $this->authHeaders($user));

        $res->assertOk()
            ->assertJsonPath('assistant_message', 'Estoy en línea y listo.')
            ->assertJsonPath('model_used', 'claude-3-5-haiku-latest')
            ->assertJsonPath('rate_limit.used', 1)
            ->assertJsonStructure(['dots', 'follow_up_chips', 'tools_used', 'duration_ms']);

        $stored = AssistantMessage::query()->first();
        $this->assertNotNull($stored);
        $this->assertSame('Estoy en línea y listo.', $stored->assistant_message);
        $this->assertSame('ok', $stored->status);
    }

    public function test_chat_uses_tool_then_returns_final_text(): void
    {
        $this->enableAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_chat_tool']);

        Http::fake([
            'https://api.anthropic.com/*' => Http::sequence()
                ->push([
                    'id' => 'msg_t1',
                    'type' => 'message',
                    'model' => 'claude-3-5-haiku-latest',
                    'role' => 'assistant',
                    'stop_reason' => 'tool_use',
                    'usage' => ['input_tokens' => 100, 'output_tokens' => 20],
                    'content' => [
                        ['type' => 'tool_use', 'id' => 'tu_ping', 'name' => 'axones_ping', 'input' => new \stdClass()],
                    ],
                ])
                ->push([
                    'id' => 'msg_t2',
                    'type' => 'message',
                    'model' => 'claude-3-5-haiku-latest',
                    'role' => 'assistant',
                    'stop_reason' => 'end_turn',
                    'usage' => ['input_tokens' => 30, 'output_tokens' => 10],
                    'content' => [
                        ['type' => 'text', 'text' => 'La API responde sin problemas.'],
                    ],
                ]),
        ]);

        $res = $this->postJson('/api/assistant/chat', [
            'message' => '¿Está viva la API?',
        ], $this->authHeaders($user));

        $res->assertOk()
            ->assertJsonPath('assistant_message', 'La API responde sin problemas.')
            ->assertJsonPath('tools_used.0.name', 'axones_ping')
            ->assertJsonPath('tools_used.0.ok', true);
    }

    public function test_chat_returns_429_when_rate_limit_exceeded(): void
    {
        $this->enableAssistant();
        config(['axones.assistant.daily_limit_per_user' => 1]);
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_chat_429']);

        AssistantMessage::query()->create([
            'user_id' => $user->id,
            'user_role' => 'boss',
            'user_message' => 'previa',
            'assistant_message' => 'previa',
            'status' => 'ok',
            'duration_ms' => 10,
        ]);

        $res = $this->postJson('/api/assistant/chat', [
            'message' => 'otra',
        ], $this->authHeaders($user));

        $res->assertStatus(429)->assertJsonPath('code', 'rate_limited');
    }

    public function test_chat_returns_502_when_provider_fails(): void
    {
        $this->enableAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_chat_provider']);
        Http::fake([
            'https://api.anthropic.com/*' => Http::response([
                'error' => ['message' => 'fallo simulado'],
            ], 500),
        ]);
        $res = $this->postJson('/api/assistant/chat', [
            'message' => 'algo',
        ], $this->authHeaders($user));
        $res->assertStatus(502)->assertJsonPath('code', 'provider_error');
    }

    public function test_suggestions_returns_chips(): void
    {
        $this->enableAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_chips']);
        $res = $this->getJson('/api/assistant/suggestions?route=/alertas', $this->authHeaders($user));
        $res->assertOk()->assertJsonPath('ok', true)
            ->assertJsonStructure(['ok', 'data' => ['chips'], 'follow_up_chips']);
    }

    public function test_chat_local_runs_tool_directly_without_provider(): void
    {
        $this->enableLocalAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_local_tool']);

        Http::fake([
            '*' => Http::response(['service' => 'axones-api', 'ok' => true], 200),
        ]);

        $res = $this->postJson('/api/assistant/chat', [
            'message' => 'Resumen del dashboard',
            'tool' => 'axones_ping',
        ], $this->authHeaders($user));

        $res->assertOk()
            ->assertJsonPath('model_used', 'axones-local')
            ->assertJsonPath('tools_used.0.name', 'axones_ping')
            ->assertJsonPath('tools_used.0.ok', true)
            ->assertJsonPath('input_tokens', null);

        Http::assertNothingSent();
    }

    public function test_chat_local_resolves_dashboard_keyword(): void
    {
        $this->enableLocalAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_local_kw']);

        Http::fake([
            '*/api/dashboard/summary*' => Http::response([
                'active_work_orders' => 3,
                'pending_alerts' => 1,
                'pending_material_requests' => 2,
            ], 200),
        ]);

        $res = $this->postJson('/api/assistant/chat', [
            'message' => '¿Cómo va el dashboard?',
        ], $this->authHeaders($user));

        $res->assertOk()
            ->assertJsonPath('model_used', 'axones-local')
            ->assertJsonPath('tools_used.0.name', 'axones_dashboard_summary')
            ->assertJsonPath('tools_used.0.ok', true);
    }

    public function test_chat_local_fallback_returns_suggestions(): void
    {
        $this->enableLocalAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_local_fb']);

        $res = $this->postJson('/api/assistant/chat', [
            'message' => 'xyzqwerty sin sentido',
            'context' => ['route' => '/alertas'],
        ], $this->authHeaders($user));

        $res->assertOk()
            ->assertJsonPath('model_used', 'axones-local')
            ->assertJsonPath('tools_used', [])
            ->assertJsonStructure(['assistant_message', 'follow_up_chips']);
        $this->assertNotEmpty($res->json('follow_up_chips'));
    }

    public function test_chat_local_greeting_returns_welcome(): void
    {
        $this->enableLocalAssistant();
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss_local_hi']);

        $res = $this->postJson('/api/assistant/chat', [
            'message' => 'Hola',
            'context' => ['route' => '/solicitudes-material'],
        ], $this->authHeaders($user));

        $res->assertOk()
            ->assertJsonPath('model_used', 'axones-local')
            ->assertJsonPath('tools_used', [])
            ->assertJsonFragment(['assistant_message' => 'Hola. Soy el asistente de Axones. Consulto datos reales del sistema (resumen general, alertas, inventario, solicitudes y órdenes de trabajo). Elige una sugerencia o escribe tu consulta.'])
            ->assertJsonStructure(['follow_up_chips']);
        $this->assertNotEmpty($res->json('follow_up_chips'));
    }
}
