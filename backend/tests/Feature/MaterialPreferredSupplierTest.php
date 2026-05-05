<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\Supplier;
use App\Models\TintaSubarea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaterialPreferredSupplierTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_tinta_material_with_preferred_supplier(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Proveedor Tinta',
            'rif' => 'J-123',
            'email' => null,
            'phone' => null,
            'address' => null,
        ]);

        $response = $this->postJson(
            '/api/materials',
            [
                'sku' => 'TINTA-SUP-1',
                'name' => 'Tinta azul',
                'barcode' => null,
                'inventory_area' => 'tintas',
                'tinta_subarea' => 'laminacion',
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => 0,
                'notes' => null,
                'supplier_id' => $supplier->id,
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertCreated();
        $response->assertJsonPath('supplier_id', $supplier->id);
        $response->assertJsonPath('supplier.name', 'Proveedor Tinta');

        $this->assertDatabaseHas('materials', [
            'sku' => 'TINTA-SUP-1',
            'supplier_id' => $supplier->id,
        ]);
    }

    public function test_store_sustrato_requires_supplier_and_persists(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Prov Sustrato',
            'rif' => null,
            'email' => null,
            'phone' => null,
            'address' => null,
        ]);

        $response = $this->postJson(
            '/api/materials',
            [
                'sku' => 'MAT-SUP-OK',
                'name' => 'Sustrato',
                'barcode' => null,
                'inventory_area' => 'material',
                'micras' => 12,
                'ancho' => 100,
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => 0,
                'notes' => null,
                'supplier_id' => $supplier->id,
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertCreated();
        $response->assertJsonPath('supplier_id', $supplier->id);
        $this->assertDatabaseHas('materials', [
            'sku' => 'MAT-SUP-OK',
            'supplier_id' => $supplier->id,
        ]);
    }

    public function test_store_sustrato_without_supplier_is_unprocessable(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $response = $this->postJson(
            '/api/materials',
            [
                'sku' => 'MAT-NO-SUP',
                'name' => 'Sustrato sin prov',
                'barcode' => null,
                'inventory_area' => 'material',
                'micras' => 12,
                'ancho' => 100,
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => 0,
                'notes' => null,
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['supplier_id']);
    }

    public function test_store_miscelaneos_without_supplier_is_unprocessable(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $response = $this->postJson(
            '/api/materials',
            [
                'sku' => 'MISC-NO-SUP',
                'name' => 'Cinta',
                'barcode' => null,
                'inventory_area' => 'miscelaneos',
                'unit' => 'unidad',
                'min_stock' => 0,
                'quantity_on_hand' => 0,
                'notes' => null,
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['supplier_id']);
    }

    public function test_update_to_miscelaneos_preserves_supplier_when_not_cleared(): void
    {
        $user = User::factory()->create(['role' => 'inventory']);
        $token = $user->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Prov',
            'rif' => null,
            'email' => null,
            'phone' => null,
            'address' => null,
        ]);

        $material = Material::query()->create([
            'sku' => 'T-MOVE-1',
            'name' => 'Tinta',
            'barcode' => null,
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
            'notes' => null,
            'supplier_id' => $supplier->id,
        ]);
        TintaSubarea::query()->create([
            'material_id' => $material->id,
            'subarea' => 'laminacion',
        ]);

        $response = $this->patchJson(
            '/api/materials/'.$material->id,
            [
                'inventory_area' => 'miscelaneos',
                'unit' => 'unidad',
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonPath('supplier_id', $supplier->id);

        $material->refresh();
        $this->assertSame($supplier->id, (int) $material->supplier_id);
    }

    public function test_store_tintas_without_supplier_id_is_unprocessable(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $response = $this->postJson(
            '/api/materials',
            [
                'sku' => 'TINTA-NO-SUP',
                'name' => 'Tinta roja',
                'barcode' => null,
                'inventory_area' => 'tintas',
                'tinta_subarea' => 'laminacion',
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => 0,
                'notes' => null,
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['supplier_id']);
    }

    public function test_store_cementerio_tintas_requires_supplier_and_subarea(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Prov Cement',
            'rif' => null,
            'email' => null,
            'phone' => null,
            'address' => null,
        ]);

        $response = $this->postJson(
            '/api/materials',
            [
                'sku' => 'CEMENT-SUP-1',
                'name' => 'Tinta vieja',
                'barcode' => null,
                'inventory_area' => 'cementerio_tintas',
                'tinta_subarea' => 'superficie',
                'unit' => 'kg',
                'min_stock' => 0,
                'quantity_on_hand' => 0,
                'notes' => null,
                'supplier_id' => $supplier->id,
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertCreated();
        $response->assertJsonPath('inventory_area', 'cementerio_tintas');
        $response->assertJsonPath('supplier_id', $supplier->id);
    }

    public function test_store_miscelaneos_with_supplier(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $user->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Prov Misc',
            'rif' => null,
            'email' => null,
            'phone' => null,
            'address' => null,
        ]);

        $response = $this->postJson(
            '/api/materials',
            [
                'sku' => 'MISC-SUP-1',
                'name' => 'Cinta',
                'barcode' => null,
                'inventory_area' => 'miscelaneos',
                'unit' => 'unidad',
                'min_stock' => 0,
                'quantity_on_hand' => 0,
                'notes' => null,
                'supplier_id' => $supplier->id,
            ],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertCreated();
        $response->assertJsonPath('supplier_id', $supplier->id);
    }

    public function test_update_cementerio_tintas_preserves_supplier_when_patch_name_only(): void
    {
        $user = User::factory()->create(['role' => 'inventory']);
        $token = $user->createToken('t')->plainTextToken;

        $supplier = Supplier::query()->create([
            'name' => 'Prov Keep',
            'rif' => null,
            'email' => null,
            'phone' => null,
            'address' => null,
        ]);

        $material = Material::query()->create([
            'sku' => 'CEMENT-KEEP',
            'name' => 'Tinta cement',
            'barcode' => null,
            'inventory_area' => 'cementerio_tintas',
            'unit' => 'kg',
            'min_stock' => 0,
            'notes' => null,
            'supplier_id' => $supplier->id,
        ]);
        TintaSubarea::query()->create([
            'material_id' => $material->id,
            'subarea' => 'laminacion',
        ]);

        $response = $this->patchJson(
            '/api/materials/'.$material->id,
            ['name' => 'Tinta cement (renombrada)'],
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertJsonPath('supplier_id', $supplier->id);
        $response->assertJsonPath('inventory_area', 'cementerio_tintas');
    }
}
