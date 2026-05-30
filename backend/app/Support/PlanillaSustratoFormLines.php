<?php

namespace App\Support;

/**
 * Filas de sustratos virgen en planilla OT (impresión / laminación) con material de inventario.
 */
final class PlanillaSustratoFormLines
{
    /** @var list<array{form_key: string, area_label: string, originating_area: string}> */
    private const AREAS = [
        ['form_key' => 'sustratosVirgenImp', 'area_label' => 'Impresión', 'originating_area' => 'impresion'],
        ['form_key' => 'sustratosVirgenLam', 'area_label' => 'Laminación', 'originating_area' => 'laminacion'],
    ];

    /**
     * @param  array<string, mixed>  $form
     * @return list<array{material_id: int, quantity_requested: string, area_label: string, originating_area: string}>
     */
    public static function catalogMaterialLines(array $form): array
    {
        $lines = [];

        foreach (self::AREAS as $cfg) {
            foreach (self::normalizeRows($form, $cfg['form_key']) as $row) {
                $kg = self::normalizeKg($row['kg'] ?? null);
                if ($kg === null) {
                    continue;
                }

                $free = trim((string) ($row['material_free_text'] ?? ''));
                if ($free !== '') {
                    continue;
                }

                $mid = isset($row['material_id']) && is_numeric($row['material_id'])
                    ? (int) $row['material_id']
                    : 0;
                if ($mid < 1) {
                    continue;
                }

                $lines[] = [
                    'material_id' => $mid,
                    'quantity_requested' => $kg,
                    'area_label' => $cfg['area_label'],
                    'originating_area' => $cfg['originating_area'],
                ];
            }
        }

        return $lines;
    }

    /**
     * @param  array<string, mixed>  $form
     * @return list<array<string, mixed>>
     */
    private static function normalizeRows(array $form, string $formKey): array
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

    private static function normalizeKg(mixed $value): ?string
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
