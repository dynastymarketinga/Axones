import { Activity, AlarmClock, Clock, Gauge, PackageOpen, TimerOff, Wrench } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  elapsedLabel: string
  /** Texto bajo el contador principal (p. ej. tiempo efectivo vs. total). */
  elapsedCaption?: string
  deadHms: string
  effectiveHms: string
  /** Etiqueta de la segunda fila de métricas (valor = `effectiveHms`). Por defecto «Tiempo efectivo». */
  productiveMetricLabel?: string
  /** Si true, el total acumulado usa estilo «live» (solo corre con tiempo efectivo). */
  totalMetricLive?: boolean
  kgHora: string
  /** Hora de arranque del cronómetro (turno en curso). Si se omite, no se muestra el cuadro. */
  horaArranque?: string
  /** Tiempo de arranque acumulado (HMS). Si se omite, no se muestra el cuadro. */
  arranqueHms?: string
  /** Si true, el valor de arranque usa estilo «live» (fase en curso). */
  arranqueMetricLive?: boolean
  /** Tiempo de desmontaje acumulado (HMS). Si se omite, no se muestra el cuadro. */
  demountHms?: string
  /** Si true, el valor de desmontaje usa estilo «live» (fase en curso). */
  demountMetricLive?: boolean
}

export function MesTimerFace({
  elapsedLabel,
  elapsedCaption = "Tiempo transcurrido",
  deadHms,
  effectiveHms,
  productiveMetricLabel = "Tiempo efectivo",
  totalMetricLive = false,
  kgHora,
  horaArranque,
  arranqueHms,
  arranqueMetricLive = false,
  demountHms,
  demountMetricLive = false,
}: Props) {
  const metricsClass = cn(
    "mes-timer-metrics",
    (arranqueHms != null || demountHms != null) && "mes-timer-metrics--with-phases",
  )

  return (
    <div className="mes-timer-face">
      <div className="mes-timer-face__digits">{elapsedLabel}</div>
      <p className="mes-timer-face__caption mes-timer-face__caption--inline">
        <Clock className="h-3.5 w-3.5 shrink-0 opacity-85" aria-hidden />
        {elapsedCaption}
      </p>
      <div className={metricsClass}>
        <div className="mes-timer-metric">
          <div className="mes-timer-metric__label">
            <TimerOff className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Tiempo muerto
          </div>
          <div className="mes-timer-metric__value mes-timer-metric__value--dead">{deadHms}</div>
        </div>
        {horaArranque != null ? (
          <div className="mes-timer-metric">
            <div className="mes-timer-metric__label">
              <AlarmClock className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Hora de arranque
            </div>
            <div className="mes-timer-metric__value mes-timer-metric__value--arranque">{horaArranque}</div>
          </div>
        ) : null}
        {arranqueHms != null ? (
          <div className="mes-timer-metric">
            <div className="mes-timer-metric__label">
              <Wrench className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Tiempo de arranque
            </div>
            <div
              className={`mes-timer-metric__value ${
                arranqueMetricLive
                  ? "mes-timer-metric__value--arranque-live"
                  : "mes-timer-metric__value--arranque-duration"
              }`}
            >
              {arranqueHms}
            </div>
          </div>
        ) : null}
        {demountHms != null ? (
          <div className="mes-timer-metric">
            <div className="mes-timer-metric__label">
              <PackageOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Tiempo de desmontaje
            </div>
            <div
              className={`mes-timer-metric__value ${
                demountMetricLive ? "mes-timer-metric__value--demount-live" : "mes-timer-metric__value--demount"
              }`}
            >
              {demountHms}
            </div>
          </div>
        ) : null}
        <div className="mes-timer-metric">
          <div className="mes-timer-metric__label">
            <Activity className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {productiveMetricLabel}
          </div>
          <div
            className={`mes-timer-metric__value ${
              totalMetricLive ? "mes-timer-metric__value--live" : "mes-timer-metric__value--neutral"
            }`}
          >
            {effectiveHms}
          </div>
        </div>
        <div className="mes-timer-metric">
          <div className="mes-timer-metric__label">
            <Gauge className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Kg/Hora estimado
          </div>
          <div className="mes-timer-metric__value mes-timer-metric__value--neutral">{kgHora}</div>
        </div>
      </div>
    </div>
  )
}
