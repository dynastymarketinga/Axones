// @vitest-environment node
import { describe, expect, it } from "vitest"

import { montajeMesBandFromWorkOrderRow } from "@/lib/montaje-mes-band-status"
import { laminacionMesBandFromWorkOrderRow } from "@/lib/laminacion-mes-band-status"
import { cumulativeDeadSeconds, cumulativeTotalPersistedSeconds, mesBandFromAreaTimeSummary } from "@/lib/mes-timer-band-shared"
import {
  MON_ACTUAL_KEY,
  MON_TURNOS_KEY,
  type MontajeTurnoEntry,
} from "@/pages/axones/montaje-turnos"

function closedTurno(effectiveAccSec: number): MontajeTurnoEntry {
  return {
    id: "t1",
    started_at: "2026-01-01T08:00:00Z",
    closed_at: "2026-01-01T12:00:00Z",
    closed_by: null,
    turno: "diurno",
    grupo: "A",
    operador: "Victor",
    ayudante: "",
    supervisor: "",
    kgProduccion: "0",
    mermaKg: "0",
    metrajeMontaje: "0",
    observaciones: "",
    timer: {
      state: "completed",
      startedAtMs: 0,
      lastResumeAtMs: 0,
      pauseAtMs: 0,
      effectiveAccSec,
      deadAccSec: 0,
      pauses: [],
    },
  }
}

function activeRunningTurno(): MontajeTurnoEntry {
  const now = Date.now()
  return {
    id: "t2",
    started_at: new Date(now).toISOString(),
    closed_at: null,
    closed_by: null,
    turno: "diurno",
    grupo: "B",
    operador: "Ana",
    ayudante: "",
    supervisor: "",
    kgProduccion: "0",
    mermaKg: "0",
    metrajeMontaje: "0",
    observaciones: "",
    timer: {
      state: "running",
      startedAtMs: now - 60_000,
      lastResumeAtMs: now - 30_000,
      pauseAtMs: 0,
      effectiveAccSec: 100,
      deadAccSec: 0,
      pauses: [],
    },
  }
}

describe("montajeMesBandFromWorkOrderRow", () => {
  it("sums closed turns and running tramo", () => {
    const nowMs = Date.now()
    const row = {
      board_stage: "montaje",
      technical_document: {
        form: {
          [MON_TURNOS_KEY]: [closedTurno(3600)],
          [MON_ACTUAL_KEY]: activeRunningTurno(),
          montEstadoArea: "abierta",
        },
      },
    }
    const band = montajeMesBandFromWorkOrderRow(row, nowMs)
    expect(band).not.toBeNull()
    expect(band!.workflow).toBe("iniciado")
    expect(band!.effectiveHms).toMatch(/^01:0\d:/)
  })

  it("shows turno abierto when plant shift is open without timer play", () => {
    const row = {
      board_stage: "montaje",
      technical_document: {
        form: {
          [MON_TURNOS_KEY]: [],
          [MON_ACTUAL_KEY]: {
            ...activeRunningTurno(),
            timer: {
              ...activeRunningTurno().timer,
              state: "pending",
              effectiveAccSec: 0,
              lastResumeAtMs: 0,
              pauseAtMs: 0,
            },
          },
          montEstadoArea: "abierta",
        },
      },
    }
    const band = montajeMesBandFromWorkOrderRow(row, Date.now())
    expect(band!.workflow).toBe("turno_abierto")
  })

  it("shows entre turnos when closed shifts exist without active turn", () => {
    const row = {
      board_stage: "montaje",
      technical_document: {
        form: {
          [MON_TURNOS_KEY]: [closedTurno(120)],
          [MON_ACTUAL_KEY]: null,
          montEstadoArea: "abierta",
        },
      },
    }
    const band = montajeMesBandFromWorkOrderRow(row, Date.now())
    expect(band!.workflow).toBe("entre_turnos")
    expect(band!.effectiveHms).toBe("00:02:00")
  })

  it("shows pausado when timer is paused with motive", () => {
    const nowMs = Date.now()
    const row = {
      board_stage: "montaje",
      technical_document: {
        form: {
          [MON_TURNOS_KEY]: [],
          [MON_ACTUAL_KEY]: {
            ...activeRunningTurno(),
            timer: {
              ...activeRunningTurno().timer,
              state: "paused",
              lastResumeAtMs: 0,
              pauseAtMs: nowMs - 5000,
              pauses: [{ at: new Date().toISOString(), reason: "Mantenimiento", obs: "", duration_sec: 5 }],
            },
          },
          montEstadoArea: "abierta",
        },
      },
    }
    const band = montajeMesBandFromWorkOrderRow(row, nowMs)
    expect(band!.workflow).toBe("pausado")
  })

  it("shows finalizado and frozen time when montEstadoArea is finalizada", () => {
    const nowMs = Date.now()
    const row = {
      board_stage: "montaje",
      technical_document: {
        form: {
          [MON_TURNOS_KEY]: [closedTurno(90)],
          [MON_ACTUAL_KEY]: null,
          montEstadoArea: "finalizada",
        },
      },
    }
    const band = montajeMesBandFromWorkOrderRow(row, nowMs)
    expect(band).not.toBeNull()
    expect(band!.workflow).toBe("finalizado")
    expect(band!.effectiveHms).toBe("00:01:30")
    const bandLater = montajeMesBandFromWorkOrderRow(row, nowMs + 60_000)
    expect(bandLater!.effectiveHms).toBe(band!.effectiveHms)
  })

  it("reads running state from legacy mirror when nested turn is missing", () => {
    const nowMs = Date.now()
    const row = {
      board_stage: "pendiente",
      technical_document: {
        form: {
          montOperador: "AAA",
          montTurno: "diurno",
          montGrupo: "A",
          montTimerState: "running",
          montTimerEffectiveAccSec: 1200,
          montTimerLastResumeAtMs: nowMs - 15_000,
          montTimerStartedAtMs: nowMs - 120_000,
        },
      },
    }
    const band = montajeMesBandFromWorkOrderRow(row, nowMs)
    expect(band).not.toBeNull()
    expect(band!.workflow).toBe("iniciado")
    expect(band!.showTimes).toBe(true)
  })
})

describe("laminacionMesBandFromWorkOrderRow", () => {
  it("returns null off-stage", () => {
    const band = laminacionMesBandFromWorkOrderRow(
      { board_stage: "impresion", technical_document: { form: {} } },
      Date.now(),
    )
    expect(band).toBeNull()
  })
})

describe("mesBandFromAreaTimeSummary", () => {
  it("adds open production segment elapsed time", () => {
    const started = new Date(Date.now() - 90_000).toISOString()
    const band = mesBandFromAreaTimeSummary(
      {
        effective_seconds: 60,
        dead_seconds: 0,
        open_segment_type: "production",
        open_started_at: started,
      },
      Date.now(),
      "Corte",
    )
    expect(band).not.toBeNull()
    expect(band!.workflow).toBe("iniciado")
    const parts = band!.effectiveHms.split(":")
    const totalSec =
      parseInt(parts[0] ?? "0", 10) * 3600 +
      parseInt(parts[1] ?? "0", 10) * 60 +
      parseInt(parts[2] ?? "0", 10)
    expect(totalSec).toBeGreaterThan(140)
  })
})

describe("cumulativeDeadSeconds", () => {
  it("sigue sumando tiempo muerto en pausa aunque ya haya motivo registrado", () => {
    const nowMs = 1_000_000
    const pauseAtMs = nowMs - 12_000
    const dead = cumulativeDeadSeconds(
      [],
      {
        turno: "nocturno",
        grupo: "B",
        timer: {
          state: "paused",
          effectiveAccSec: 41,
          deadAccSec: 4,
          lastResumeAtMs: 0,
          pauseAtMs,
          pauses: [
            {
              at: new Date(pauseAtMs).toISOString(),
              reason: "Cambio de bobina",
              obs: "aa",
              duration_sec: 4,
            },
          ],
        },
      },
      nowMs,
    )
    expect(dead).toBeGreaterThan(15.9)
    expect(dead).toBeLessThan(16.1)
  })
})

describe("cumulativeTotalPersistedSeconds", () => {
  it("no suma el tramo abierto de parada al total acumulado", () => {
    const nowMs = 1_000_000
    const pauseAtMs = nowMs - 12_000
    const actual = {
      turno: "nocturno",
      grupo: "B",
      timer: {
        state: "paused",
        effectiveAccSec: 41,
        deadAccSec: 4,
        lastResumeAtMs: 0,
        pauseAtMs,
        pauses: [],
      },
    }
    const dead = cumulativeDeadSeconds([], actual, nowMs)
    const total = cumulativeTotalPersistedSeconds([], actual, nowMs)
    expect(dead).toBeGreaterThan(15.9)
    expect(dead).toBeLessThan(16.1)
    expect(total).toBe(45)
    expect(total).toBeLessThan(41 + dead)
  })
})
