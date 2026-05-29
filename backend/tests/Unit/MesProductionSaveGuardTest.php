<?php

namespace Tests\Unit;

use App\Support\MesProductionSaveGuard;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class MesProductionSaveGuardTest extends TestCase
{
    public function test_allows_save_with_turno_and_running_timer(): void
    {
        MesProductionSaveGuard::assertProductionSaveAllowed('montaje', [
            'montTurnoActual' => ['id' => 't1', 'operador' => 'Op'],
            'montTimerState' => 'running',
        ]);

        $this->assertTrue(true);
    }

    public function test_rejects_save_without_timer(): void
    {
        $this->expectException(ValidationException::class);

        MesProductionSaveGuard::assertProductionSaveAllowed('montaje', [
            'montTurnoActual' => ['id' => 't1', 'operador' => 'Op'],
            'montTimerState' => 'pending',
        ]);
    }

    public function test_rejects_save_without_turno(): void
    {
        $this->expectException(ValidationException::class);

        MesProductionSaveGuard::assertProductionSaveAllowed('laminacion', [
            'lamTimerState' => 'running',
        ]);
    }

    public function test_skip_guard_when_closing_open_printing_turno(): void
    {
        $previous = [
            'impTurnoActual' => [
                'id' => 't1',
                'operador' => 'Op',
                'timer' => ['state' => 'running', 'effectiveAccSec' => 40],
            ],
            'impTimerState' => 'running',
        ];
        $merged = [
            'impTurnoActual' => null,
            'impTurnosImpresion' => [
                ['id' => 't1', 'closed_at' => '2026-05-28T21:24:11Z', 'operador' => 'Op'],
            ],
            'impTimerState' => 'completed',
        ];

        $this->assertTrue(
            MesProductionSaveGuard::shouldSkipSaveGuardForTurnClose('impresion', $previous, $merged),
        );
    }

    public function test_does_not_skip_guard_when_no_turno_was_open(): void
    {
        $this->assertFalse(
            MesProductionSaveGuard::shouldSkipSaveGuardForTurnClose('impresion', [], [
                'impTurnoActual' => null,
            ]),
        );
    }
}
