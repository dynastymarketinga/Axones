<?php

namespace App\Services;

use App\Models\Material;
use App\Models\WorkOrder;
use Illuminate\Support\Collection;

class WorkOrderPlanillaReportService
{
    public function __construct(
        private readonly WorkOrderOrdenTrabajoService $ordenTrabajo,
    ) {}

    /**
     * @return array{
     *   order: WorkOrder,
     *   m: array<string, mixed>,
     *   sustratosImp: list<array{kg: string, label: string, metros: string}>,
     *   sustratosLam: list<array{kg: string, label: string, metros: string}>
     * }
     */
    public function buildViewDataForBlade(WorkOrder $workOrder): array
    {
        $workOrder->loadMissing([
            'client',
            'product',
            'productionItems',
            'technicalDocument',
        ]);

        $prefill = $this->ordenTrabajo->buildPrefill($workOrder);
        /** @var array<string, mixed> $form */
        $form = is_array($workOrder->technicalDocument?->form) ? $workOrder->technicalDocument->form : [];

        /** @var array<string, mixed> $merged */
        $merged = array_merge($prefill, $form);

        foreach (['cliente', 'clienteRif', 'producto'] as $k) {
            if (array_key_exists($k, $prefill) && $prefill[$k] !== null && (string) $prefill[$k] !== '') {
                $merged[$k] = $prefill[$k];
            }
        }

        $materialIds = $this->collectSubstrateMaterialIds($merged);
        $materialsById = $materialIds === []
            ? collect()
            : Material::query()->whereIn('id', $materialIds)->get(['id', 'sku', 'name'])->keyBy('id');

        return [
            'order' => $workOrder,
            'm' => $merged,
            'sustratosImp' => $this->resolveSubstrateRows($merged, 'sustratosVirgenImp', $materialsById),
            'sustratosLam' => $this->resolveSubstrateRows($merged, 'sustratosVirgenLam', $materialsById),
        ];
    }

    /**
     * @param  array<string, mixed>  $merged
     * @return list<int>
     */
    private function collectSubstrateMaterialIds(array $merged): array
    {
        $ids = [];
        foreach (['sustratosVirgenImp', 'sustratosVirgenLam'] as $key) {
            $raw = $merged[$key] ?? null;
            if (! is_array($raw)) {
                continue;
            }
            foreach ($raw as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $mid = isset($row['material_id']) ? (int) $row['material_id'] : 0;
                if ($mid > 0) {
                    $ids[] = $mid;
                }
            }
        }

        $legacyImp = isset($merged['sustratoVirgenImp1']) ? (int) $merged['sustratoVirgenImp1'] : 0;
        if ($legacyImp > 0) {
            $ids[] = $legacyImp;
        }

        return array_values(array_unique($ids));
    }

    /**
     * @param  array<string, mixed>  $merged
     * @param  Collection<int, Material>  $materialsById
     * @return list<array{kg: string, label: string, metros: string}>
     */
    private function resolveSubstrateRows(array $merged, string $key, Collection $materialsById): array
    {
        $raw = $merged[$key] ?? null;
        $out = [];

        if (is_array($raw) && $raw !== []) {
            foreach ($raw as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $mid = isset($row['material_id']) ? (int) $row['material_id'] : 0;
                $kg = isset($row['kg']) ? trim((string) $row['kg']) : '';
                $metros = isset($row['metros']) ? trim((string) $row['metros']) : '';
                $mat = $mid > 0 ? $materialsById->get($mid) : null;
                $label = $mat ? trim((string) ($mat->sku ?? '').' — '.(string) ($mat->name ?? '')) : ($mid > 0 ? 'ID '.$mid : '—');
                $out[] = [
                    'kg' => $kg !== '' ? $kg : '—',
                    'label' => $label !== '' ? $label : '—',
                    'metros' => $metros !== '' ? $metros : '—',
                ];
            }
        } elseif ($key === 'sustratosVirgenImp') {
            $mid = isset($merged['sustratoVirgenImp1']) ? (int) $merged['sustratoVirgenImp1'] : 0;
            $kg = isset($merged['kgUtilizarImp1']) ? trim((string) $merged['kgUtilizarImp1']) : '';
            if ($mid > 0 || $kg !== '') {
                $mat = $mid > 0 ? $materialsById->get($mid) : null;
                $label = $mat ? trim((string) ($mat->sku ?? '').' — '.(string) ($mat->name ?? '')) : ($mid > 0 ? 'ID '.$mid : '—');
                $out[] = ['kg' => $kg !== '' ? $kg : '—', 'label' => $label, 'metros' => '—'];
            }
        }

        if ($out === []) {
            $out[] = ['kg' => '—', 'label' => '—', 'metros' => '—'];
        }

        return $out;
    }
}
