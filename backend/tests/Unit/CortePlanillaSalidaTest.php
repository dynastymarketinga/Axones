<?php

namespace Tests\Unit;

use App\Support\CortePlanillaSalida;
use PHPUnit\Framework\TestCase;

class CortePlanillaSalidaTest extends TestCase
{
    public function test_finished_kg_prefers_kg_salida_corte(): void
    {
        $form = [
            'kgSalidaCorte' => '12.00',
            'corAcumuladoProducidoKg' => '99',
            'cor_paletas' => [
                ['id' => 'p1', 'label' => 'P1', 'rollosKg' => ['50']],
            ],
        ];

        $this->assertSame('12.000', CortePlanillaSalida::finishedKgFromForm($form));
    }

    public function test_finished_kg_falls_back_to_acumulado(): void
    {
        $form = [
            'corAcumuladoProducidoKg' => '56.5',
        ];

        $this->assertSame('56.500', CortePlanillaSalida::finishedKgFromForm($form));
    }

    public function test_finished_kg_sums_paletas_when_no_explicit_salida(): void
    {
        $form = [
            'cor_paletas' => [
                [
                    'id' => 'p1',
                    'label' => 'Paleta #01',
                    'rollosKg' => ['12', '0', '32'],
                ],
            ],
        ];

        $this->assertSame('44.000', CortePlanillaSalida::finishedKgFromForm($form));
    }

    public function test_finished_kg_returns_zero_when_empty(): void
    {
        $this->assertSame('0.000', CortePlanillaSalida::finishedKgFromForm([]));
    }

    public function test_used_kg_from_ingresados(): void
    {
        $form = ['kgIngresadosCorte' => '100.5'];

        $this->assertSame('100.500', CortePlanillaSalida::usedKgFromForm($form));
    }

    public function test_paletas_array_merges_cor_turnos_and_cor_paletas(): void
    {
        $rollos = array_merge(['15.500'], array_fill(0, 47, ''));
        $form = [
            'cor_turnos' => [[
                'id' => 't1',
                'closed_at' => '2026-01-01T12:00:00Z',
                'paletas' => [[
                    'id' => 'p-hist',
                    'label' => 'Paleta hist',
                    'status' => 'en_progreso',
                    'rollosKg' => $rollos,
                ]],
            ]],
            'cor_paletas' => [[
                'id' => 'p-hist',
                'label' => 'Paleta hist',
                'status' => 'cerrada',
                'rollosKg' => $rollos,
            ]],
        ];

        $paletas = CortePlanillaSalida::paletasArrayFromForm($form);
        $this->assertCount(1, $paletas);
        $this->assertSame('cerrada', $paletas[0]['status']);
        $this->assertSame('15.500', number_format(CortePlanillaSalida::sumPaletaKg($paletas[0]), 3, '.', ''));
        $this->assertCount(1, CortePlanillaSalida::closedPaletasFromForm($form));
    }
}
