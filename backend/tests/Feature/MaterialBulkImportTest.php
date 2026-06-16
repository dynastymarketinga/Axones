<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\TintaSubarea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaterialBulkImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_bulk_import_creates_sustrato_with_stock(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $response = $this->postJson(
            '/api/materials/bulk-import',
            [
                'dry_run' => false,
                'source_filename' => 'INVENTARIO VICTOR.xlsx',
                'rows' => [
                    [
                        'sheet_name' => 'Hoja3',
                        'row_number' => 2,
                        'sku' => 'SUB-BOPP-NORMAL-20-600',
                        'name' => 'BOPP NORMAL',
                        'inventory_area' => 'material',
                        'unit' => 'kg',
                        'micras' => 20,
                        'ancho' => 600,
                        'tinta_subarea' => null,
                        'quantity' => 1883.08,
                    ],
                ],
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonPath('created', 1);

        $material = Material::query()->where('sku', 'SUB-BOPP-NORMAL-20-600')->first();
        $this->assertNotNull($material);
        $this->assertEquals('1883.080', (string) $material->quantity_on_hand);

        $this->assertDatabaseHas('inventory_movements', [
            'material_id' => $material->id,
            'movement_type' => 'adjustment_add',
            'reference_type' => 'victor_excel_import',
        ]);
    }

    public function test_bulk_import_upserts_stock_delta(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $material = Material::query()->create([
            'sku' => 'SUB-BOPP-MATE-20-470',
            'name' => 'BOPP MATE',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'micras' => 20,
            'ancho' => 470,
            'min_stock' => 0,
            'no_supplier_reason' => 'test',
        ]);
        $material->forceFill(['quantity_on_hand' => '100.000'])->save();

        $response = $this->postJson(
            '/api/materials/bulk-import',
            [
                'rows' => [
                    [
                        'sheet_name' => 'Hoja2',
                        'row_number' => 2,
                        'sku' => 'SUB-BOPP-MATE-20-470',
                        'name' => 'BOPP MATE',
                        'inventory_area' => 'material',
                        'unit' => 'kg',
                        'micras' => 20,
                        'ancho' => 470,
                        'quantity' => 54,
                    ],
                ],
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $this->assertEquals('54.000', (string) $material->fresh()->quantity_on_hand);
    }

    public function test_bulk_import_creates_tinta_with_subarea(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $response = $this->postJson(
            '/api/materials/bulk-import',
            [
                'rows' => [
                    [
                        'sheet_name' => 'TINTAS',
                        'row_number' => 9,
                        'sku' => 'TNT-BL-2036',
                        'name' => 'BLANCO',
                        'inventory_area' => 'tintas',
                        'unit' => 'kg',
                        'tinta_subarea' => 'laminacion',
                        'quantity' => 1080,
                    ],
                ],
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $material = Material::query()->where('sku', 'TNT-BL-2036')->first();
        $this->assertNotNull($material);
        $this->assertDatabaseHas('tinta_subareas', [
            'material_id' => $material->id,
            'subarea' => 'laminacion',
        ]);
    }

    public function test_bulk_import_dry_run_does_not_persist(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $this->postJson(
            '/api/materials/bulk-import',
            [
                'dry_run' => true,
                'rows' => [
                    [
                        'sku' => 'SUB-DRY-RUN-1',
                        'name' => 'DRY',
                        'inventory_area' => 'material',
                        'unit' => 'kg',
                        'micras' => 10,
                        'ancho' => 100,
                        'quantity' => 5,
                    ],
                ],
            ],
            ['Authorization' => 'Bearer '.$token],
        )->assertOk();

        $this->assertDatabaseMissing('materials', ['sku' => 'SUB-DRY-RUN-1']);
    }
}
