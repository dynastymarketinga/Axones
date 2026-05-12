<?php

namespace Tests\Feature;

use App\Enums\ClientOrderStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\Material;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
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

    public function test_store_client_order_with_ordered_at_and_line_material(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $client = Client::query()->create(['name' => 'C-Ord', 'rif' => 'J-21']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Etiqueta Y',
            'cpe' => 'CPE-ORD',
        ]);
        $mat = Material::query()->create([
            'sku' => 'SUB-ORD-1',
            'name' => 'Film orden',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $date = '2026-05-15';

        $r = $this->postJson('/api/client-orders', [
            'client_id' => $client->id,
            'ordered_at' => $date,
            'notes' => 'Con fecha y sustrato',
            'lines' => [
                [
                    'product_id' => $product->id,
                    'material_id' => $mat->id,
                    'quantity' => 50,
                    'unit' => 'kg',
                    'description' => 'Línea con producto y material',
                ],
            ],
        ], $h)->assertCreated();

        $this->assertStringStartsWith($date, (string) $r->json('ordered_at'));
        $this->assertSame($mat->id, (int) $r->json('lines.0.material_id'));
        $this->assertStringContainsString('producto y material', (string) $r->json('lines.0.description'));
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

    public function test_patch_updates_client_id_when_open_and_lines_compatible(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $c1 = Client::query()->create(['name' => 'C-Patch-1', 'rif' => 'J-P1']);
        $c2 = Client::query()->create(['name' => 'C-Patch-2', 'rif' => 'J-P2']);
        $product = Product::query()->create([
            'client_id' => null,
            'name' => 'Producto genérico',
            'cpe' => 'CPE-PATCH-CLIENT',
        ]);

        $co = ClientOrder::query()->create([
            'client_id' => $c1->id,
            'code' => 'OC-CLI-PATCH-CLIENT-ID',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $co->lines()->create([
            'product_id' => $product->id,
            'quantity' => 10,
            'unit' => 'kg',
            'position' => 0,
        ]);

        $this->patchJson("/api/client-orders/{$co->id}", [
            'client_id' => $c2->id,
        ], $h)->assertOk()->assertJsonPath('client_id', $c2->id);

        $this->assertSame($c2->id, (int) ClientOrder::query()->find($co->id)?->client_id);
    }

    public function test_patch_rejects_client_id_when_line_product_belongs_to_previous_client(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $c1 = Client::query()->create(['name' => 'C-Own', 'rif' => 'J-O1']);
        $c2 = Client::query()->create(['name' => 'C-Other', 'rif' => 'J-O2']);
        $product = Product::query()->create([
            'client_id' => $c1->id,
            'name' => 'Solo cliente 1',
            'cpe' => 'CPE-OWN-1',
        ]);

        $co = ClientOrder::query()->create([
            'client_id' => $c1->id,
            'code' => 'OC-CLI-PATCH-BAD-CLIENT',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $co->lines()->create([
            'product_id' => $product->id,
            'quantity' => 5,
            'unit' => 'und',
            'position' => 0,
        ]);

        $this->patchJson("/api/client-orders/{$co->id}", [
            'client_id' => $c2->id,
        ], $h)->assertUnprocessable();

        $this->assertSame($c1->id, (int) ClientOrder::query()->find($co->id)?->client_id);
    }

    public function test_patch_rejects_client_id_when_active_work_order_linked(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $c1 = Client::query()->create(['name' => 'C-Wo', 'rif' => 'J-W1']);
        $c2 = Client::query()->create(['name' => 'C-Wo2', 'rif' => 'J-W2']);
        $product = Product::query()->create([
            'client_id' => null,
            'name' => 'P WO',
            'cpe' => 'CPE-WO-LINK',
        ]);

        $co = ClientOrder::query()->create([
            'client_id' => $c1->id,
            'code' => 'OC-CLI-WO-BLOCK',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $co->lines()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'unit' => 'und',
            'position' => 0,
        ]);

        WorkOrder::query()->create([
            'code' => WorkOrder::nextCode(),
            'client_id' => $c1->id,
            'product_id' => $product->id,
            'client_order_id' => $co->id,
            'status' => WorkOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/client-orders/{$co->id}", [
            'client_id' => $c2->id,
        ], $h)->assertUnprocessable();

        $this->assertSame($c1->id, (int) ClientOrder::query()->find($co->id)?->client_id);
    }

    public function test_patch_allows_client_id_when_only_cancelled_work_orders_linked(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $c1 = Client::query()->create(['name' => 'C-Wx', 'rif' => 'J-X1']);
        $c2 = Client::query()->create(['name' => 'C-Wx2', 'rif' => 'J-X2']);
        $product = Product::query()->create([
            'client_id' => null,
            'name' => 'P cancel WO',
            'cpe' => 'CPE-WO-CAN',
        ]);

        $co = ClientOrder::query()->create([
            'client_id' => $c1->id,
            'code' => 'OC-CLI-WO-CANCEL-OK',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $co->lines()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'unit' => 'und',
            'position' => 0,
        ]);

        WorkOrder::query()->create([
            'code' => WorkOrder::nextCode(),
            'client_id' => $c1->id,
            'product_id' => $product->id,
            'client_order_id' => $co->id,
            'status' => WorkOrderStatus::Cancelled->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/client-orders/{$co->id}", [
            'client_id' => $c2->id,
        ], $h)->assertOk()->assertJsonPath('client_id', $c2->id);
    }

    public function test_patch_client_id_with_lines_replaces_incompatible_products_atomically(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $c1 = Client::query()->create(['name' => 'C-Atom-1', 'rif' => 'J-A1']);
        $c2 = Client::query()->create(['name' => 'C-Atom-2', 'rif' => 'J-A2']);
        $oldProduct = Product::query()->create([
            'client_id' => $c1->id,
            'name' => 'Solo C1',
            'cpe' => 'CPE-ATOM-OLD',
        ]);
        $newProduct = Product::query()->create([
            'client_id' => $c2->id,
            'name' => 'Solo C2',
            'cpe' => 'CPE-ATOM-NEW',
        ]);

        $co = ClientOrder::query()->create([
            'client_id' => $c1->id,
            'code' => 'OC-CLI-ATOM-SWAP',
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);
        $co->lines()->create([
            'product_id' => $oldProduct->id,
            'quantity' => 5,
            'unit' => 'kg',
            'position' => 0,
        ]);

        $this->patchJson("/api/client-orders/{$co->id}", [
            'client_id' => $c2->id,
            'lines' => [
                ['product_id' => $newProduct->id, 'quantity' => 10, 'unit' => 'kg'],
            ],
        ], $h)->assertOk()->assertJsonPath('client_id', $c2->id);

        $fresh = ClientOrder::query()->with('lines')->find($co->id);
        $this->assertSame($c2->id, (int) $fresh->client_id);
        $this->assertCount(1, $fresh->lines);
        $this->assertSame($newProduct->id, (int) $fresh->lines->first()->product_id);
        $this->assertEquals('10.000', $fresh->lines->first()->quantity);
    }
}
