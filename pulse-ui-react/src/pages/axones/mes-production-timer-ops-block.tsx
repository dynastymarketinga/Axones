import { MesTimerFace } from "@/components/axones/mes"

import type { MesTimerActionFlags, MesTimerAreaKey, MesTimerConfirmKey } from "./mes-timer-actions"
import { WorkOrderMesTimerActionStack } from "./WorkOrderMesTimerActionStack"

export type MesProductionTimerOpsBlockProps = {
  formatTimerHms: (s: number) => string
  effectiveSec: number
  deadSec: number
  demountSec: number
  totalSec: number
  kgHora: string
  horaArranque: string
  timerShowsOtAccumulated?: boolean
  timerRunning: boolean
  demountRunning?: boolean
  timerActionFlags: MesTimerActionFlags
  onRequestTimerConfirm: (key: MesTimerConfirmKey) => void
  onPreviewTimerReport: () => void
  canFinalizeOrder: boolean
  areaFinalizada: boolean
  areaLabel: MesTimerAreaKey
}

/** Cara del cronómetro + botonera multi-fase (Montaje, Impresión, Laminación, Corte). */
export function MesProductionTimerOpsBlock({
  formatTimerHms,
  effectiveSec,
  deadSec,
  demountSec,
  totalSec,
  kgHora,
  horaArranque,
  timerShowsOtAccumulated,
  timerRunning,
  demountRunning,
  timerActionFlags,
  onRequestTimerConfirm,
  onPreviewTimerReport,
  canFinalizeOrder,
  areaFinalizada,
  areaLabel,
}: MesProductionTimerOpsBlockProps) {
  return (
    <div className="mes-timer-grid">
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
        demountHms={formatTimerHms(demountSec)}
        demountMetricLive={demountRunning}
      />
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
    </div>
  )
}

export const MES_TIMER_HELP_TEXT =
  "Cronómetro (máquina): cuenta tiempo efectivo y paradas. Parada detiene el efectivo y pide motivo (tiempo muerto); no cierra el turno de planta. Arranque (preparación), luego producción (tiempo efectivo), desmontaje y tiempo muerto con motivo. Solo una fase a la vez. Cada acción pide confirmación. Cierre con Guardar, Fin del turno o Finalizar orden."
