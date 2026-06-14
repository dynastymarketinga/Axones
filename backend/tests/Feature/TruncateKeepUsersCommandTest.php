<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TruncateKeepUsersCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_truncate_keep_users_preserves_users_and_clears_domain(): void
    {
        User::factory()->count(2)->create();
        $usersBefore = User::query()->count();

        DB::table('sessions')->insert([
            'id' => 'test-session-id',
            'user_id' => null,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'test',
            'payload' => 'test',
            'last_activity' => time(),
        ]);
        DB::table('cache')->insert([
            'key' => 'test-cache-key',
            'value' => 'test',
            'expiration' => time() + 3600,
        ]);
        DB::table('personal_access_tokens')->insert([
            'tokenable_type' => User::class,
            'tokenable_id' => 1,
            'name' => 'test-token',
            'token' => hash('sha256', 'test-plain-token'),
            'abilities' => '["*"]',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Supplier::query()->create(['name' => 'Prov reset', 'rif' => 'J-RESET']);
        Material::query()->create([
            'sku' => 'MAT-RESET',
            'name' => 'Material reset',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $this->artisan('axones:truncate-keep-users --force')
            ->assertSuccessful();

        $this->assertSame($usersBefore, User::query()->count());
        $this->assertSame(1, DB::table('sessions')->count());
        $this->assertSame(0, DB::table('cache')->count());
        $this->assertSame(1, DB::table('personal_access_tokens')->count());
        $this->assertSame(0, Supplier::query()->count());
        $this->assertSame(0, Material::query()->count());
    }

    public function test_truncate_keep_users_dry_run_lists_tables(): void
    {
        $this->artisan('axones:truncate-keep-users --dry-run')
            ->assertSuccessful();
    }
}
