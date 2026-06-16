<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Models\Material;
use App\Models\TintaSubarea;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MaterialBulkImportService
{
    private const NO_SUPPLIER_REASON = 'Importación inventario planta (Excel Victor)';

    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    public function import(array $rows, User $user, bool $dryRun = false, ?string $sourceFilename = null): array
    {
        $created = 0;
        $updated = 0;
        $stockAdjusted = 0;
        $unchanged = 0;
        $errors = [];

        $work = function () use ($rows, $user, $dryRun, $sourceFilename, &$created, &$updated, &$stockAdjusted, &$unchanged, &$errors): void {
            foreach ($rows as $index => $row) {
                try {
                    $result = $this->importRow($row, $user, $dryRun, $sourceFilename);
                    match ($result['action']) {
                        'created' => $created++,
                        'updated' => $updated++,
                        'stock_adjusted' => $stockAdjusted++,
                        default => $unchanged++,
                    };
                } catch (\Throwable $e) {
                    $errors[] = [
                        'index' => $index,
                        'sku' => (string) ($row['sku'] ?? ''),
                        'sheet_name' => (string) ($row['sheet_name'] ?? ''),
                        'row_number' => (int) ($row['row_number'] ?? 0),
                        'message' => $e->getMessage(),
                    ];
                }
            }
        };

        if ($dryRun) {
            DB::beginTransaction();
            try {
                $work();
            } finally {
                DB::rollBack();
            }
        } else {
            DB::transaction($work);
        }

        return [
            'dry_run' => $dryRun,
            'total_rows' => count($rows),
            'created' => $created,
            'updated' => $updated,
            'stock_adjusted' => $stockAdjusted,
            'unchanged' => $unchanged,
            'errors' => $errors,
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{action: string}
     */
    private function importRow(array $row, User $user, bool $dryRun, ?string $sourceFilename): array
    {
        $sku = mb_strtoupper(trim((string) ($row['sku'] ?? '')));
        $name = trim((string) ($row['name'] ?? ''));
        $area = trim((string) ($row['inventory_area'] ?? ''));
        $unit = trim((string) ($row['unit'] ?? 'kg'));
        $targetQty = $this->formatQty($row['quantity'] ?? 0);
        $tintaSubarea = trim((string) ($row['tinta_subarea'] ?? ''));
        $micras = $row['micras'] ?? null;
        $ancho = $row['ancho'] ?? null;
        $sheetName = trim((string) ($row['sheet_name'] ?? ''));

        if ($sku === '' || $name === '' || $area === '') {
            throw ValidationException::withMessages([
                'row' => ['Fila incompleta: SKU, nombre y área son obligatorios.'],
            ]);
        }

        if (! in_array($area, InventoryArea::values(), true)) {
            throw ValidationException::withMessages([
                'inventory_area' => ["Área inválida: {$area}"],
            ]);
        }

        if (in_array($area, [InventoryArea::Tintas->value, InventoryArea::CementerioTintas->value], true) && $tintaSubarea === '') {
            throw ValidationException::withMessages([
                'tinta_subarea' => ['Subárea obligatoria para tintas.'],
            ]);
        }

        /** @var Material|null $material */
        $material = Material::query()->where('sku', $sku)->first();
        $action = 'unchanged';
        $createdNow = false;

        if (! $material) {
            $material = Material::query()->create([
                'sku' => $sku,
                'name' => $name,
                'inventory_area' => $area,
                'unit' => $unit !== '' ? $unit : 'kg',
                'micras' => $micras !== null && $micras !== '' ? $micras : null,
                'ancho' => $ancho !== null && $ancho !== '' ? $ancho : null,
                'min_stock' => 0,
                'no_supplier_reason' => self::NO_SUPPLIER_REASON,
                'notes' => $sheetName !== '' ? "Hoja Excel: {$sheetName}" : null,
            ]);
            $action = 'created';
            $createdNow = true;
        } else {
            $dirty = false;
            if ($material->name !== $name) {
                $material->name = $name;
                $dirty = true;
            }
            if ($material->inventory_area !== $area) {
                $material->inventory_area = $area;
                $dirty = true;
            }
            if ($unit !== '' && $material->unit !== $unit) {
                $material->unit = $unit;
                $dirty = true;
            }
            if ($area === InventoryArea::Material->value) {
                $newMicras = $micras !== null && $micras !== '' ? (string) $micras : null;
                $newAncho = $ancho !== null && $ancho !== '' ? (string) $ancho : null;
                if ((string) ($material->micras ?? '') !== (string) ($newMicras ?? '')) {
                    $material->micras = $newMicras;
                    $dirty = true;
                }
                if ((string) ($material->ancho ?? '') !== (string) ($newAncho ?? '')) {
                    $material->ancho = $newAncho;
                    $dirty = true;
                }
            }
            if ($dirty) {
                $material->save();
                $action = 'updated';
            }
        }

        if (in_array($area, [InventoryArea::Tintas->value, InventoryArea::CementerioTintas->value], true)) {
            TintaSubarea::query()->updateOrCreate(
                ['material_id' => $material->getKey()],
                ['subarea' => $tintaSubarea]
            );
        }

        $current = $this->formatQty($material->fresh()->quantity_on_hand ?? '0');
        if (bccomp($current, $targetQty, 3) !== 0) {
            $delta = bcsub($targetQty, $current, 3);
            if (bccomp($delta, '0', 3) === 1) {
                $this->ledger->apply(
                    $material->fresh(),
                    InventoryMovementType::AdjustmentAdd,
                    $delta,
                    $user,
                    'victor_excel_import',
                    (int) $material->getKey(),
                    [
                        'reason' => 'Importación Excel Victor',
                        'source_filename' => $sourceFilename,
                        'sheet_name' => $sheetName,
                        'row_number' => $row['row_number'] ?? null,
                        'target_quantity' => $targetQty,
                        'previous_quantity' => $current,
                    ],
                );
            } elseif (bccomp($delta, '0', 3) === -1) {
                $this->ledger->apply(
                    $material->fresh(),
                    InventoryMovementType::AdjustmentSub,
                    bcmul($delta, '-1', 3),
                    $user,
                    'victor_excel_import',
                    (int) $material->getKey(),
                    [
                        'reason' => 'Importación Excel Victor',
                        'source_filename' => $sourceFilename,
                        'sheet_name' => $sheetName,
                        'row_number' => $row['row_number'] ?? null,
                        'target_quantity' => $targetQty,
                        'previous_quantity' => $current,
                    ],
                );
            }
            $action = $createdNow ? 'created' : ($action === 'updated' ? 'updated' : 'stock_adjusted');
            if (! $createdNow && $action === 'stock_adjusted') {
                // keep stock_adjusted
            } elseif ($createdNow) {
                $action = 'created';
            }
        }

        return ['action' => $action];
    }

    private function formatQty(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '0.000';
        }

        $normalized = str_replace(',', '.', trim((string) $value));
        if (! is_numeric($normalized)) {
            return '0.000';
        }

        return number_format((float) $normalized, 3, '.', '');
    }
}
