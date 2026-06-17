<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\AccountAdminAccess;
use App\Support\AxonesUserCredentials;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CreatesAccountAdmins;
use Tests\TestCase;

class AccountAdminAccessTest extends TestCase
{
    use CreatesAccountAdmins;
    use RefreshDatabase;

    public function test_account_admin_access_identifies_victor_and_valeria(): void
    {
        $this->assertTrue(AccountAdminAccess::allows($this->createVictor()));
        $this->assertTrue(AccountAdminAccess::allows($this->createValeria()));
    }

    public function test_jefe_operaciones_is_not_account_admin(): void
    {
        $user = User::factory()->create(['role' => 'jefe_operaciones', 'username' => 'ajaure']);

        $this->assertFalse(AccountAdminAccess::allows($user));
    }

    public function test_generic_boss_without_victor_credentials_is_not_account_admin(): void
    {
        $user = User::factory()->create(['role' => 'boss', 'username' => 'boss1']);

        $this->assertFalse(AccountAdminAccess::allows($user));
    }

    public function test_protected_accounts_cannot_be_deactivated(): void
    {
        $valeria = $this->createValeria();
        $token = $valeria->createToken('t')->plainTextToken;
        $victor = $this->createVictor();

        $this->patchJson('/api/users/'.$victor->getKey(), ['active' => false], [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnprocessable();
    }

    public function test_protected_account_admin_password_cannot_be_reset_by_other_admin(): void
    {
        $valeria = $this->createValeria();
        $victor = $this->createVictor();
        $token = $valeria->createToken('t')->plainTextToken;

        $this->patchJson('/api/users/'.$victor->getKey().'/password', [
            'password' => 'new-password-99',
            'password_confirmation' => 'new-password-99',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnprocessable();
    }

    public function test_victor_can_reset_plant_user_password(): void
    {
        $victor = $this->createVictor();
        $token = $victor->createToken('t')->plainTextToken;
        $plant = User::factory()->create(['role' => 'corte', 'username' => 'plant_pw']);

        $this->patchJson('/api/users/'.$plant->getKey().'/password', [
            'password' => 'new-password-99',
            'password_confirmation' => 'new-password-99',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();
    }

    public function test_victor_email_constant_matches_seeder(): void
    {
        $this->assertSame('victorcarrillox2@gmail.com', AxonesUserCredentials::VICTOR_EMAIL);
    }
}
