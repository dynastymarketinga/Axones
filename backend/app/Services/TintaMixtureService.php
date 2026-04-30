<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Models\Material;
use App\Models\TintaMixture;
use App\Models\TintaMixtureComponent;
use App\Models\TintaSubarea;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TintaMixtureService
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    /**
     * Crea el material de salida, descuenta bases del inventario y da de alta el total mezclado como entrada.
     * La cantidad del producto mezclado = suma de cantidades de componentes (balance de masa).
     *
     * @param  array{output_sku: string, output_name: string, output_barcode?: string|null, output_inventory_area?: string, output_tinta_subarea?: string|null, unit?: string|null, notes?: string|null, components: list<array{material_id: int, quantity: string|float}>}  $data
     */
    public function create(array $data, User $user): TintaMixture
    {
        $this->assertCanCreateMixture($user);

        return DB::transaction(function () use ($data, $user) {
            $area = $data['output_inventory_area'] ?? InventoryArea::Tintas->value;

            $output = Material::query()->create([
                'sku' => $data['output_sku'],
                'name' => $data['output_name'],
                'barcode' => $data['output_barcode'] ?? null,
                'inventory_area' => $area,
                'unit' => $data['unit'] ?? 'kg',
                'min_stock' => 0,
                'notes' => null,
            ]);

            if ($area === InventoryArea::Tintas->value) {
                $subarea = trim((string) ($data['output_tinta_subarea'] ?? 'superficie'));
                TintaSubarea::query()->updateOrCreate(
                    ['material_id' => $output->getKey()],
                    ['subarea' => $subarea === '' ? 'superficie' : $subarea]
                );
            }

            $mixture = TintaMixture::query()->create([
                'output_material_id' => $output->getKey(),
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->getKey(),
            ]);

            $sorted = collect($data['components'])->sortBy('material_id')->values()->all();

            $total = '0';
            foreach ($sorted as $row) {
                $qty = (string) $row['quantity'];
                $total = bcadd($total, $qty, 3);

                TintaMixtureComponent::query()->create([
                    'tinta_mixture_id' => $mixture->getKey(),
                    'material_id' => (int) $row['material_id'],
                    'quantity' => $qty,
                ]);
            }

            if (bccomp($total, '0', 3) !== 1) {
                throw ValidationException::withMessages([
                    'components' => ['La suma de componentes debe ser mayor que cero.'],
                ]);
            }

            foreach ($sorted as $row) {
                $material = Material::query()->findOrFail((int) $row['material_id']);
                $this->ledger->apply(
                    $material,
                    InventoryMovementType::Out,
                    (string) $row['quantity'],
                    $user,
                    'tinta_mixture',
                    $mixture->getKey(),
                    ['step' => 'component_consumption', 'output_material_id' => $output->getKey()],
                );
            }

            $this->ledger->apply(
                $output->fresh(),
                InventoryMovementType::In,
                $total,
                $user,
                'tinta_mixture',
                $mixture->getKey(),
                ['step' => 'mixture_output', 'components_count' => count($sorted)],
            );

            return $mixture->fresh()->load(['components.material', 'outputMaterial', 'creator']);
        });
    }

    /**
     * @throws AuthorizationException
     */
    private function assertCanCreateMixture(User $user): void
    {
        $role = mb_strtolower(trim((string) ($user->role ?? '')));
        $allowed = ['tintas', 'boss', 'admin', 'jefe_supremo', 'superadmin'];
        if (! in_array($role, $allowed, true)) {
            throw new AuthorizationException('No autorizado para registrar mezclas de tinta.');
        }
    }
}
