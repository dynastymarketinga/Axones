<?php

namespace Tests\Unit;

use App\Support\MontajePlanillaMetrics;
use PHPUnit\Framework\TestCase;

class MontajePlanillaMetricsTest extends TestCase
{
    public function test_compute_desarrollo_from_frecuencia_and_repeticion(): void
    {
        $this->assertSame('836±4', MontajePlanillaMetrics::computeDesarrollo('209±1', '4'));
    }

    public function test_compute_ancho_montaje_from_ancho_corte_and_bandas(): void
    {
        $this->assertSame('357±2', MontajePlanillaMetrics::computeAnchoMontaje('357±2', '1'));
        $this->assertSame('714±4', MontajePlanillaMetrics::computeAnchoMontaje('357±2', '2'));
    }

    public function test_apply_auto_fields_on_form_array(): void
    {
        $form = [
            'frecuencia' => '209±1',
            'numRepeticion' => '4',
            'anchoCorteMontaje' => '357±2',
            'numBandas' => '1',
            'desarrollo' => '490',
            'anchoMontaje' => '407',
        ];

        $out = MontajePlanillaMetrics::applyAutoFields($form);

        $this->assertSame('836±4', $out['desarrollo']);
        $this->assertSame('357±2', $out['anchoMontaje']);
    }
}
