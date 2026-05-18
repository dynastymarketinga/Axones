<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScrapBootTest extends TestCase
{
    use RefreshDatabase;

    public function test_scrap_json_defaults(): void
    {
        $user = User::factory()->create();
        $h = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $this->getJson('/api/reports/scrap-substrate-config', $h)->assertOk();
    }
}
