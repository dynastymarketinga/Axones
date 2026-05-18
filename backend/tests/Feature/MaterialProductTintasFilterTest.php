<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MaterialProductTintasFilterTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_tintas_product_filter_falls_back_to_all_when_assignments_missing_in_area(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $h = $this->auth($user);

        $product = Product::query()->create([
            'client_id' => null,
            'name' => 'Prod tintas fallback',
            'print_type' => 'reverso',
        ]);

        $inkInOtherArea = Material::query()->create([
            'sku' => 'MAT-INK-OTHER',
            'name' => 'Not a tinta',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $tintaA = Material::query()->create([
            'sku' => 'TIN-A',
            'name' => 'Tinta A',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $tintaB = Material::query()->create([
            'sku' => 'TIN-B',
            'name' => 'Tinta B',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        DB::table('product_ink_material')->insert([
            'product_id' => $product->id,
            'material_id' => $inkInOtherArea->id,
        ]);

        $response = $this->getJson('/api/materials?'.http_build_query([
            'inventory_area' => 'tintas',
            'product_id' => $product->id,
            'per_page' => 50,
        ]), $h);

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($tintaA->id, $ids);
        $this->assertContains($tintaB->id, $ids);
        $this->assertNotContains($inkInOtherArea->id, $ids);
    }

    public function test_tintas_product_filter_restricts_to_assigned_inks_in_area(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $h = $this->auth($user);

        $product = Product::query()->create([
            'client_id' => null,
            'name' => 'Prod tintas restrict',
            'print_type' => 'reverso',
        ]);

        $assigned = Material::query()->create([
            'sku' => 'TIN-ASSIGNED',
            'name' => 'Assigned',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $other = Material::query()->create([
            'sku' => 'TIN-OTHER',
            'name' => 'Other',
            'inventory_area' => 'tintas',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);

        DB::table('product_ink_material')->insert([
            'product_id' => $product->id,
            'material_id' => $assigned->id,
        ]);

        $response = $this->getJson('/api/materials?'.http_build_query([
            'inventory_area' => 'tintas',
            'product_id' => $product->id,
            'per_page' => 50,
        ]), $h);

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame([$assigned->id], $ids);
        $this->assertNotContains($other->id, $ids);
    }
}
