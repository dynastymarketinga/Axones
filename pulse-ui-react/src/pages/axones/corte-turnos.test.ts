import { describe, expect, it } from "vitest"

import {
  COR_ACTUAL_KEY,
  bootstrapCorteFormState,
  createNewCorteTurno,
  corteTurnoToMirror,
  getCorPaletas,
  isCorPaletaCerrada,
  legacyActiveTurnoFromForm,
  materializeOpenCorteTurnoActual,
  pickAuthoritativeCorPaletas,
  pauseCorteProductionTimerOnForm,
  shouldPreferTopCorPaletas,
  resolveCorteDisplayTimer,
  startCorteProductionTimerOnForm,
  syncCorteEntradaFields,
  syncCorteFormMetrics,
  sumEntradaKgFromForm,
  sumSalidaKgFromClosedPaletas,
  sumSalidaKgFromPaletas,
  sanitizeCorPaletasForPersistence,
} from "./corte-turnos"
import type { CorPaleta } from "./corte-turnos"

describe("resolveCorteDisplayTimer", () => {
  it("prefers flat running timer when nested is still pending", () => {
    const turno = legacyActiveTurnoFromForm({
      corOperador: "Ana",
      corTurno: "diurno",
      corGrupo: "A",
    })
    expect(turno).not.toBeNull()
    const form = {
      corTimerState: "running",
      corTimerLastResumeAtMs: 1_700_000_000_000,
      corTimerStartedAtMs: 1_700_000_000_000,
    }
    const timer = resolveCorteDisplayTimer(turno, form)
    expect(timer.state).toBe("running")
    expect(timer.lastResumeAtMs).toBe(1_700_000_000_000)
  })
})

describe("resolveCorteDisplayTimer desync", () => {
  it("prefers flat paused when nested still running", () => {
    const turno = legacyActiveTurnoFromForm({
      corOperador: "Ana",
      corTurno: "diurno",
      corGrupo: "A",
      corTimerState: "running",
      corTimerLastResumeAtMs: 1_700_000_000_000,
    })
    expect(turno).not.toBeNull()
    const form = { corTimerState: "paused", corTimerPauseAtMs: 1_700_000_100_000 }
    const timer = resolveCorteDisplayTimer(turno, form)
    expect(timer.state).toBe("paused")
  })

  it("prefers nested running when flat mirror is still stopped", () => {
    const base = legacyActiveTurnoFromForm({
      corOperador: "Ana",
      corTurno: "diurno",
      corGrupo: "A",
    })
    expect(base).not.toBeNull()
    const turno: NonNullable<typeof base> = {
      ...base,
      timer: {
        ...base.timer,
        state: "running",
        startedAtMs: 1_700_000_000_000,
        lastResumeAtMs: 1_700_000_000_000,
      },
    }
    const form = { corTimerState: "stopped", corTimerLastResumeAtMs: 0 }
    const timer = resolveCorteDisplayTimer(turno, form)
    expect(timer.state).toBe("running")
    expect(timer.lastResumeAtMs).toBe(1_700_000_000_000)
  })

  it("prefers nested paused when flat still running after pause", () => {
    const base = legacyActiveTurnoFromForm({
      corOperador: "Ana",
      corTurno: "diurno",
      corGrupo: "A",
    })
    expect(base).not.toBeNull()
    const turno: NonNullable<typeof base> = {
      ...base,
      timer: {
        ...base.timer,
        state: "paused",
        lastResumeAtMs: 0,
        pauseAtMs: 1_700_000_100_000,
        effectiveAccSec: 120,
      },
    }
    const form = {
      corTimerState: "running",
      corTimerLastResumeAtMs: 1_700_000_000_000,
    }
    const timer = resolveCorteDisplayTimer(turno, form)
    expect(timer.state).toBe("paused")
  })
})

describe("pauseCorteProductionTimerOnForm", () => {
  it("inline merge sets flat paused", () => {
    const open = createNewCorteTurno({
      turno: "diurno",
      grupo: "A",
      operador: "Ana",
      ayudante: "",
      supervisor: "",
    })
    const base = { [COR_ACTUAL_KEY]: open, ...corteTurnoToMirror(open) }
    const running = startCorteProductionTimerOnForm(base)!
    const cur = materializeOpenCorteTurnoActual(running)!
    const nextTurn = {
      ...cur,
      timer: { ...cur.timer, state: "paused" as const, pauseAtMs: 1, lastResumeAtMs: 0 },
    }
    const merged = {
      ...running,
      [COR_ACTUAL_KEY]: nextTurn,
      ...corteTurnoToMirror(nextTurn),
      corTimerState: "paused",
    }
    expect(merged.corTimerState).toBe("paused")
  })

  it("sets nested and flat timer to paused", () => {
    const open = createNewCorteTurno({
      turno: "diurno",
      grupo: "A",
      operador: "Ana",
      ayudante: "",
      supervisor: "",
    })
    const base = { [COR_ACTUAL_KEY]: open, ...corteTurnoToMirror(open) }
    const running = startCorteProductionTimerOnForm(base)
    expect(running).not.toBeNull()
    const paused = pauseCorteProductionTimerOnForm(running!, 1_700_000_060_000)
    expect(paused).not.toBeNull()
    expect(paused).not.toBe(running)
    expect(paused?.corTimerState).toBe("paused")
    const actual = paused?.corTurnoActual as { timer?: { state?: string } }
    expect(actual?.timer?.state).toBe("paused")
    expect(readNumber(paused?.corTimerLastResumeAtMs)).toBe(0)
  })

  it("accrues effective seconds from flat running timer when nested is pending", () => {
    const open = createNewCorteTurno({
      turno: "diurno",
      grupo: "A",
      operador: "Ana",
      ayudante: "",
      supervisor: "",
    })
    const startedAt = 1_700_000_000_000
    const base = {
      [COR_ACTUAL_KEY]: open,
      ...corteTurnoToMirror(open),
      corTimerState: "running",
      corTimerStartedAtMs: startedAt,
      corTimerLastResumeAtMs: startedAt,
    }
    const paused = pauseCorteProductionTimerOnForm(base, startedAt + 60_000)
    expect(paused).not.toBeNull()
    expect(paused?.corTimerState).toBe("paused")
    expect(readNumber(paused?.corTimerEffectiveAccSec)).toBeGreaterThanOrEqual(59)
  })
})

function readNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

describe("startCorteProductionTimerOnForm", () => {
  it("sets nested and flat timer to running", () => {
    const prev = {
      corOperador: "Ana",
      corTurno: "nocturno",
      corGrupo: "C",
      corTimerState: "pending",
    }
    const next = startCorteProductionTimerOnForm(prev)
    expect(next?.corTimerState).toBe("running")
    const actual = next?.corTurnoActual as { timer?: { state?: string } }
    expect(actual?.timer?.state).toBe("running")
  })
})

describe("legacyActiveTurnoFromForm", () => {
  it("rebuilds open turno from flat mirror fields", () => {
    const t = legacyActiveTurnoFromForm({
      corOperador: "Ana",
      corTurno: "diurno",
      corGrupo: "A",
    })
    expect(t?.operador).toBe("Ana")
    expect(t?.turno).toBe("diurno")
    expect(t?.grupo).toBe("A")
  })
})

describe("materializeOpenCorteTurnoActual", () => {
  it("does not reopen turno from flat mirror when corTurnoActual is null", () => {
    expect(
      materializeOpenCorteTurnoActual({
        [COR_ACTUAL_KEY]: null,
        corOperador: "Ana",
        corTurno: "diurno",
        corGrupo: "A",
      }),
    ).toBeNull()
  })

  it("bootstrap clears mirror after explicit turno close", () => {
    const boot = bootstrapCorteFormState({
      [COR_ACTUAL_KEY]: null,
      cor_turnos: [{ id: "t1", closed_at: "2026-01-01T12:00:00.000Z", turno: "diurno", grupo: "A", operador: "Ana" }],
      corOperador: "Ana",
      corTurno: "diurno",
      corGrupo: "A",
    })
    expect(boot[COR_ACTUAL_KEY]).toBeNull()
    expect(boot.corOperador).toBe("")
    expect(materializeOpenCorteTurnoActual(boot)).toBeNull()
  })
})

describe("corte entrada sync", () => {
  it("syncCorteEntradaFields sets kgIngresadosCorte from grid sum", () => {
    const form = {
      corEntradaBobinasKg: ["12", "32", "12", ...Array(27).fill("")],
    }
    const synced = syncCorteEntradaFields(form)
    expect(synced.kgIngresadosCorte).toBe("56.00")
    expect(sumEntradaKgFromForm(form)).toBe(56)
  })

  it("syncCorteFormMetrics updates entrada and salida", () => {
    const form = {
      corEntradaBobinasKg: ["10", "", ""],
      cor_paletas: [
        {
          id: "p-01",
          label: "Paleta #01",
          rollosKg: ["5", ...Array(47).fill("")],
          status: "en_progreso",
        },
      ],
    }
    const synced = syncCorteFormMetrics(form)
    expect(synced.kgIngresadosCorte).toBe("10.00")
    expect(synced.kgSalidaCorte).toBe("5.00")
    expect(synced.corAcumuladoProducidoKg).toBe(5)
  })
})

describe("sanitizeCorPaletasForPersistence", () => {
  it("converts null rollos to empty strings", () => {
    const paletas = sanitizeCorPaletasForPersistence([
      {
        id: "p-01",
        label: "P1",
        rollosKg: [null, "12", undefined] as unknown as string[],
        status: "en_progreso",
      },
    ])
    expect(paletas[0].rollosKg[0]).toBe("")
    expect(paletas[0].rollosKg[1]).toBe("12")
    expect(paletas[0].rollosKg[2]).toBe("")
    expect(paletas[0].rollosKg).toHaveLength(48)
  })
})

describe("corte paletas cerradas / despacho", () => {
  const rollos = (kg: string) => [kg, ...Array(47).fill("")]

  it("isCorPaletaCerrada reconoce cerrada y cerrada_opcional", () => {
    const base: CorPaleta = {
      id: "p-01",
      label: "Paleta #01",
      rollosKg: rollos("1"),
      status: "en_progreso",
    }
    expect(isCorPaletaCerrada(base)).toBe(false)
    expect(isCorPaletaCerrada({ ...base, status: "cerrada" })).toBe(true)
    expect(isCorPaletaCerrada({ ...base, status: "cerrada_opcional" })).toBe(true)
  })

  it("shouldPreferTopCorPaletas prioriza cor_paletas cerrada aunque el turno tenga los mismos kg abiertos", () => {
    const rollos = (kg: string) => [kg, ...Array(47).fill("")]
    const top: CorPaleta[] = [
      { id: "p-01", label: "Paleta #01", rollosKg: rollos("132"), status: "cerrada" },
    ]
    const nested: CorPaleta[] = [
      { id: "p-01", label: "Paleta #01", rollosKg: rollos("132"), status: "en_progreso" },
    ]
    expect(shouldPreferTopCorPaletas(top, nested)).toBe(true)
    const picked = pickAuthoritativeCorPaletas(top, nested)
    expect(picked[0]?.status).toBe("cerrada")
  })

  it("sumSalidaKgFromClosedPaletas solo suma paletas cerradas", () => {
    const paletas: CorPaleta[] = [
      { id: "p-01", label: "P1", rollosKg: rollos("10"), status: "cerrada" },
      { id: "p-02", label: "P2", rollosKg: rollos("5"), status: "en_progreso" },
      { id: "p-03", label: "P3", rollosKg: rollos("7.5"), status: "cerrada" },
    ]
    expect(sumSalidaKgFromClosedPaletas(paletas)).toBe(17.5)
  })

  it("bootstrapCorteFormState prefiere cor_paletas con kg si el turno tiene paletas vacías", () => {
    const rollosWithKg = ["15", ...Array(47).fill("")]
    const turno = createNewCorteTurno({
      turno: "nocturno",
      grupo: "B",
      operador: "Test",
      ayudante: "",
      supervisor: "",
    })
    turno.paletas = [
      {
        id: "p-01",
        label: "Paleta #01",
        rollosKg: Array.from({ length: 48 }, () => ""),
        status: "en_progreso",
      },
    ]
    const merged = {
      cor_paletas: [
        {
          id: "p-01",
          label: "Paleta #01",
          rollosKg: rollosWithKg,
          status: "en_progreso",
        },
      ],
      [COR_ACTUAL_KEY]: turno,
    }
    const boot = bootstrapCorteFormState(merged)
    expect(sumSalidaKgFromPaletas(getCorPaletas(boot))).toBe(15)
    const actual = boot[COR_ACTUAL_KEY] as { paletas: CorPaleta[] }
    expect(sumSalidaKgFromPaletas(actual.paletas)).toBe(15)
  })
})
