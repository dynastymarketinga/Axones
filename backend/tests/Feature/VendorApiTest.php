<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_vendors_crud_requires_auth(): void
    {
        $this->getJson('/api/vendors')->assertUnauthorized();
        $this->postJson('/api/vendors', ['name' => 'X'])->assertUnauthorized();
    }

    public function test_vendors_store_show_update_and_index(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $create = $this->postJson('/api/vendors', [
            'name' => 'Vendedor API',
            'phone_primary' => '+58 412 0000000',
        ], $headers);

        $create->assertCreated();
        $id = (int) $create->json('id');
        $this->assertSame('Vendedor API', $create->json('name'));
        $this->assertTrue((bool) $create->json('active'));
        $this->assertSame('+58 412 0000000', $create->json('phone_primary'));

        $this->getJson("/api/vendors/{$id}", $headers)
            ->assertOk()
            ->assertJsonPath('name', 'Vendedor API');

        $this->patchJson("/api/vendors/{$id}", [
            'name' => 'Vendedor API editado',
            'phone_secondary' => '+58 414 1111111',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('name', 'Vendedor API editado')
            ->assertJsonPath('phone_secondary', '+58 414 1111111');

        $list = $this->getJson('/api/vendors?q=Vendedor+API&per_page=10', $headers);
        $list->assertOk();
        $this->assertGreaterThanOrEqual(1, count($list->json('data')));
    }

    public function test_vendors_store_rejects_empty_name_and_duplicate(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson('/api/vendors', [], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);

        Vendor::query()->create(['name' => 'Duplicado', 'active' => true]);

        $this->postJson('/api/vendors', ['name' => 'Duplicado'], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }
}
