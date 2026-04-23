<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TintaMixtureApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_mixture_and_moves_stock(): void
    {
        $user = User::factory()->create();

        $dorado = Material::query()->create([
            'sku' => 'BASE-DORADO',
            'name' => 'Dorado base',
            'inventory_area' => 'tintas',
            'tinta_presentacion' => 'original',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $dorado->forceFill(['quantity_on_hand' => 50])->save();

        $negro = Material::query()->create([
            'sku' => 'BASE-NEGRO',
            'name' => 'Negro base',
            'inventory_area' => 'tintas',
            'tinta_presentacion' => 'original',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $negro->forceFill(['quantity_on_hand' => 30])->save();

        $token = $user->createToken('test')->plainTextToken;

        $response = $this->postJson('/api/tinta-mixtures', [
            'output_sku' => 'MIX-DOR-PREP-001',
            'output_name' => 'Dorado preparado P-0001',
            'output_inventory_area' => 'tintas',
            'notes' => 'Prueba mezcla',
            'components' => [
                ['material_id' => $dorado->id, 'quantity' => 16.88],
                ['material_id' => $negro->id, 'quantity' => 0.94],
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ]);

        $response->assertCreated();
        $outputId = $response->json('output_material.id');
        $this->assertNotNull($outputId);

        $dorado->refresh();
        $negro->refresh();
        $output = Material::query()->findOrFail($outputId);

        $this->assertEquals('33.120', (string) $dorado->quantity_on_hand);
        $this->assertEquals('29.060', (string) $negro->quantity_on_hand);
        $this->assertEquals('17.820', (string) $output->quantity_on_hand);
    }
}
