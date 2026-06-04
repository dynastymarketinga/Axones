import { describe, expect, it } from "vitest"

import {
  mesBandejaDevolucionesRegistroCount,
  mesBandejaDevolucionesTotalsFromSnapshots,
  printingDevolucionesFromForm,
} from "@/lib/printing-mes-band-devoluciones"

describe("printingDevolucionesFromForm", () => {
  it("acumula devolución buena y mala por turnos y capturas", () => {
    const form = {
      impOperador: "Op A",
      impTurnosImpresion: [
        {
          id: "t-1",
          turno: "diurno",
          grupo: "A",
          operador: "Op cerrado",
          started_at: "2026-06-01T08:00:00.000Z",
          closed_at: "2026-06-01T16:00:00.000Z",
          capturas: [
            {
              id: "c-1",
              saved_at: "2026-06-01T10:00:00.000Z",
              devolucionBuenaKg: "5",
              devolucionRechazadaKg: "",
              devolucionRechazadaBobinas: "2",
              devolucionRechazadaMotivo: "manchas",
            },
          ],
          devolucionBuenaKg: "",
          devolucionRechazadaKg: "",
          devolucionRechazadaBobinas: "",
          devolucionRechazadaMotivo: "",
        },
      ],
      impTurnoActual: {
        id: "t-2",
        turno: "nocturno",
        grupo: "B",
        operador: "Op actual",
        started_at: "2026-06-01T20:00:00.000Z",
        closed_at: null,
        devolucionBuenaKg: "",
        devolucionRechazadaKg: "",
        devolucionRechazadaBobinas: "",
        devolucionRechazadaMotivo: "",
      },
      impDevolucionBuenaKg: "3",
      impDevolucionRechazadaKg: "4",
      impDevolucionRechazadaMotivo: "impresion_defectuosa",
    }

    const snap = printingDevolucionesFromForm(form)
    expect(snap.buenaTotalKg).toBe(8)
    expect(snap.malaTotalKg).toBe(4)
    expect(snap.buenaLines).toHaveLength(2)
    expect(snap.malaLines).toHaveLength(2)
    expect(snap.malaLines[0]?.bobinasCount).toBe(2)
    expect(snap.malaLines[0]?.motivo).toBe("Manchas")
    expect(snap.malaLines[1]?.motivo).toBe("Impresión defectuosa")
    expect(snap.hasAny).toBe(true)
  })

  it("sin datos devuelve snapshot vacío", () => {
    const snap = printingDevolucionesFromForm({
      impEstadoArea: "abierta",
      impTurnosImpresion: [],
      impTurnoActual: null,
    })
    expect(snap.hasAny).toBe(false)
    expect(snap.buenaTotalKg).toBe(0)
    expect(snap.malaTotalKg).toBe(0)
  })
})

describe("mesBandejaDevolucionesTotalsFromSnapshots", () => {
  it("suma buena/mala y cuenta OT con devoluciones", () => {
    const a = printingDevolucionesFromForm({
      impDevolucionBuenaKg: "5",
      impDevolucionRechazadaKg: "2",
      impTurnosImpresion: [],
      impTurnoActual: {
        id: "t-1",
        turno: "diurno",
        grupo: "A",
        operador: "Op",
        started_at: "2026-06-01T08:00:00.000Z",
        closed_at: null,
        devolucionBuenaKg: "",
        devolucionRechazadaKg: "",
        devolucionRechazadaBobinas: "",
        devolucionRechazadaMotivo: "",
      },
    })
    const b = printingDevolucionesFromForm({
      impDevolucionBuenaKg: "",
      impDevolucionRechazadaKg: "",
      impTurnosImpresion: [],
      impTurnoActual: null,
    })
    const totals = mesBandejaDevolucionesTotalsFromSnapshots([a, b])
    expect(totals.buenaTotalKg).toBe(5)
    expect(totals.malaTotalKg).toBe(2)
    expect(totals.totalKg).toBe(7)
    expect(totals.rowsWithDevoluciones).toBe(1)
    expect(mesBandejaDevolucionesRegistroCount(a)).toBe(2)
  })
})
