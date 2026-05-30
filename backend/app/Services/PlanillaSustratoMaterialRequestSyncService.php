<?php

namespace App\Services;

use App\Enums\MaterialRequestStatus;
use App\Models\MaterialRequest;
use App\Models\MaterialRequestLine;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Al guardar la planilla OT, convierte filas de sustratos virgen (impresión / laminación)
 * en solicitudes de insumos pendientes visibles en solicitudes entre áreas.
 */
class PlanillaSustratoMaterialRequestSyncService
{
    public const NOTES_MARKER = '[axones:planilla-sustratos]';

    /** @var list<array{form_key: string, originating_area: string, area_label: string}> */
    private const AREAS = [
        ['form_key' => 'sustratosVirgenImp', 'originating_area' => 'impresion', 'area_label' => 'Impresión'],
        ['form_key' => 'sustratosVirgenLam', 'originating_area' => 'laminacion', 'area_label' => 'Laminación'],
    ];

    public function __construct(
        private readonly MaterialRequestService $materialRequests,
    ) {}

    /**
     * @param  array<string, mixed>  $form
     * @return array{created: list<int>, updated: list<int>, cancelled: list<int>, skipped: list<string>}
     */
    public function syncFromPlanillaForm(WorkOrder $workOrder, array $form, User $user): array
    {
        $summary = [
            'created' => [],
            'updated' => [],
            'cancelled' => [],
            'skipped' => [],
        ];

        foreach (self::AREAS as $cfg) {
            try {
                $result = $this->syncArea(
                    $workOrder,
                    $form,
                    $user,
                    $cfg['form_key'],
                    $cfg['originating_area'],
                    $cfg['area_label'],
                );
                if ($result === null) {
                    continue;
                }
                $summary[$result['action']][] = $result['material_request_id'];
            } catch (ValidationException $e) {
                $summary['skipped'][] = sprintf(
                    '%s:%s',
                    $cfg['originating_area'],
                    implode('; ', array_map(
                        static fn ($msgs) => is_array($msgs) ? implode(', ', $msgs) : (string) $msgs,
                        $e->errors(),
                    )),
                );
            }
        }

        return $summary;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return array{action: 'created'|'updated'|'cancelled', material_request_id: int}|null
     */
    private function syncArea(
        WorkOrder $workOrder,
        array $form,
        User $user,
        string $formKey,
        string $originatingArea,
        string $areaLabel,
    ): ?array {
        $lines = $this->linesFromForm($form, $formKey);
        $existing = $this->findPlanillaRequest($workOrder, $originatingArea);

        if ($lines === []) {
            if ($existing !== null && $this->canReplaceLines($existing)) {
                $this->materialRequests->cancel($existing);
                $existing->refresh();

                return ['action' => 'cancelled', 'material_request_id' => (int) $existing->getKey()];
            }

            return null;
        }

        $this->materialRequests->validateConsumptionLinesForWorkOrder($lines);

        if ($existing === null) {
            $mr = $this->materialRequests->storePendingRequest(
                $workOrder->fresh(),
                $user,
                $lines,
                $originatingArea,
                $this->buildNotes($workOrder, $areaLabel),
            );

            return ['action' => 'created', 'material_request_id' => (int) $mr->getKey()];
        }

        if (! $this->canReplaceLines($existing)) {
            return null;
        }

        DB::transaction(function () use ($existing, $lines): void {
            MaterialRequestLine::query()
                ->where('material_request_id', $existing->getKey())
                ->delete();

            foreach ($lines as $line) {
                MaterialRequestLine::query()->create([
                    'material_request_id' => $existing->getKey(),
                    'material_id' => isset($line['material_id']) ? (int) $line['material_id'] : null,
                    'description' => $line['description'] ?? null,
                    'quantity_requested' => $line['quantity_requested'],
                    'quantity_dispatched' => 0,
                    'unit' => $line['unit'] ?? null,
                ]);
            }

            $existing->touch();
        });

        $this->materialRequests->refreshShadowAreaRequest(
            $existing->fresh()->load(['lines.material', 'workOrder']),
        );

        return ['action' => 'updated', 'material_request_id' => (int) $existing->getKey()];
    }

    private function findPlanillaRequest(WorkOrder $workOrder, string $originatingArea): ?MaterialRequest
    {
        return MaterialRequest::query()
            ->where('work_order_id', $workOrder->getKey())
            ->where('originating_area', $originatingArea)
            ->where('notes', 'like', self::NOTES_MARKER.'%')
            ->where('status', '!=', MaterialRequestStatus::Cancelled->value)
            ->orderByDesc('id')
            ->first();
    }

    private function canReplaceLines(MaterialRequest $mr): bool
    {
        if ($mr->status === MaterialRequestStatus::Cancelled->value) {
            return false;
        }

        if ($mr->status !== MaterialRequestStatus::Pending->value) {
            return false;
        }

        return ! MaterialRequestLine::query()
            ->where('material_request_id', $mr->getKey())
            ->where('quantity_dispatched', '>', 0)
            ->exists();
    }

    private function buildNotes(WorkOrder $workOrder, string $areaLabel): string
    {
        return sprintf(
            '%s OT %s — %s',
            self::NOTES_MARKER,
            $workOrder->code,
            $areaLabel,
        );
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array{material_id?: int, description?: string, quantity_requested: string, unit?: string}>
     */
    private function linesFromForm(array $form, string $formKey): array
    {
        $rows = $this->normalizeRows($form, $formKey);
        $lines = [];

        foreach ($rows as $row) {
            $kg = $this->normalizeKg($row['kg'] ?? null);
            if ($kg === null) {
                continue;
            }

            $free = trim((string) ($row['material_free_text'] ?? ''));
            $mid = isset($row['material_id']) && is_numeric($row['material_id'])
                ? (int) $row['material_id']
                : 0;

            if ($mid > 0) {
                $lines[] = [
                    'material_id' => $mid,
                    'quantity_requested' => $kg,
                    'unit' => 'kg',
                ];
            } elseif ($free !== '') {
                $lines[] = [
                    'description' => $free,
                    'quantity_requested' => $kg,
                    'unit' => 'kg',
                ];
            }
        }

        return $lines;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    private function normalizeRows(array $form, string $formKey): array
    {
        $raw = $form[$formKey] ?? null;
        if (is_array($raw) && $raw !== []) {
            $out = [];
            foreach ($raw as $row) {
                if (is_array($row)) {
                    $out[] = $row;
                }
            }

            return $out;
        }

        if ($formKey === 'sustratosVirgenImp') {
            $mid = trim((string) ($form['sustratoVirgenImp1'] ?? ''));
            $kg = trim((string) ($form['kgUtilizarImp1'] ?? ''));
            if ($mid !== '' || $kg !== '') {
                return [
                    [
                        'material_id' => $mid,
                        'kg' => $kg,
                        'material_free_text' => '',
                    ],
                ];
            }
        }

        return [];
    }

    private function normalizeKg(mixed $value): ?string
    {
        $kg = trim(str_replace(',', '.', (string) $value));
        if ($kg === '' || ! is_numeric($kg)) {
            return null;
        }
        if (bccomp($kg, '0', 3) !== 1) {
            return null;
        }

        return $kg;
    }
}
