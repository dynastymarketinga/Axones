import { describe, expect, it } from "vitest"

import {
  canSaveProductionAreaForm,
  hasProductionTimerStarted,
  MES_PRODUCTION_SAVE_CONFIG,
} from "./mes-timer-guards"

describe("hasProductionTimerStarted", () => {
  const base = {
    timerState: "pending",
    effectiveAccSec: 0,
    deadAccSec: 0,
    lastResumeAt: 0,
    pauseAt: 0,
    pauseEntriesCount: 0,
  }

  it("returns false when pending with no legacy signals", () => {
    expect(hasProductionTimerStarted(base)).toBe(false)
  })

  it("returns true when running", () => {
    expect(hasProductionTimerStarted({ ...base, timerState: "running" })).toBe(true)
  })

  it("returns true when stopped with accumulated effective time", () => {
    expect(
      hasProductionTimerStarted({ ...base, timerState: "stopped", effectiveAccSec: 12 }),
    ).toBe(true)
  })

  it("returns true with pause entries only", () => {
    expect(hasProductionTimerStarted({ ...base, pauseEntriesCount: 1 })).toBe(true)
  })
})

describe("canSaveProductionAreaForm", () => {
  const montConfig = MES_PRODUCTION_SAVE_CONFIG.montaje

  it("returns false without active turno", () => {
    expect(
      canSaveProductionAreaForm(
        { montTimerState: "running" },
        montConfig,
      ),
    ).toBe(false)
  })

  it("returns false with turno but timer never started", () => {
    expect(
      canSaveProductionAreaForm(
        {
          montTurnoActual: { id: "t1", operador: "Op", turno: "diurno", grupo: "A" },
          montTimerState: "pending",
        },
        montConfig,
      ),
    ).toBe(false)
  })

  it("returns true with turno and running timer", () => {
    expect(
      canSaveProductionAreaForm(
        {
          montTurnoActual: { id: "t1", operador: "Op", turno: "diurno", grupo: "A" },
          montTimerState: "running",
        },
        montConfig,
      ),
    ).toBe(true)
  })

  it("corte: legacy flat operador counts as open shift", () => {
    const corteConfig = MES_PRODUCTION_SAVE_CONFIG.corte
    expect(
      canSaveProductionAreaForm(
        {
          corOperador: "Ana",
          corTurno: "diurno",
          corGrupo: "A",
          corTimerState: "running",
        },
        corteConfig,
      ),
    ).toBe(true)
  })
})
