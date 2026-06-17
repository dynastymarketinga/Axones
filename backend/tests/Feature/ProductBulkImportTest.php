<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductBulkImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_bulk_import_creates_client_and_product(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $response = $this->postJson(
            '/api/products/bulk-import',
            [
                'dry_run' => false,
                'clients' => [
                    [
                        'nombre_cliente' => 'IMPROA SANTONI, C.A.',
                        'rif' => 'J-30827011-3',
                        'sheet_name' => 'Hoja1',
                        'row_number' => 19,
                    ],
                ],
                'products' => [
                    [
                        'producto' => 'ARROZ PREMIUM SANTONI 900g',
                        'nombre_cliente' => 'IMPROA SANTONI, C.A.',
                        'rif_cliente' => 'J-30827011-3',
                        'cpe' => '0422515856',
                        'mps' => 'A-101.240',
                        'cod_barra' => '7592498220457',
                        'sheet_name' => 'Hoja1',
                        'row_number' => 19,
                    ],
                ],
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonPath('clients_created', 1);
        $response->assertJsonPath('products_created', 1);

        $this->assertDatabaseHas('clients', ['rif' => 'J-30827011-3']);
        $this->assertDatabaseHas('products', [
            'name' => 'ARROZ PREMIUM SANTONI 900g',
            'cpe' => '0422515856',
            'mps' => 'A-101.240',
            'barcode' => '7592498220457',
        ]);
    }

    public function test_bulk_import_updates_existing_product_fields(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $client = Client::query()->create([
            'name' => 'ARROCERA CHISPA, C.A.',
            'rif' => 'J-30717543-5',
        ]);

        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'ARROZ BLANCO DON JULIAN TIPO III 900g (AMARILLO)',
            'cpe' => '02019671',
            'mps' => 'A-OLD',
            'barcode' => null,
        ]);

        $response = $this->postJson(
            '/api/products/bulk-import',
            [
                'products' => [
                    [
                        'producto' => 'ARROZ BLANCO DON JULIAN TIPO III 900g (AMARILLO)',
                        'nombre_cliente' => 'ARROCERA CHISPA, C.A.',
                        'rif_cliente' => 'J-30717543-5',
                        'cpe' => '02019671',
                        'mps' => 'A-101.673',
                        'cod_barra' => '7590000000001',
                        'sheet_name' => 'Hoja1',
                        'row_number' => 10,
                    ],
                ],
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonPath('products_updated', 1);

        $product->refresh();
        $this->assertSame('A-101.673', $product->mps);
        $this->assertSame('7590000000001', $product->barcode);
    }

    public function test_bulk_import_dry_run_does_not_persist(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $this->postJson(
            '/api/products/bulk-import',
            [
                'dry_run' => true,
                'clients' => [
                    ['nombre_cliente' => 'TEST DRY', 'rif' => 'J-99999999-9'],
                ],
                'products' => [
                    [
                        'producto' => 'PRODUCTO DRY RUN',
                        'rif_cliente' => 'J-99999999-9',
                        'nombre_cliente' => 'TEST DRY',
                    ],
                ],
            ],
            ['Authorization' => 'Bearer '.$token],
        )->assertOk();

        $this->assertDatabaseMissing('clients', ['rif' => 'J-99999999-9']);
        $this->assertDatabaseMissing('products', ['name' => 'PRODUCTO DRY RUN']);
    }

    public function test_bulk_import_rejects_new_client_without_rif(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $response = $this->postJson(
            '/api/products/bulk-import',
            [
                'clients' => [
                    ['nombre_cliente' => 'SIN RIF SA', 'rif' => ''],
                ],
                'products' => [
                    [
                        'producto' => 'PRODUCTO SIN RIF',
                        'nombre_cliente' => 'SIN RIF SA',
                        'rif_cliente' => '',
                    ],
                ],
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonPath('errors.0.kind', 'client');
    }
}
