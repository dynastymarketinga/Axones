<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderProductionDocumentTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_with_production_items_and_download_pdf(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $client = Client::query()->create(['name' => 'LARENSE DE ALIMENTOS', 'rif' => 'J-1']);

        $r = $this->postJson('/api/work-orders', [
            'client_id' => $client->id,
            'document_number' => '010-26',
            'document_date' => '2026-01-28',
            'authorized_by_name' => 'ROBERT PARRA',
            'authorized_by_title' => 'Licenciado',
            'notes' => 'Urgente laminar primero.',
            'production_items' => [
                [
                    'quantity' => 500,
                    'quantity_unit' => 'Kg',
                    'product_description' => 'GALLETAS NATY\'S "ZOO 90g"',
                    'technical_specs' => 'BOPP 20µm + BOPP METAL 20µm',
                ],
                [
                    'quantity' => 500,
                    'quantity_unit' => 'Kg',
                    'product_description' => 'GALLETAS NATY\'S "CARITAS 90g"',
                    'technical_specs' => 'BOPP 20µm + BOPP METAL 20µm',
                ],
            ],
            'auto_create_material_request' => false,
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $id = $r->json('id');
        $this->assertEquals('010-26', $r->json('document_number'));
        $this->assertCount(2, $r->json('production_items'));

        $pdf = $this->get('/api/work-orders/'.$id.'/orden-produccion.pdf', ['Authorization' => 'Bearer '.$token]);
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $pdf->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
    }

    public function test_patch_replaces_production_items(): void
    {
        $user = User::factory()->create(['role' => 'planificador']);
        $token = $user->createToken('t')->plainTextToken;

        $created = $this->postJson('/api/work-orders', [
            'production_items' => [
                ['quantity' => 1, 'product_description' => 'A'],
            ],
            'auto_create_material_request' => false,
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $id = $created->json('id');

        $this->patchJson('/api/work-orders/'.$id, [
            'production_items' => [
                ['quantity' => 100, 'product_description' => 'B', 'technical_specs' => 'PEBD'],
            ],
        ], ['Authorization' => 'Bearer '.$token])->assertOk();

        $this->assertCount(1, WorkOrder::query()->find($id)->productionItems);
        $this->assertEquals('B', WorkOrder::query()->find($id)->productionItems->first()->product_description);
    }
}
