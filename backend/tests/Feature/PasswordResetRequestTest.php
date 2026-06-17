<?php

namespace Tests\Feature;

use App\Models\OperationalAlert;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\CreatesAccountAdmins;
use Tests\TestCase;

class PasswordResetRequestTest extends TestCase
{
    use CreatesAccountAdmins;
    use RefreshDatabase;

    public function test_guest_password_reset_request_returns_generic_message_and_creates_row_when_user_exists(): void
    {
        $user = User::factory()->create([
            'email' => 'locked@example.test',
            'username' => 'locked_user',
            'role' => 'inventory',
        ]);

        $response = $this->postJson('/api/auth/password-reset-request', [
            'login' => 'locked_user',
        ]);

        $response->assertOk()
            ->assertJsonFragment([
                'message' => 'Si la cuenta existe, se notificará a un administrador en el sistema.',
            ]);

        $this->assertDatabaseCount('password_reset_requests', 1);
        $this->assertSame($user->id, PasswordResetRequest::query()->first()->user_id);

        $this->assertDatabaseHas('operational_alerts', [
            'alert_type' => 'password_reset_requested',
        ]);
    }

    public function test_guest_request_with_unknown_username_still_returns_ok_without_row(): void
    {
        $this->postJson('/api/auth/password-reset-request', [
            'login' => 'unknown_user_xyz',
        ])->assertOk();

        $this->assertDatabaseCount('password_reset_requests', 0);
    }

    public function test_unknown_login_still_returns_ok_without_row(): void
    {
        $this->postJson('/api/auth/password-reset-request', [
            'login' => 'nobody_here',
        ])->assertOk();

        $this->assertDatabaseCount('password_reset_requests', 0);
        $this->assertSame(0, OperationalAlert::query()->count());
    }

    public function test_inventory_user_cannot_list_password_reset_requests(): void
    {
        User::factory()->create(['role' => 'boss']);
        $user = User::factory()->create(['role' => 'inventory']);
        $this->assertNotSame(1, $user->getKey());
        $token = $user->createToken('t')->plainTextToken;

        $this->getJson('/api/password-reset-requests', [
            'Authorization' => 'Bearer '.$token,
        ])->assertForbidden();
    }

    public function test_jefe_operaciones_cannot_list_password_reset_requests(): void
    {
        $chief = User::factory()->create(['role' => 'jefe_operaciones', 'username' => 'ajaure']);
        $token = $chief->createToken('t')->plainTextToken;

        $this->getJson('/api/password-reset-requests', [
            'Authorization' => 'Bearer '.$token,
        ])->assertForbidden();
    }

    public function test_account_admin_can_list_pending_requests(): void
    {
        $admin = $this->createVictor();
        $token = $admin->createToken('t')->plainTextToken;

        $subject = User::factory()->create(['username' => 'need_help']);
        PasswordResetRequest::query()->create([
            'user_id' => $subject->getKey(),
            'status' => PasswordResetRequest::STATUS_PENDING,
        ]);

        $this->getJson('/api/password-reset-requests', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('data.0.user.username', 'need_help');
    }

    public function test_account_admin_can_set_user_password_and_closes_pending_requests(): void
    {
        $admin = $this->createValeria();
        $adminToken = $admin->createToken('t')->plainTextToken;

        $subject = User::factory()->create(['username' => 'pw_target']);
        PasswordResetRequest::query()->create([
            'user_id' => $subject->getKey(),
            'status' => PasswordResetRequest::STATUS_PENDING,
        ]);

        $this->patchJson('/api/users/'.$subject->getKey().'/password', [
            'password' => 'new-password-99',
            'password_confirmation' => 'new-password-99',
        ], [
            'Authorization' => 'Bearer '.$adminToken,
        ])->assertOk();

        $subject->refresh();
        $this->assertTrue(Hash::check('new-password-99', $subject->password));

        $this->assertDatabaseHas('password_reset_requests', [
            'user_id' => $subject->getKey(),
            'status' => PasswordResetRequest::STATUS_RESOLVED,
        ]);
    }

    public function test_login_accepts_login_field_instead_of_email(): void
    {
        $user = User::factory()->create([
            'email' => 'oldlogin@test.local',
            'username' => 'plant_user',
            'password' => 'secretpass',
            'role' => 'corte',
        ]);

        $this->postJson('/api/auth/login', [
            'login' => 'plant_user',
            'password' => 'secretpass',
        ])
            ->assertOk()
            ->assertJsonPath('user.username', 'plant_user');

        $this->postJson('/api/auth/login', [
            'login' => 'oldlogin@test.local',
            'password' => 'secretpass',
        ])
            ->assertStatus(422);
    }
}
