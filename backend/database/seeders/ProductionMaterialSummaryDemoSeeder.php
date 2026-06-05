<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Material;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Illuminate\Database\Seeder;

/**
 * Casos de prueba para el reporte Resumen de producción (/reportes/resumen-produccion).
 * Crea OTs con desglose por BOPP, PET/poliéster, laminación y corte con kg plausibles.
 *
 * Uso:
 *   php artisan db:seed --class=ProductionMaterialSummaryDemoSeeder
 *
 * Período sugerido en UI: 06/05/2026 — 05/06/2026
 */
class ProductionMaterialSummaryDemoSeeder extends Seeder
{
    private const PERIOD_DATE = '2026-06-04';

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('ProductionMaterialSummaryDemoSeeder no puede ejecutarse en production.');

            return;
        }

        $this->command?->info('Sembrando casos demo — Resumen de producción (material por sustrato)…');

        $client = Client::query()->updateOrCreate(
            ['rif' => 'J-RESUMEN-DEMO'],
            ['name' => 'Cliente Resumen Demo', 'state' => 'Portuguesa', 'city' => 'Acarigua'],
        );

        $bopp = $this->ensureMaterial('AX-RESUMEN-BOPP', 'BOPP 20μ ancho 560 mm (resumen demo)');
        $pet = $this->ensureMaterial('AX-RESUMEN-PET', 'Poliéster (PET) 12μ metalizado (resumen demo)');
        $pe = $this->ensureMaterial('AX-RESUMEN-PE', 'Polietileno transparente 50μ (resumen demo)');

        $createdBy = User::query()->orderBy('id')->value('id');

        $cases = [
            [
                'code' => 'OT-RESUMEN-01-BOPP',
                'product_name' => 'Etiqueta demo BOPP',
                'product_structure' => 'BOPP / tinta',
                'substrate_material_ids' => [$bopp->id],
                'form' => $this->formImpresoSustratoPlanilla('BOPP 20μ', 420, ['180', '120', '80'], 3),
            ],
            [
                'code' => 'OT-RESUMEN-02-REF',
                'product_name' => 'Etiqueta demo referencia bobina',
                'product_structure' => 'PET / tinta',
                'substrate_material_ids' => [$pet->id],
                'form' => $this->formImpresoReferenciaBobina([
                    ['kg' => '200', 'ref' => 'BOPP 20μ', 'prov' => 'Proveedor A'],
                    ['kg' => '150', 'ref' => 'Poliéster (PET) 12μ', 'prov' => ''],
                ]),
            ],
            [
                'code' => 'OT-RESUMEN-03-MIX',
                'product_name' => 'Trilaminado demo BOPP + PET',
                'product_structure' => 'BOPP / PET / PE',
                'substrate_material_ids' => [$bopp->id, $pet->id],
                'form' => $this->formImpresoSustratosMixtos(),
            ],
            [
                'code' => 'OT-RESUMEN-04-LAM',
                'product_name' => 'Laminado demo PE virgen',
                'product_structure' => 'BOPP / PE',
                'substrate_material_ids' => [$pe->id],
                'form' => $this->formLaminacionSustrato('Polietileno transparente 50μ', 280, ['140', '90']),
            ],
            [
                'code' => 'OT-RESUMEN-05-CORTE',
                'product_name' => 'Producto terminado demo corte',
                'product_structure' => 'BOPP / tinta / corte',
                'substrate_material_ids' => [$bopp->id],
                'finished_material' => $this->ensureFinishedMaterial('PT-RESUMEN-CORTE', 'Empaque demo resumen · terminado'),
                'form' => $this->formCorteProductoTerminado(),
            ],
            [
                'code' => 'OT-RESUMEN-06-COMPLETO',
                'product_name' => 'Flujo completo imp + lam + corte',
                'product_structure' => 'BOPP / PET / laminado',
                'substrate_material_ids' => [$bopp->id, $pet->id],
                'finished_material' => $this->ensureFinishedMaterial('PT-RESUMEN-FULL', 'Snack bag demo · terminado'),
                'form' => $this->formCompleto(),
            ],
        ];

        foreach ($cases as $case) {
            $this->upsertCase($client, $case, $createdBy);
        }

        $this->patchExistingOt202600001($bopp);

        $this->command?->newLine();
        $this->command?->info('Listo. OTs demo (filtro 06/05/2026 — 05/06/2026):');
        foreach ($cases as $case) {
            $this->command?->line("  • {$case['code']} — {$case['product_name']}");
        }
        $this->command?->line('  • OT-2026-00001 — actualizada con sustrato BOPP en planilla (si existía)');
        $this->command?->warn('Abra /axones/reportes/resumen-produccion y pulse Actualizar.');
    }

    private function ensureMaterial(string $sku, string $name): Material
    {
        $mat = Material::query()->where('sku', $sku)->first();
        if ($mat !== null) {
            $mat->update(['name' => $name, 'inventory_area' => 'material', 'unit' => 'kg']);

            return $mat->fresh();
        }

        return Material::query()->create([
            'sku' => $sku,
            'name' => $name,
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
            'quantity_on_hand' => 500,
        ]);
    }

    private function ensureFinishedMaterial(string $sku, string $name): Material
    {
        $mat = Material::query()->where('sku', $sku)->first();
        if ($mat !== null) {
            return $mat->fresh();
        }

        return Material::query()->create([
            'sku' => $sku,
            'name' => $name,
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
            'quantity_on_hand' => 0,
        ]);
    }

    /**
     * @param  array<string, mixed>  $case
     */
    private function upsertCase(Client $client, array $case, ?int $createdBy): void
    {
        $product = Product::query()->updateOrCreate(
            [
                'client_id' => $client->id,
                'name' => $case['product_name'],
            ],
            [
                'cpe' => 'CPE-'.strtoupper(substr(md5($case['code']), 0, 6)),
                'structure' => $case['product_structure'] ?? '',
            ],
        );

        $substrateIds = $case['substrate_material_ids'] ?? [];
        if (isset($case['finished_material'])) {
            $substrateIds[] = $case['finished_material']->id;
        }
        if ($substrateIds !== []) {
            $product->substrateMaterials()->syncWithoutDetaching(array_values(array_unique($substrateIds)));
        }

        $wo = WorkOrder::query()->updateOrCreate(
            ['code' => $case['code']],
            [
                'client_id' => $client->id,
                'product_id' => $product->id,
                'document_date' => self::PERIOD_DATE,
                'status' => 'open',
                'created_by' => $createdBy,
            ],
        );

        WorkOrderTechnicalDocument::query()->updateOrCreate(
            ['work_order_id' => $wo->id],
            ['form' => $case['form']],
        );
    }

    private function patchExistingOt202600001(Material $bopp): void
    {
        $wo = WorkOrder::query()->where('code', 'OT-2026-00001')->first();
        if ($wo === null) {
            return;
        }

        $doc = WorkOrderTechnicalDocument::query()->where('work_order_id', $wo->id)->first();
        if ($doc === null) {
            return;
        }

        /** @var array<string, mixed> $form */
        $form = is_array($doc->form) ? $doc->form : [];
        $form['sustratosVirgenImp'] = [
            [
                'material_id' => (string) $bopp->id,
                'kg' => '420.50',
                'material_free_text' => '',
            ],
        ];
        $paletaDemo = [
            'id' => 'p-01',
            'label' => 'Paleta #01',
            'status' => 'cerrada',
            'rollosKg' => array_merge(['85.50', '48.25'], array_fill(0, 46, '')),
        ];
        $form['cor_paletas'] = [$paletaDemo];
        $form['kgSalidaCorte'] = '133.75';
        unset($form['corAcumuladoProducidoKg']);

        $actual = $form['corTurnoActual'] ?? $form['cor_turno_actual'] ?? null;
        if (is_array($actual)) {
            $actual['paletas'] = [$paletaDemo];
            $form['corTurnoActual'] = $actual;
        }

        if ($wo->product_id !== null) {
            Product::query()->find($wo->product_id)?->substrateMaterials()->syncWithoutDetaching([$bopp->id]);
        }

        $doc->update(['form' => $form]);
        $wo->update(['document_date' => self::PERIOD_DATE]);

        $this->command?->line('  ↳ OT-2026-00001: sustrato BOPP vinculado desde inventario.');
    }

    /**
     * @param  list<string>  $salidaKg
     * @return array<string, mixed>
     */
    private function formImpresoSustratoPlanilla(string $sustratoLabel, float $sustratoKg, array $salidaKg, int $closedAtDay): array
    {
        $meta = array_map(fn () => ['referencia' => '', 'proveedor' => ''], $salidaKg);

        return [
            'sustratosVirgenImp' => [
                ['material_id' => '', 'kg' => (string) $sustratoKg, 'material_free_text' => $sustratoLabel],
            ],
            'impTurnosImpresion' => [[
                'id' => 'turno-demo-1',
                'closed_at' => '2026-06-0'.$closedAtDay.'T14:00:00Z',
                'salidaBobinasKg' => $salidaKg,
                'salidaBobinasMeta' => $meta,
                'resumenCierre' => [
                    'pesoSalidaKg' => array_sum(array_map('floatval', $salidaKg)),
                    'numBobinasSalida' => count($salidaKg),
                ],
            ]],
        ];
    }

    /**
     * @param  list<array{kg: string, ref: string, prov: string}>  $bobinas
     * @return array<string, mixed>
     */
    private function formImpresoReferenciaBobina(array $bobinas): array
    {
        $salidaKg = array_column($bobinas, 'kg');
        $meta = array_map(
            fn (array $b): array => ['referencia' => $b['ref'], 'proveedor' => $b['prov']],
            $bobinas,
        );

        return [
            'impTurnosImpresion' => [[
                'id' => 'turno-ref',
                'closed_at' => '2026-06-03T10:00:00Z',
                'salidaBobinasKg' => $salidaKg,
                'salidaBobinasMeta' => $meta,
            ]],
        ];
    }

    /** @return array<string, mixed> */
    private function formImpresoSustratosMixtos(): array
    {
        return [
            'sustratosVirgenImp' => [
                ['material_id' => '', 'kg' => '300', 'material_free_text' => 'BOPP 20μ'],
                ['material_id' => '', 'kg' => '100', 'material_free_text' => 'Poliéster (PET) 12μ'],
            ],
            'impTurnosImpresion' => [[
                'id' => 'turno-mix',
                'closed_at' => '2026-06-02T16:00:00Z',
                'salidaBobinasKg' => ['400'],
                'salidaBobinasMeta' => [['referencia' => '', 'proveedor' => '']],
            ]],
        ];
    }

    /**
     * @param  list<string>  $salidaKg
     * @return array<string, mixed>
     */
    private function formLaminacionSustrato(string $sustratoLabel, float $sustratoKg, array $salidaKg): array
    {
        return [
            'sustratosVirgenLam' => [
                ['material_id' => '', 'kg' => (string) $sustratoKg, 'material_free_text' => $sustratoLabel],
            ],
            'lamTurnosLaminacion' => [[
                'id' => 'lam-1',
                'closed_at' => '2026-06-04T11:00:00Z',
                'salidaBobinasKg' => $salidaKg,
                'salidaBobinasMeta' => array_map(
                    fn () => ['referencia' => $sustratoLabel, 'proveedor' => ''],
                    $salidaKg,
                ),
            ]],
        ];
    }

    /** @return array<string, mixed> */
    private function formCorteProductoTerminado(): array
    {
        return [
            'cor_paletas' => [[
                'id' => 'p-resumen-corte',
                'label' => 'Paleta demo corte',
                'status' => 'cerrada',
                'rollosKg' => ['125.50', '88.25', '', ''],
            ]],
            'kgSalidaCorte' => '213.75',
        ];
    }

    /** @return array<string, mixed> */
    private function formCompleto(): array
    {
        return array_merge(
            $this->formImpresoSustratoPlanilla('BOPP 20μ', 200, ['120', '80'], 1),
            [
                'sustratosVirgenLam' => [
                    ['material_id' => '', 'kg' => '150', 'material_free_text' => 'Poliéster (PET) 12μ'],
                ],
                'lamTurnosLaminacion' => [[
                    'id' => 'lam-full',
                    'closed_at' => '2026-06-04T12:00:00Z',
                    'salidaBobinasKg' => ['95'],
                    'salidaBobinasMeta' => [['referencia' => 'Poliéster (PET) 12μ', 'proveedor' => '']],
                ]],
                'cor_paletas' => [[
                    'id' => 'p-full',
                    'label' => 'Paleta full',
                    'status' => 'cerrada',
                    'rollosKg' => ['45.00', '32.50'],
                ]],
                'kgSalidaCorte' => '77.50',
            ],
        );
    }
}
