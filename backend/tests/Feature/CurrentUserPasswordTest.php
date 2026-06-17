<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CreatesAccountAdmins;
use Tests\TestCase;

class CurrentUserPasswordTest extends TestCase
{
    use CreatesAccountAdmins;
    use RefreshDatabase;

    public function test_plant_user_cannot_change_own_password(): void
    {
        $user = User::factory()->create([
            'role' => 'corte',
            'username' => 'corte_pwd',
            'password' => 'oldpassword123',
        ]);
        $token = $user->createToken('t')->plainTextToken;

        $this->patchJson('/api/user/password', [
            'current_password' => 'oldpassword123',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }

    public function test_account_admin_can_change_own_password(): void
    {
        $user = $this->createVictor(['password' => 'oldpassword123']);
        $token = $user->createToken('t')->plainTextToken;

        $this->patchJson('/api/user/password', [
            'current_password' => 'oldpassword123',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('requires_relogin', true);

        $this->assertDatabaseHas('user_admin_events', [
            'actor_user_id' => $user->getKey(),
            'target_user_id' => $user->getKey(),
            'event_type' => 'password_changed_self',
        ]);

        $this->postJson('/api/auth/login', [
            'login' => 'Desarrollador',
            'password' => 'newpassword123',
        ])->assertOk();
    }

    public function test_self_password_change_rejects_wrong_current_password(): void
    {
        $user = $this->createValeria(['password' => 'password123']);
        $token = $user->createToken('t')->plainTextToken;

        $this->patchJson('/api/user/password', [
            'current_password' => 'wrong',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password']);
    }
}
