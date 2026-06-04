"use client"

import { useMemo, type ComponentType } from "react"
import { CalendarClock, Factory, PauseCircle, PlayCircle, Timer, Wrench } from "lucide-react"

import { MesBandejaOtTimesSummary } from "@/components/axones/printing-bandeja-modals"
import { Badge } from "@/components/ui/badge"
import {
  formatHmsFromSeconds,
  technicalFormFromRow,
  type MesBandejaMes,
} from "@/lib/mes-timer-band-shared"
import {
  montajeOtPhaseTotals,
  montajePhaseStatusLabel,
  montajeTurnosBandejaItems,
  resolveMontajeTurnLiveTimes,
  type MontajeTurnoBandejaItem,
} from "@/lib/montaje-mes-band-status"
import { cn } from "@/lib/utils"
import type { WorkOrderListRow } from "@/types/api"
import type { MontajeTurnoEntry } from "@/pages/axones/montaje-turnos"

function formatTurnoInstant(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—"
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function turnoLabel(turno: MontajeTurnoEntry): string {
  const parts: string[] = []
  if (turno.turno === "diurno") parts.push("Diurno")
  else if (turno.turno === "nocturno") parts.push("Nocturno")
  if (turno.grupo === "A" || turno.grupo === "B" || turno.grupo === "C") {
    parts.push(`Grupo ${turno.grupo}`)
  }
  return parts.join(" · ") || "Turno"
}

function TimeMetricCard({
  label,
  value,
  sub,
  live,
  icon: Icon,
  className,
}: {
  label: string
  value: string
  sub?: string
  live?: boolean
  icon: ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/20 px-3 py-2",
        live && "ring-1 ring-primary/30",
        className,
      )}
    >
      <p className="text-muted-foreground mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
        <Icon className="h-3 w-3 opacity-70" aria-hidden />
        {label}
        {live ? (
          <Badge variant="secondary" className="h-4 px-1 text-[9px]">
            En curso
          </Badge>
        ) : null}
      </p>
      <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-muted-foreground mt-0.5 text-[10px]">{sub}</p> : null}
    </div>
  )
}

function MontajeTurnTimesCard({
  turno,
  enCurso,
  nowMs,
}: {
  turno: MontajeTurnoEntry
  enCurso: boolean
  nowMs: number
}) {
  const live = resolveMontajeTurnLiveTimes(turno, nowMs)
  const phase = montajePhaseStatusLabel(turno.timer)
  const pauses = Array.isArray(turno.timer.pauses) ? turno.timer.pauses : []

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-tight">{turnoLabel(turno)}</p>
          <p className="text-muted-foreground text-xs leading-snug">
            {turno.operador?.trim() ? turno.operador : "Sin operador"}
            {enCurso ? (
              <Badge variant="outline" className="ml-2 h-5 text-[10px]">
                En curso
              </Badge>
            ) : null}
            {phase ? (
              <span className="text-foreground ml-1 font-medium">· {phase}</span>
            ) : null}
          </p>
        </div>
        <div className="text-muted-foreground shrink-0 text-right text-[11px] leading-snug">
          <p>
            <CalendarClock className="mr-1 inline h-3 w-3 opacity-70" aria-hidden />
            {formatTurnoInstant(turno.started_at)}
          </p>
          {turno.closed_at ? (
            <p className="mt-0.5">Cierre {formatTurnoInstant(turno.closed_at)}</p>
          ) : (
            <p className="mt-0.5 italic">Sin cierre</p>
          )}
        </div>
      </header>
      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <TimeMetricCard
          label="Arranque"
          value={formatHmsFromSeconds(live.arranqueSec)}
          live={live.arranqueLive}
          icon={Wrench}
        />
        <TimeMetricCard
          label="Op. montaje"
          value={formatHmsFromSeconds(live.montajeOpSec)}
          live={live.montajeOpLive}
          icon={Wrench}
        />
        <TimeMetricCard
          label="Efectivo"
          value={formatHmsFromSeconds(live.efectivoSec)}
          live={live.efectivoLive}
          icon={PlayCircle}
        />
        <TimeMetricCard
          label="Paradas"
          value={formatHmsFromSeconds(live.deadSec)}
          sub={`${live.numParadas} registro(s)`}
          live={live.state === "paused"}
          icon={PauseCircle}
        />
        <TimeMetricCard
          label="Desmontaje"
          value={formatHmsFromSeconds(live.demountSec)}
          live={live.demountLive}
          icon={Wrench}
        />
        <TimeMetricCard
          label="Kg producción"
          value={live.produccionKg > 0.005 ? live.produccionKg.toFixed(2) : "—"}
          sub={live.mermaKg > 0.005 ? `Merma ${live.mermaKg.toFixed(2)} kg` : undefined}
          icon={Factory}
        />
      </div>
      {pauses.length > 0 ? (
        <div className="border-t border-border/60 bg-muted/10 px-3 py-2.5">
          <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
            Detalle de paradas
          </p>
          <ul className="max-h-28 space-y-1 overflow-y-auto text-xs">
            {pauses.map((p, i) => (
              <li key={`${turno.id}-p-${i}`} className="flex flex-wrap gap-x-2 gap-y-0.5 leading-snug">
                <span className="font-medium text-foreground">{p.reason?.trim() || "Sin motivo"}</span>
                {p.duration_sec > 0 ? (
                  <span className="font-mono text-muted-foreground">
                    {formatHmsFromSeconds(p.duration_sec)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

function sortMontajeTurnoItems(items: MontajeTurnoBandejaItem[]): MontajeTurnoBandejaItem[] {
  return [...items].sort((a, b) => {
    const da = Date.parse(a.turno.started_at) || 0
    const db = Date.parse(b.turno.started_at) || 0
    return db - da
  })
}

export function MontajeMesBandejaTimesPanel({
  row,
  mesBand,
  nowMs,
}: {
  row: WorkOrderListRow
  mesBand: MesBandejaMes | null
  nowMs: number
}) {
  const form = technicalFormFromRow(row)
  const items = useMemo(() => montajeTurnosBandejaItems(form), [form])
  const sorted = useMemo(() => sortMontajeTurnoItems(items), [items])
  const phaseOt = useMemo(() => montajeOtPhaseTotals(items, nowMs), [items, nowMs])

  if (!mesBand && items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        Sin datos de cronómetro en esta OT. Inicie turno y use el temporizador en Producción → Montaje.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {mesBand ? <MesBandejaOtTimesSummary mesBand={mesBand} /> : null}
      {(mesBand?.producidoKg != null && mesBand.producidoKg > 0.005) ||
      (mesBand?.desperdicioKg != null && mesBand.desperdicioKg > 0.005) ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <TimeMetricCard
            label="Producción acum. OT"
            value={
              mesBand?.producidoKg != null && mesBand.producidoKg > 0.005
                ? `${mesBand.producidoKg.toFixed(2)} kg`
                : "—"
            }
            icon={Factory}
          />
          <TimeMetricCard
            label="Merma acum. OT"
            value={
              mesBand?.desperdicioKg != null && mesBand.desperdicioKg > 0.005
                ? `${mesBand.desperdicioKg.toFixed(2)} kg`
                : "—"
            }
            icon={Factory}
          />
        </div>
      ) : null}
      {(phaseOt.arranqueSec > 0.5 || phaseOt.montajeOpSec > 0.5 || phaseOt.demountSec > 0.5) && (
        <div className="grid gap-2 sm:grid-cols-3">
          <TimeMetricCard
            label="Arranque acum. OT"
            value={formatHmsFromSeconds(phaseOt.arranqueSec)}
            sub="Todos los turnos"
            icon={Wrench}
          />
          <TimeMetricCard
            label="Op. montaje acum."
            value={formatHmsFromSeconds(phaseOt.montajeOpSec)}
            sub="Todos los turnos"
            icon={Wrench}
          />
          <TimeMetricCard
            label="Desmontaje acum. OT"
            value={formatHmsFromSeconds(phaseOt.demountSec)}
            sub="Todos los turnos"
            icon={Wrench}
          />
        </div>
      )}
      {sorted.length > 0 ? (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
            Por turno · {sorted.length} registro(s)
          </p>
          <ul className="max-h-[min(52vh,22rem)] space-y-3 overflow-y-auto pr-1">
            {sorted.map(({ turno, enCurso }) => (
              <li key={turno.id}>
                <MontajeTurnTimesCard turno={turno} enCurso={enCurso} nowMs={nowMs} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
