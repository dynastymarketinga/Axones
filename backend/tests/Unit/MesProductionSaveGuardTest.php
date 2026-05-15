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
}
