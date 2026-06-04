import { MesTimerFace } from "@/components/axones/mes"

import type { MesTimerActionFlags, MesTimerAreaKey, MesTimerConfirmKey } from "./mes-timer-actions"
import { WorkOrderMesTimerActionStack } from "./WorkOrderMesTimerActionStack"

export type MesProductionTimerOpsBlockProps = {
  formatTimerHms: (s: number) => string
  effectiveSec: number
  deadSec: number
  demountSec: number
  /** Segundos de arranque acumulados (OT o turno). Si se omite, no se muestra el cuadro. */
  arranqueSec?: number
  totalSec: number
  kgHora: string
  horaArranque: string
  timerShowsOtAccumulated?: boolean
  timerRunning: boolean
  arranqueRunning?: boolean
  demountRunning?: boolean
  timerActionFlags: MesTimerActionFlags
  onRequestTimerConfirm: (key: MesTimerConfirmKey) => void
  onPreviewTimerReport: () => void
  canFinalizeOrder: boolean
  areaFinalizada: boolean
  areaLabel: MesTimerAreaKey
  /** Si false, solo se muestra la cara del cronómetro (sin botonera). */
  showTimerActions?: boolean
}

/** Cara del cronómetro + botonera multi-fase (Montaje, Impresión, Laminación, Corte). */
export function MesProductionTimerOpsBlock({
  formatTimerHms,
  effectiveSec,
  deadSec,
  demountSec,
  arranqueSec,
  totalSec,
  kgHora,
  horaArranque,
  timerShowsOtAccumulated,
  timerRunning,
  arranqueRunning,
  demountRunning,
  timerActionFlags,
  onRequestTimerConfirm,
  onPreviewTimerReport,
  canFinalizeOrder,
  areaFinalizada,
  areaLabel,
  showTimerActions = true,
}: MesProductionTimerOpsBlockProps) {
  return (
    <div className={showTimerActions ? "mes-timer-grid" : "mes-timer-grid mes-timer-grid--face-only"}>
      <MesTimerFace
        elapsedLabel={formatTimerHms(effectiveSec)}
        elapsedCaption={
          timerShowsOtAccumulated
            ? "Tiempo efectivo acumulado (todos los turnos de la OT)"
            : "Tiempo efectivo (se detiene al registrar parada)"
        }
        deadHms={formatTimerHms(deadSec)}
        effectiveHms={formatTimerHms(totalSec)}
        productiveMetricLabel={
          timerShowsOtAccumulated
            ? "Total acumulado (efectivo + paradas)"
            : "Total (efectivo + paradas)"
        }
        totalMetricLive={timerRunning}
        kgHora={kgHora}
        horaArranque={horaArranque}
        arranqueHms={arranqueSec != null ? formatTimerHms(arranqueSec) : undefined}
        arranqueMetricLive={arranqueRunning}
        demountHms={formatTimerHms(demountSec)}
        demountMetricLive={demountRunning}
      />
      {showTimerActions ? (
        <div className="mes-timer-actions w-full min-w-0">
          <WorkOrderMesTimerActionStack
            flags={timerActionFlags}
            onRequestConfirm={onRequestTimerConfirm}
            onPreview={onPreviewTimerReport}
            canFinalizeOrder={canFinalizeOrder}
            areaFinalizada={areaFinalizada}
            areaLabel={areaLabel}
          />
        </div>
      ) : null}
    </div>
  )
}

export const MES_TIMER_HELP_TEXT =
  "Cronómetro (máquina): cuenta tiempo efectivo y paradas. Parada detiene el efectivo y pide motivo (tiempo muerto); no cierra el turno de planta. Arranque (preparación), luego producción (tiempo efectivo), desmontaje y tiempo muerto con motivo. Solo una fase a la vez. Cada acción pide confirmación. Cierre con Guardar, Fin del turno o Finalizar orden."
