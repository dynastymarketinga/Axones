<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

/**
 * Valida que un guardado MES de producción tenga turno abierto y cronómetro iniciado.
 */
class MesProductionSaveGuard
{
    /** @var array<string, array{prefix: string, actual_key: string, legacy_turno_keys?: list<string>}> */
    private const AREA_CONFIG = [
        'montaje' => ['prefix' => 'mont', 'actual_key' => 'montTurnoActual'],
        'impresion' => [
            'prefix' => 'imp',
            'actual_key' => 'impTurnoActual',
            'legacy_turno_keys' => ['impOperador', 'impTurno', 'impGrupo'],
        ],
        'laminacion' => ['prefix' => 'lam', 'actual_key' => 'lamTurnoActual'],
        'corte' => [
            'prefix' => 'cor',
            'actual_key' => 'corTurnoActual',
            'legacy_turno_keys' => ['cor_turno_actual', 'corOperador', 'corTurno', 'corGrupo'],
        ],
    ];

    /**
     * @param  array<string, mixed>  $form
     */
    public static function assertProductionSaveAllowed(string $originArea, array $form): void
    {
        $area = strtolower(trim($originArea));
        if ($area === '' || ! isset(self::AREA_CONFIG[$area])) {
            return;
        }

        $config = self::AREA_CONFIG[$area];
        if (! self::hasActiveTurno($form, $config['actual_key'], $config['legacy_turno_keys'] ?? [])) {
            throw ValidationException::withMessages([
                'form' => ['Abra un turno de planta antes de guardar la producción.'],
            ]);
        }

        if (! self::hasProductionTimerStarted($form, $config['prefix'])) {
            throw ValidationException::withMessages([
                'form' => ['Inicie el cronómetro de producción (play) antes de guardar.'],
            ]);
        }
    }

    /**
     * Cierre de turno de planta: el formulario pasa a sin turno actual (null) tras haber tenido uno abierto.
     * En ese caso no exigir turno+cronómetro activos aunque notify_on_production_save sea true.
     *
     * @param  array<string, mixed>  $previousForm
     * @param  array<string, mixed>  $mergedForm
     */
    public static function shouldSkipSaveGuardForTurnClose(
        string $originArea,
        array $previousForm,
        array $mergedForm,
    ): bool {
        $area = strtolower(trim($originArea));
        if ($area === '' || ! isset(self::AREA_CONFIG[$area])) {
            return false;
        }

        $config = self::AREA_CONFIG[$area];
        $actualKey = $config['actual_key'];
        if (array_key_exists($actualKey, $mergedForm) && $mergedForm[$actualKey] !== null) {
            return false;
        }

        return self::hasOpenTurnoInForm(
            $previousForm,
            $actualKey,
            $config['legacy_turno_keys'] ?? [],
        );
    }

    /**
     * @param  array<string, mixed>  $form
     * @param  list<string>  $legacyTurnoKeys
     */
    private static function hasOpenTurnoInForm(array $form, string $actualKey, array $legacyTurnoKeys): bool
    {
        $actual = $form[$actualKey] ?? null;
        if (is_array($actual) && $actual !== [] && ! self::turnoEntryIsClosed($actual)) {
            return true;
        }

        return self::hasActiveTurno($form, $actualKey, $legacyTurnoKeys);
    }

    /**
     * @param  array<string, mixed>  $turno
     */
    private static function turnoEntryIsClosed(array $turno): bool
    {
        $closed = $turno['closed_at'] ?? null;

        return is_string($closed) && trim($closed) !== '';
    }

    /**
     * @param  array<string, mixed>  $form
     * @param  list<string>  $legacyTurnoKeys
     */
    private static function hasActiveTurno(array $form, string $actualKey, array $legacyTurnoKeys): bool
    {
        $actual = $form[$actualKey] ?? null;
        if (is_array($actual) && $actual !== []) {
            return true;
        }

        foreach ($legacyTurnoKeys as $key) {
            $v = $form[$key] ?? null;
            if (is_string($v) && trim($v) !== '') {
                return true;
            }
            if (is_array($v) && $v !== []) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function hasProductionTimerStarted(array $form, string $prefix): bool
    {
        $state = strtolower(trim((string) ($form[$prefix . 'TimerState'] ?? 'pending')));
        if (in_array($state, ['running', 'paused', 'stopped', 'completed'], true)) {
            return true;
        }

        if (self::numericField($form, $prefix . 'TimerEffectiveAccSec') > 0) {
            return true;
        }
        if (self::numericField($form, $prefix . 'TimerDeadAccSec') > 0) {
            return true;
        }
        if (self::numericField($form, $prefix . 'TimerLastResumeAtMs') > 0) {
            return true;
        }
        if (self::numericField($form, $prefix . 'TimerPauseAtMs') > 0) {
            return true;
        }

        $pauses = $form[$prefix . 'TimerPauses'] ?? null;
        if (is_array($pauses)) {
            foreach ($pauses as $entry) {
                if (! is_array($entry)) {
                    continue;
                }
                $reason = trim((string) ($entry['reason'] ?? ''));
                if ($reason !== '') {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private static function numericField(array $form, string $key): float
    {
        $v = $form[$key] ?? 0;
        if (is_numeric($v)) {
            return (float) $v;
        }
        if (is_string($v) && is_numeric(trim($v))) {
            return (float) trim($v);
        }

        return 0.0;
    }
}
