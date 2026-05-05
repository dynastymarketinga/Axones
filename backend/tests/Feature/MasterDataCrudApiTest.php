<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MasterDataCrudApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_clients_crud_requires_auth(): void
    {
        $this->getJson('/api/clients')->assertUnauthorized();
        $this->postJson('/api/clients', ['name' => 'X', 'rif' => 'J-111111111'])->assertUnauthorized();
    }

    public function test_clients_store_show_update_and_index(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $create = $this->postJson('/api/clients', [
            'name' => 'Cliente API',
            'rif' => 'J-123456789',
            'city' => 'Caracas',
        ], $headers);

        $create->assertCreated();
        $id = (int) $create->json('id');
        $this->assertSame('Cliente API', $create->json('name'));

        $this->getJson("/api/clients/{$id}", $headers)->assertOk()->assertJsonPath('rif', 'J-123456789');

        $patch = $this->patchJson("/api/clients/{$id}", [
            'name' => 'Cliente API editado',
            'rif' => 'J-123456789',
        ], $headers);

        $patch->assertOk()->assertJsonPath('name', 'Cliente API editado');

        $list = $this->getJson('/api/clients?q=Cliente+API&per_page=10', $headers);
        $list->assertOk();
        $this->assertGreaterThanOrEqual(1, count($list->json('data')));
    }

    public function test_suppliers_store_show_update(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $create = $this->postJson('/api/suppliers', [
            'name' => 'Proveedor API',
            'rif' => 'J-987654321',
            'email' => 'p@example.com',
        ], $headers);

        $create->assertCreated();
        $id = (int) $create->json('id');

        $this->getJson("/api/suppliers/{$id}", $headers)->assertOk()->assertJsonPath('name', 'Proveedor API');

        $this->patchJson("/api/suppliers/{$id}", [
            'name' => 'Proveedor API 2',
            'phone' => '+58 212 5550000',
        ], $headers)->assertOk()->assertJsonPath('name', 'Proveedor API 2');
    }

    public function test_products_store_show_update_requires_client(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $client = Client::query()->create([
            'name' => 'Dueño producto',
            'rif' => 'J-111222333',
        ]);

        $create = $this->postJson('/api/products', [
            'client_id' => $client->id,
            'name' => 'Producto API',
            'cpe' => 'CPE-1',
            'print_type' => 'Sustrato',
        ], $headers);

        $create->assertCreated();
        $id = (int) $create->json('id');
        $this->assertSame($client->id, (int) $create->json('client_id'));

        $this->getJson("/api/products/{$id}", $headers)->assertOk()->assertJsonPath('name', 'Producto API');

        $this->patchJson("/api/products/{$id}", [
            'client_id' => $client->id,
            'name' => 'Producto API renombrado',
            'mps' => 'MPS-99',
        ], $headers)->assertOk()->assertJsonPath('name', 'Producto API renombrado');
    }
}
