<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CreatesAccountAdmins;
use Tests\TestCase;

class UserApiTest extends TestCase
{
    use CreatesAccountAdmins;
    use RefreshDatabase;

    public function test_users_crud_requires_account_admin(): void
    {
        $inventory = User::factory()->create(['role' => 'inventory', 'username' => 'inv1']);
        $token = $inventory->createToken('t')->plainTextToken;

        $this->getJson('/api/users', ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();

        $this->postJson('/api/users', [
            'name' => 'Nuevo',
            'email' => 'nuevo@test.local',
            'username' => 'nuevo',
            'role' => 'inventory',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }

    public function test_jefe_operaciones_cannot_list_users(): void
    {
        $chief = User::factory()->create(['role' => 'jefe_operaciones', 'username' => 'ajaure']);
        $token = $chief->createToken('t')->plainTextToken;

        $this->getJson('/api/users', ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }

    public function test_account_admin_can_create_list_update_and_deactivate_user(): void
    {
        $admin = $this->createValeria();
        $token = $admin->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $create = $this->postJson('/api/users', [
            'name' => 'Operador Demo',
            'email' => 'operador@test.local',
            'username' => 'operador',
            'role' => 'corte',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ], $headers);

        $create->assertCreated();
        $id = (int) $create->json('id');
        $this->assertTrue((bool) $create->json('active'));
        $this->assertSame('corte', $create->json('role'));

        $this->getJson('/api/users?q=operador', $headers)
            ->assertOk();

        $this->patchJson("/api/users/{$id}", [
            'name' => 'Operador Corte',
            'role' => 'corte',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('name', 'Operador Corte');

        $this->patchJson("/api/users/{$id}", ['active' => false], $headers)
            ->assertOk()
            ->assertJsonPath('active', false);

        $this->postJson('/api/auth/login', [
            'login' => 'operador',
            'password' => 'password123',
        ])->assertUnprocessable();
    }

    public function test_user_cannot_deactivate_self(): void
    {
        $admin = $this->createVictor();
        $token = $admin->createToken('t')->plainTextToken;

        $this->patchJson('/api/users/'.$admin->getKey(), ['active' => false], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertUnprocessable();
    }
}
