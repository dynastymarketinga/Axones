"use client"

import { useMemo, type ComponentType } from "react"
import {
  CalendarClock,
  Clock,
  Moon,
  PauseCircle,
  PlayCircle,
  Sun,
  Timer,
  UserRound,
  Wrench,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  formatHmsFromSeconds,
  formatHoraArranqueFromMs,
  horaArranqueMsFromTimer,
  technicalFormFromRow,
  type MesBandejaMes,
} from "@/lib/mes-timer-band-shared"
import {
  shiftArranqueSeconds,
  shiftDemountSeconds,
} from "@/lib/mes-phase-timer-fields"
import {
  printingTurnosBandejaItems,
  sortPrintingTurnoBandejaItems,
  type PrintingTurnoBandejaItem,
} from "@/lib/printing-mes-band-status"
import { cn } from "@/lib/utils"
import type { WorkOrderListRow } from "@/types/api"
import {
  personnelLinesFromPrintingTurno,
  turnoGrupoLabelPrinting,
} from "@/pages/axones/printing-shift-history"
import type { PrintingTurnoEntry } from "@/pages/axones/printing-turnos"

export function printingTimerStateLabel(st: string): string {
  if (st === "running") return "En marcha"
  if (st === "paused") return "En pausa"
  if (st === "pending") return "Pendiente"
  if (st === "stopped") return "Detenido"
  if (st === "completed") return "Completado"
  return st || "—"
}

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

export type PrintingTurnLiveTimes = {
  efectivoSec: number
  deadSec: number
  arranqueSec: number
  demountSec: number
  totalProduccionSec: number
  state: string
  numParadas: number
  horaArranque: string
  arranqueLive: boolean
  demountLive: boolean
  efectivoLive: boolean
}

export function resolvePrintingTurnLiveTimes(
  turno: PrintingTurnoEntry,
  nowMs: number,
): PrintingTurnLiveTimes {
  const t = turno.timer
  let efectivoSec = t.effectiveAccSec
  if (t.state === "running" && t.lastResumeAtMs > 0) {
    efectivoSec += (nowMs - t.lastResumeAtMs) / 1000
  }
  let deadSec = t.deadAccSec
  if (t.state === "paused" && t.pauseAtMs > 0) {
    deadSec += (nowMs - t.pauseAtMs) / 1000
  }
  const pauses = Array.isArray(t.pauses) ? t.pauses : []
  return {
    efectivoSec,
    deadSec,
    arranqueSec: shiftArranqueSeconds(t, nowMs),
    demountSec: shiftDemountSeconds(t, nowMs),
    totalProduccionSec: efectivoSec + deadSec,
    state: t.state,
    numParadas: pauses.length,
    horaArranque: formatHoraArranqueFromMs(horaArranqueMsFromTimer(t)),
    arranqueLive: t.arranqueState === "running",
    demountLive: t.demountState === "running",
    efectivoLive: t.state === "running",
  }
}

function otPhaseTotals(
  items: PrintingTurnoBandejaItem[],
  nowMs: number,
): { arranqueSec: number; demountSec: number } {
  let arranqueSec = 0
  let demountSec = 0
  for (const { turno } of items) {
    const live = resolvePrintingTurnLiveTimes(turno, nowMs)
    arranqueSec += live.arranqueSec
    demountSec += live.demountSec
  }
  return { arranqueSec, demountSec }
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
  icon?: ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/15 px-3 py-2.5",
        live && "border-emerald-500/35 bg-emerald-500/8",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">{label}</p>
        {live ? (
          <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 font-mono text-xl font-semibold tabular-nums leading-none tracking-tight",
          live ? "text-emerald-800 dark:text-emerald-200" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? <p className="text-muted-foreground mt-1 text-[11px] leading-snug">{sub}</p> : null}
    </div>
  )
}

export function MesBandejaOtTimesSummary({ mesBand }: { mesBand: MesBandejaMes }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <TimeMetricCard
        label="Efectivo acum."
        value={mesBand.effectiveHms}
        sub="Todos los turnos de la OT"
        icon={PlayCircle}
        live={mesBand.workflow === "iniciado"}
      />
      <TimeMetricCard
        label="Paradas (muerto)"
        value={mesBand.deadHms}
        sub={mesBand.showDeadBreakdown ? "Tiempo en parada registrada" : "Sin paradas aún"}
        icon={PauseCircle}
        live={mesBand.workflow === "pausado"}
      />
      <TimeMetricCard
        label="Total producción"
        value={mesBand.totalHms}
        sub="Efectivo + paradas"
        icon={Timer}
      />
    </div>
  )
}

function PrintingTurnTimesCard({
  turno,
  enCurso,
  nowMs,
}: {
  turno: PrintingTurnoEntry
  enCurso: boolean
  nowMs: number
}) {
  const live = resolvePrintingTurnLiveTimes(turno, nowMs)
  const pauses = Array.isArray(turno.timer.pauses) ? turno.timer.pauses : []
  const label = turnoGrupoLabelPrinting(turno.turno, turno.grupo)

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border text-sm shadow-sm",
        enCurso
          ? "border-violet-400/50 bg-gradient-to-br from-violet-500/10 via-background to-background"
          : "border-border/80 bg-card",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {turno.turno === "nocturno" ? (
              <Moon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
            ) : turno.turno === "diurno" ? (
              <Sun className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
            ) : (
              <Clock className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="font-semibold text-foreground">{label}</span>
            {enCurso ? (
              <Badge
                variant="outline"
                className="border-violet-500/50 bg-violet-500/15 text-[10px] font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-100"
              >
                En curso
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            Cronómetro:{" "}
            <span className="font-medium text-foreground">{printingTimerStateLabel(live.state)}</span>
            {live.horaArranque !== "—" ? (
              <>
                {" "}
                · Último play{" "}
                <span className="font-mono text-foreground/90">{live.horaArranque}</span>
              </>
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
          className="py-2"
        />
        <TimeMetricCard
          label="Efectivo"
          value={formatHmsFromSeconds(live.efectivoSec)}
          live={live.efectivoLive}
          icon={PlayCircle}
          className="py-2"
        />
        <TimeMetricCard
          label="Paradas"
          value={formatHmsFromSeconds(live.deadSec)}
          sub={`${live.numParadas} registro(s)`}
          live={live.state === "paused"}
          icon={PauseCircle}
          className="py-2"
        />
        <TimeMetricCard
          label="Desmontaje"
          value={formatHmsFromSeconds(live.demountSec)}
          live={live.demountLive}
          icon={Wrench}
          className="py-2"
        />
        <TimeMetricCard
          label="Total turno"
          value={formatHmsFromSeconds(live.totalProduccionSec)}
          sub="Efectivo + paradas"
          icon={Timer}
          className="py-2 sm:col-span-2 lg:col-span-2"
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
                  <span className="font-mono text-muted-foreground">{formatHmsFromSeconds(p.duration_sec)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

export function PrintingMesBandejaTimesPanel({
  row,
  mesBand,
  nowMs,
}: {
  row: WorkOrderListRow
  mesBand: MesBandejaMes | null
  nowMs: number
}) {
  const form = technicalFormFromRow(row)
  const items = useMemo(() => printingTurnosBandejaItems(form), [form])
  const sorted = useMemo(
    () => sortPrintingTurnoBandejaItems(items, "desc"),
    [items],
  )
  const phaseOt = useMemo(() => otPhaseTotals(items, nowMs), [items, nowMs])

  if (!mesBand && items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        Sin datos de cronómetro en esta OT. Inicie turno y use el temporizador en Producción → Impresión.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {mesBand ? <MesBandejaOtTimesSummary mesBand={mesBand} /> : null}
      {(phaseOt.arranqueSec > 0.5 || phaseOt.demountSec > 0.5) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <TimeMetricCard
            label="Arranque acum. OT"
            value={formatHmsFromSeconds(phaseOt.arranqueSec)}
            sub="Suma de todos los turnos"
            icon={Wrench}
          />
          <TimeMetricCard
            label="Desmontaje acum. OT"
            value={formatHmsFromSeconds(phaseOt.demountSec)}
            sub="Suma de todos los turnos"
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
                <PrintingTurnTimesCard turno={turno} enCurso={enCurso} nowMs={nowMs} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function personnelRoleIcon(line: string) {
  if (line.includes("Supervisor")) return "text-sky-600 dark:text-sky-300"
  if (line.includes("Ayudante")) return "text-amber-700 dark:text-amber-300"
  return "text-violet-700 dark:text-violet-300"
}

export function PrintingTurnoPersonnelBandejaCard({
  turno,
  enCurso,
}: {
  turno: PrintingTurnoEntry
  enCurso: boolean
}) {
  const label = turnoGrupoLabelPrinting(turno.turno, turno.grupo)
  const people = personnelLinesFromPrintingTurno(turno)
  const cierre = turno.closed_at ? formatTurnoInstant(turno.closed_at) : null

  return (
    <article
      className={cn(
        "rounded-xl border p-3 shadow-sm transition-colors",
        enCurso
          ? "border-violet-400/45 bg-gradient-to-br from-violet-500/12 via-background to-background ring-1 ring-violet-500/20"
          : "border-border/80 bg-card hover:border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-semibold",
              turno.turno === "nocturno"
                ? "border-indigo-500/45 bg-indigo-500/12 text-indigo-950 dark:text-indigo-100"
                : turno.turno === "diurno"
                  ? "border-amber-500/45 bg-amber-500/12 text-amber-950 dark:text-amber-100"
                  : "border-slate-500/40",
            )}
          >
            {label}
          </Badge>
          {enCurso ? (
            <Badge className="bg-violet-600 text-[10px] uppercase tracking-wide hover:bg-violet-600">
              Turno en curso
            </Badge>
          ) : null}
        </div>
        <div className="text-muted-foreground text-right text-[11px] leading-snug">
          <p className="font-medium text-foreground/90">Apertura</p>
          <p>{formatTurnoInstant(turno.started_at)}</p>
          {cierre ? (
            <>
              <p className="mt-1 font-medium text-foreground/90">Cierre</p>
              <p>{cierre}</p>
            </>
          ) : (
            <p className="mt-1 italic">Abierto</p>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-border/50 pt-3">
        <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Personal
        </p>
        {people.length === 0 ? (
          <p className="text-muted-foreground text-xs italic">Sin personal registrado en este turno.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {people.map((line, i) => {
              const [name, role] = line.split(" — ")
              return (
                <li
                  key={`${turno.id}-person-${i}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-xs"
                >
                  <span className="font-medium text-foreground">{name || line}</span>
                  {role ? (
                    <span className={cn("text-[10px] font-semibold uppercase", personnelRoleIcon(line))}>
                      {role}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {turno.closed_by?.name ? (
        <p className="text-muted-foreground mt-2 text-[11px]">
          Cerrado por <span className="text-foreground">{turno.closed_by.name}</span>
        </p>
      ) : null}
    </article>
  )
}
