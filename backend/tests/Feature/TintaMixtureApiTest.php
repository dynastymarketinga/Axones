<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TintaMixtureApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_mixture_pending_without_moving_stock_until_dispatch(): void
    {
        $tintasUser = User::factory()->create(['role' => 'tintas']);
        $warehouseUser = User::factory()->create(['role' => 'inventory_chief']);

        $dorado = Material::query()->create([
            'sku' => 'BASE-DORADO',
            'name' => 'Dorado base',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $dorado->forceFill(['quantity_on_hand' => 50])->save();

        $negro = Material::query()->create([
            'sku' => 'BASE-NEGRO',
            'name' => 'Negro base',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $negro->forceFill(['quantity_on_hand' => 30])->save();

        $tintasToken = $tintasUser->createToken('test')->plainTextToken;

        $response = $this->postJson('/api/tinta-mixtures', [
            'output_sku' => 'MIX-DOR-PREP-001',
            'output_name' => 'Dorado preparado P-0001',
            'output_inventory_area' => 'tintas',
            'output_tinta_subarea' => 'laminacion',
            'notes' => 'Prueba mezcla',
            'components' => [
                ['material_id' => $dorado->id, 'quantity' => 16.88],
                ['material_id' => $negro->id, 'quantity' => 0.94],
            ],
        ], [
            'Authorization' => 'Bearer '.$tintasToken,
            'Accept' => 'application/json',
        ]);

        $response->assertCreated();
        $this->assertSame('pending', $response->json('status'));
        $this->assertNull($response->json('output_material_id'));

        $dorado->refresh();
        $negro->refresh();
        $this->assertSame('50.000', (string) $dorado->quantity_on_hand);
        $this->assertSame('30.000', (string) $negro->quantity_on_hand);

        $mr = MaterialRequest::query()->first();
        $this->assertNotNull($mr);

        $warehouseToken = $warehouseUser->createToken('test')->plainTextToken;
        $this->postJson("/api/material-requests/{$mr->id}/authorize", [], [
            'Authorization' => 'Bearer '.$warehouseToken,
            'Accept' => 'application/json',
        ])->assertOk();

        $lines = $mr->fresh()->load('lines')->lines;
        $dispatchLines = $lines->map(fn ($ln) => [
            'material_request_line_id' => $ln->id,
            'quantity' => (string) $ln->quantity_requested,
        ])->all();

        $this->postJson("/api/material-requests/{$mr->id}/dispatch", [
            'lines' => $dispatchLines,
        ], [
            'Authorization' => 'Bearer '.$warehouseToken,
            'Accept' => 'application/json',
        ])->assertOk();

        $dorado->refresh();
        $negro->refresh();
        $output = Material::query()->where('sku', 'MIX-DOR-PREP-001')->first();
        $this->assertNotNull($output);

        $this->assertEquals('33.120', (string) $dorado->quantity_on_hand);
        $this->assertEquals('29.060', (string) $negro->quantity_on_hand);
        $this->assertEquals('17.820', (string) $output->quantity_on_hand);
    }
}
