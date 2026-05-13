import { Activity, Clock, Gauge, TimerOff } from "lucide-react"

type Props = {
  elapsedLabel: string
  /** Texto bajo el contador principal (p. ej. tiempo efectivo vs. total). */
  elapsedCaption?: string
  deadHms: string
  effectiveHms: string
  /** Etiqueta de la segunda fila de métricas (valor = `effectiveHms`). Por defecto «Tiempo efectivo». */
  productiveMetricLabel?: string
  kgHora: string
}

export function MesTimerFace({
  elapsedLabel,
  elapsedCaption = "Tiempo transcurrido",
  deadHms,
  effectiveHms,
  productiveMetricLabel = "Tiempo efectivo",
  kgHora,
}: Props) {
  return (
    <div className="mes-timer-face">
      <div className="mes-timer-face__digits">{elapsedLabel}</div>
      <p className="mes-timer-face__caption mes-timer-face__caption--inline">
        <Clock className="h-3.5 w-3.5 shrink-0 opacity-85" aria-hidden />
        {elapsedCaption}
      </p>
      <div className="mes-timer-metrics">
        <div className="mes-timer-metric">
          <div className="mes-timer-metric__label">
            <TimerOff className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Tiempo muerto
          </div>
          <div className="mes-timer-metric__value mes-timer-metric__value--dead">{deadHms}</div>
        </div>
        <div className="mes-timer-metric">
          <div className="mes-timer-metric__label">
            <Activity className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {productiveMetricLabel}
          </div>
          <div className="mes-timer-metric__value mes-timer-metric__value--live">{effectiveHms}</div>
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
