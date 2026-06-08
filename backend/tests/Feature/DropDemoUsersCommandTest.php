<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DropDemoUsersCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_drop_demo_users_dry_run_lists_accounts(): void
    {
        User::factory()->create(['email' => 'real@axones.local', 'username' => 'real']);
        User::factory()->create(['email' => 'demo1@axones.demo', 'username' => 'demo1']);
        User::factory()->create(['email' => 'demo2@axones.demo', 'username' => 'demo2']);

        $this->artisan('axones:users:drop-demo', ['--dry-run' => true])
            ->expectsOutputToContain('Cuentas @axones.demo que se eliminarían (2):')
            ->assertSuccessful();

        $this->assertDatabaseCount('users', 3);
    }

    public function test_drop_demo_users_removes_demo_accounts_and_keeps_real(): void
    {
        $real = User::factory()->create(['email' => 'real@axones.local', 'username' => 'real_keep']);
        User::factory()->create(['email' => 'gone@axones.demo', 'username' => 'gone']);

        $this->artisan('axones:users:drop-demo', ['--force' => true])
            ->expectsOutputToContain('Usuarios demo eliminados: 1')
            ->assertSuccessful();

        $this->assertDatabaseHas('users', ['id' => $real->getKey()]);
        $this->assertDatabaseMissing('users', ['email' => 'gone@axones.demo']);
    }
}
