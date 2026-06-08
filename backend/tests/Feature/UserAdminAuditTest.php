<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserAdminEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAdminAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_boss_actions_create_audit_events(): void
    {
        $boss = User::factory()->create(['role' => 'boss', 'username' => 'boss_audit']);
        $token = $boss->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $create = $this->postJson('/api/users', [
            'name' => 'Operador',
            'email' => 'operador@test.local',
            'username' => 'operador_audit',
            'role' => 'corte',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ], $headers)->assertCreated();

        $id = (int) $create->json('id');

        $this->assertDatabaseHas('user_admin_events', [
            'actor_user_id' => $boss->getKey(),
            'target_user_id' => $id,
            'event_type' => 'created',
        ]);

        $this->patchJson("/api/users/{$id}", [
            'role' => 'tintas',
        ], $headers)->assertOk();

        $this->assertDatabaseHas('user_admin_events', [
            'target_user_id' => $id,
            'event_type' => 'updated',
        ]);

        $this->patchJson("/api/users/{$id}", ['active' => false], $headers)->assertOk();

        $this->assertDatabaseHas('user_admin_events', [
            'target_user_id' => $id,
            'event_type' => 'deactivated',
        ]);

        $this->patchJson("/api/users/{$id}/password", [
            'password' => 'resetpass123',
            'password_confirmation' => 'resetpass123',
        ], $headers)->assertOk();

        $this->assertDatabaseHas('user_admin_events', [
            'target_user_id' => $id,
            'event_type' => 'password_changed_admin',
        ]);
    }

    public function test_boss_can_list_user_admin_events(): void
    {
        $boss = User::factory()->create(['role' => 'boss', 'username' => 'boss_list']);
        $target = User::factory()->create(['role' => 'inventory', 'username' => 'inv_list']);
        UserAdminEvent::query()->create([
            'actor_user_id' => $boss->getKey(),
            'target_user_id' => $target->getKey(),
            'event_type' => 'created',
            'metadata' => ['role' => 'inventory'],
        ]);

        $token = $boss->createToken('t')->plainTextToken;

        $this->getJson('/api/user-admin-events', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.0.event_type', 'created')
            ->assertJsonPath('data.0.target.id', $target->getKey());
    }

    public function test_non_boss_cannot_list_user_admin_events(): void
    {
        $inventory = User::factory()->create(['role' => 'inventory', 'username' => 'inv_no_audit']);
        $token = $inventory->createToken('t')->plainTextToken;

        $this->getJson('/api/user-admin-events', ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }
}
