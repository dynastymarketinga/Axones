<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MiscellaneousReceiptTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_requires_auth(): void
    {
        Storage::fake('local');

        $this->postJson('/api/miscellaneous-receipts', [])->assertUnauthorized();
    }

    public function test_stores_receipt_with_attachments_and_increases_stock(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $material = Material::query()->create([
            'sku' => 'MISC-R-1',
            'name' => 'Útiles varios',
            'inventory_area' => 'miscelaneos',
            'unit' => 'und',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 10])->save();

        $file = UploadedFile::fake()->image('comprobante.jpg', 400, 300);

        $response = $this->postJson('/api/miscellaneous-receipts', [
            'material_id' => $material->id,
            'quantity' => 4,
            'invoice_reference' => 'FAC-2026-001',
            'notes' => 'Compra local',
            'attachments' => [$file],
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertCreated()
            ->assertJsonPath('quantity', '4.000')
            ->assertJsonPath('invoice_reference', 'FAC-2026-001');

        $this->assertCount(1, $response->json('attachments'));

        $material->refresh();
        $this->assertEquals('14.000', (string) $material->quantity_on_hand);

        Storage::disk('local')->assertExists($response->json('attachments.0.path'));
    }

    public function test_rejects_non_miscelaneos_material(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $material = Material::query()->create([
            'sku' => 'MAT-NOT-MISC',
            'name' => 'Otro',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 100])->save();

        $this->postJson('/api/miscellaneous-receipts', [
            'material_id' => $material->id,
            'quantity' => 1,
            'attachments' => [UploadedFile::fake()->image('x.jpg')],
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnprocessable();
    }

    public function test_requires_at_least_one_attachment(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $material = Material::query()->create([
            'sku' => 'MISC-R-2',
            'name' => 'Útiles',
            'inventory_area' => 'miscelaneos',
            'unit' => 'und',
            'min_stock' => 0,
        ]);
        $material->forceFill(['quantity_on_hand' => 0])->save();

        $this->postJson('/api/miscellaneous-receipts', [
            'material_id' => $material->id,
            'quantity' => 1,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnprocessable();
    }
}
