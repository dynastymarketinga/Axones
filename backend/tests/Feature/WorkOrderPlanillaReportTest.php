<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderPlanillaReportTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_planilla_preview_ok_for_in_progress_with_form(): void
    {
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);

        $client = Client::query()->create(['name' => 'Cliente prev', 'rif' => 'J-1']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'Producto prev',
            'cpe' => 'CPE-1',
            'mps' => 'MPS-1',
            'print_type' => 'Flexografía',
            'structure' => 'BOPP',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-PREV-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'document_number' => '021-26',
            'document_date' => '2026-04-29',
            'status' => 'in_progress',
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'maquina' => 'COMEXI 1',
                'frecuencia' => '250±2',
                'tintaColor1' => 'AMARILLO',
            ],
        ]);

        $r = $this->get('/api/work-orders/'.$wo->id.'/orden-produccion-planilla/preview', $h);
        $r->assertOk();
        $this->assertStringContainsString('text/html', (string) $r->headers->get('Content-Type'));
        $this->assertStringContainsString('ORDEN DE TRABAJO', $r->getContent());
        $this->assertStringContainsString('021-26', $r->getContent());
        $this->assertStringContainsString('AMARILLO', $r->getContent());
    }

    public function test_planilla_preview_forbidden_when_completed(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        $client = Client::query()->create(['name' => 'C', 'rif' => 'J-2']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P',
            'cpe' => 'C',
            'mps' => 'M',
            'print_type' => 'Flexografía',
            'structure' => 'X',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-DONE-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'completed',
            'created_by' => $user->id,
        ]);

        $this->get('/api/work-orders/'.$wo->id.'/orden-produccion-planilla/preview', $h)->assertForbidden();
        $this->get('/api/work-orders/'.$wo->id.'/orden-produccion-planilla.pdf', $h)->assertForbidden();
    }

    public function test_planilla_preview_forbidden_without_planilla_read_role(): void
    {
        $user = User::factory()->create(['role' => 'inventory']);
        $h = $this->auth($user);

        $client = Client::query()->create(['name' => 'C', 'rif' => 'J-3']);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P',
            'cpe' => 'C',
            'mps' => 'M',
            'print_type' => 'Flexografía',
            'structure' => 'X',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-INV-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->get('/api/work-orders/'.$wo->id.'/orden-produccion-planilla/preview', $h)->assertForbidden();
    }
}
