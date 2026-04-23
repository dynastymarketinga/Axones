<?php

namespace Tests\Feature;

use App\Enums\ClientOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderOrdenTrabajoTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_get_orden_trabajo_prefill_from_masters(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $client = Client::query()->create([
            'name' => 'IANCARINA',
            'rif' => 'J-999',
        ]);

        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'ARROZ MARY PREMIUM',
            'cpe' => '0421496219',
            'barcode' => '7591473005249',
            'mps' => 'A-40.323',
            'print_type' => 'reverso',
            'structure' => 'PEBD 630 X 26 + PEBD 630 X 26',
        ]);

        $co = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => ClientOrder::nextCode(),
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        ClientOrderLine::query()->create([
            'client_order_id' => $co->id,
            'product_id' => $product->id,
            'quantity' => 10000,
            'unit' => 'Kg',
            'position' => 0,
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'client_order_id' => $co->id,
            'document_number' => '065-MAR26',
            'document_date' => '2026-03-18',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $r = $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)->assertOk();
        $this->assertEquals('IANCARINA', $r->json('prefill.cliente'));
        $this->assertEquals('J-999', $r->json('prefill.clienteRif'));
        $this->assertEquals('ARROZ MARY PREMIUM', $r->json('prefill.producto'));
        $this->assertEquals('PEBD 630 X 26 + PEBD 630 X 26', $r->json('prefill.estructuraMaterial'));
        $this->assertEquals('0421496219', $r->json('prefill.cpe'));
        $this->assertEquals('A-40.323', $r->json('prefill.mpps'));
        $this->assertEquals('7591473005249', $r->json('prefill.codigoBarra'));
        $this->assertEquals('Reverso', $r->json('prefill.tipoImpresion'));
        $this->assertEquals('10000.000', $r->json('prefill.pedidoKg'));
        $this->assertEquals('065-MAR26', $r->json('prefill.numeroOrden'));
        $this->assertEquals('2026-03-18', $r->json('prefill.fechaOrden'));
        $this->assertNull($r->json('form'));
    }

    public function test_put_orden_trabajo_persists_form(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-2',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $payload = ['form' => ['cliente' => 'X', 'tintas' => [['posicion' => 1, 'color' => 'NEGRO']]]];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.cliente', 'X')
            ->assertJsonPath('form.tintas.0.color', 'NEGRO');
    }
}
