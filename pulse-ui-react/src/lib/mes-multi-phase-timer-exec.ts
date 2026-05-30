import type { MesPhaseTimerFields } from "@/lib/mes-phase-timer-fields"
import type { MesTimerConfirmKey } from "@/pages/axones/mes-timer-actions"

type ProductionTimerSlice = {
  state: string
  lastResumeAtMs: number
  effectiveAccSec: number
  pauseAtMs: number
}

export type MesPhaseProductionTimer = MesPhaseTimerFields & ProductionTimerSlice

/** Fases arranque / desmontaje / fin producción. Devuelve null si la clave la maneja el panel (producción, parada, cierre). */
export function applyMesPhaseConfirmToTimer<T extends MesPhaseProductionTimer>(
  key: MesTimerConfirmKey,
  timer: T,
  now = Date.now(),
): { timer: T; message: string } | null {
  switch (key) {
    case "startArranque":
      return {
        timer: {
          ...timer,
          arranqueState: "running",
          arranqueStartedAtMs: timer.arranqueStartedAtMs || now,
          arranqueLastResumeAtMs: now,
        },
        message: "Arranque iniciado.",
      }
    case "stopArranque": {
      const last = timer.arranqueLastResumeAtMs
      return {
        timer: {
          ...timer,
          arranqueState: "stopped",
          arranqueAccSec: timer.arranqueAccSec + (last > 0 ? (now - last) / 1000 : 0),
          arranqueLastResumeAtMs: 0,
        },
        message: "Arranque detenido.",
      }
    }
    case "startDemount":
      return {
        timer: {
          ...timer,
          demountState: "running",
          demountStartedAtMs: timer.demountStartedAtMs || now,
          demountLastResumeAtMs: now,
        },
        message: "Desmontaje iniciado.",
      }
    case "stopDemount": {
      const last = timer.demountLastResumeAtMs
      return {
        timer: {
          ...timer,
          demountState: "stopped",
          demountAccSec: timer.demountAccSec + (last > 0 ? (now - last) / 1000 : 0),
          demountLastResumeAtMs: 0,
        },
        message: "Desmontaje finalizado.",
      }
    }
    case "stopProduction": {
      if (timer.state !== "running") return { timer, message: "Producción detenida." }
      const last = timer.lastResumeAtMs
      return {
        timer: {
          ...timer,
          state: "pending",
          effectiveAccSec: timer.effectiveAccSec + (last > 0 ? (now - last) / 1000 : 0),
          lastResumeAtMs: 0,
          pauseAtMs: 0,
        },
        message: "Producción detenida.",
      }
    }
    default:
      return null
  }
}
