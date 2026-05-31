<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TruncateKeepUsersCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_truncate_keep_users_preserves_users_and_clears_domain(): void
    {
        User::factory()->count(2)->create();
        $usersBefore = User::query()->count();

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
        $this->assertSame(0, Supplier::query()->count());
        $this->assertSame(0, Material::query()->count());
    }

    public function test_truncate_keep_users_dry_run_lists_tables(): void
    {
        $this->artisan('axones:truncate-keep-users --dry-run')
            ->assertSuccessful();
    }
}
