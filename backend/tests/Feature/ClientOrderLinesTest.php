<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\Material;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientOrderLinesTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_store_client_order_with_product_lines(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C1', 'rif' => 'J-10']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Bolsa X',
            'cpe' => 'CPE-1',
        ]);

        $r = $this->postJson('/api/client-orders', [
            'client_id' => $client->id,
            'notes' => 'Pedido urgente',
            'lines' => [
                ['product_id' => $product->id, 'quantity' => 10000, 'unit' => 'und', 'notes' => 'L1'],
                ['product_id' => $product->id, 'quantity' => 500, 'unit' => 'kg'],
            ],
        ], $h)->assertCreated();

        $this->assertCount(2, $r->json('lines'));
        $this->assertEquals('10000.000', $r->json('lines.0.quantity'));
        $this->assertEquals('Bolsa X', $r->json('lines.0.product.name'));
    }

    public function test_rejects_product_from_other_client(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $c1 = Client::query()->create(['name' => 'A', 'rif' => 'J-11']);
        $c2 = Client::query()->create(['name' => 'B', 'rif' => 'J-12']);
        $product = Product::query()->create([
            'client_id' => $c2->id,
            'name' => 'Solo B',
            'cpe' => 'CPE-2',
        ]);

        $this->postJson('/api/client-orders', [
            'client_id' => $c1->id,
            'lines' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ], $h)->assertUnprocessable();
    }

    public function test_line_with_material_id_only(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C-Mat', 'rif' => 'J-20']);
        $mat = Material::query()->create([
            'sku' => 'COL-M1',
            'name' => 'Film',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        $r = $this->postJson('/api/client-orders', [
            'client_id' => $client->id,
            'lines' => [
                ['material_id' => $mat->id, 'quantity' => 120, 'unit' => 'kg', 'notes' => 'Reserva'],
            ],
        ], $h)->assertCreated();

        $this->assertEquals($mat->id, $r->json('lines.0.material_id'));
        $this->assertEquals('Film', $r->json('lines.0.material.name'));
    }

    public function test_line_with_description_only(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C2', 'rif' => 'J-13']);

        $r = $this->postJson('/api/client-orders', [
            'client_id' => $client->id,
            'lines' => [
                ['description' => 'Servicio especial embalaje', 'quantity' => 1, 'unit' => 'serv'],
            ],
        ], $h)->assertCreated();

        $this->assertNull($r->json('lines.0.product_id'));
        $this->assertStringContainsString('Servicio especial', $r->json('lines.0.description'));
    }

    public function test_patch_replaces_lines(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C3', 'rif' => 'J-14']);
        $p = Product::query()->create(['client_id' => $client->id, 'name' => 'P', 'cpe' => 'C']);

        $co = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => 'OC-CLI-MAN-99',
            'status' => 'open',
            'created_by' => $user->id,
        ]);
        $co->lines()->create([
            'product_id' => $p->id,
            'quantity' => 99,
            'unit' => 'kg',
            'position' => 0,
        ]);

        $this->patchJson("/api/client-orders/{$co->id}", [
            'lines' => [
                ['description' => 'Solo texto', 'quantity' => 2, 'unit' => 'h'],
            ],
        ], $h)->assertOk();

        $fresh = ClientOrder::query()->with('lines')->find($co->id);
        $this->assertCount(1, $fresh->lines);
        $this->assertNull($fresh->lines->first()->product_id);
    }
}
