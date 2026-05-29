import { useState } from "react"
import { ChevronDown, History } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"
import { cn } from "@/lib/utils"

import {
  countBobinasConKg,
  printingTurnoResumen,
  type PrintingTurnoEntry,
} from "./printing-turnos"

export function personnelLinesFromPrintingTurno(t: PrintingTurnoEntry): string[] {
  const lines: string[] = []
  const op = t.operador.trim()
  if (op) lines.push(`${op} — Operador`)
  t.ayudante
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n) => lines.push(`${n} — Ayudante`))
  const sup = t.supervisor.trim()
  if (sup) lines.push(`${sup} — Supervisor`)
  return lines
}

export function turnoGrupoLabelPrinting(turno: string, grupo: string): string {
  const t = turno === "diurno" ? "Diurno" : turno === "nocturno" ? "Nocturno" : turno.trim() || "—"
  const g = grupo === "A" || grupo === "B" || grupo === "C" ? `Grupo ${grupo}` : grupo.trim() || "—"
  return `${t} · ${g}`
}

function formatClosedAt(iso: string | null): string {
  if (!iso) return "Sin fecha de cierre"
  try {
    return new Date(iso).toLocaleString("es-VE")
  } catch {
    return iso
  }
}

function formatStartedAt(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("es-VE")
  } catch {
    return iso
  }
}

type PrintingTurnoDetailBodyProps = {
  turno: PrintingTurnoEntry
  formatTimerHms?: (s: number) => string
  compact?: boolean
}

export function PrintingTurnoDetailBody({
  turno,
  formatTimerHms = formatHmsFromSeconds,
  compact = false,
}: PrintingTurnoDetailBodyProps) {
  const res = printingTurnoResumen(turno)
  const people = personnelLinesFromPrintingTurno(turno)
  const pauses = Array.isArray(turno.timer.pauses) ? turno.timer.pauses : []
  const numEntrada = countBobinasConKg(turno.entradaBobinasKg)

  return (
    <div className={cn("space-y-3 text-xs", compact && "space-y-2")}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border bg-muted/20 px-2.5 py-2">
          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">Apertura</p>
          <p className="mt-0.5 font-medium text-foreground">{formatStartedAt(turno.started_at)}</p>
        </div>
        <div className="rounded-md border bg-muted/20 px-2.5 py-2">
          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">Cierre</p>
          <p className="mt-0.5 font-medium text-foreground">{formatClosedAt(turno.closed_at)}</p>
        </div>
        <div className="rounded-md border bg-muted/20 px-2.5 py-2 sm:col-span-2 lg:col-span-1">
          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">Cuadrilla</p>
          <p className="mt-0.5 font-medium text-foreground">{turnoGrupoLabelPrinting(turno.turno, turno.grupo)}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border px-2.5 py-2">
          <p className="text-muted-foreground">N° bobinas salida</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{res.numBobinasSalida}</p>
        </div>
        <div className="rounded-md border px-2.5 py-2">
          <p className="text-muted-foreground">Peso salida</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{res.pesoSalidaKg.toFixed(2)} Kg</p>
        </div>
        <div className="rounded-md border px-2.5 py-2">
          <p className="text-muted-foreground">Entrada ({numEntrada} reg.)</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{res.pesoEntradaKg.toFixed(2)} Kg</p>
        </div>
        <div className="rounded-md border px-2.5 py-2">
          <p className="text-muted-foreground">Desperdicio</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{res.scrapKg.toFixed(2)} Kg</p>
        </div>
      </div>

      {res.metrajeTotalM > 0.005 ? (
        <p className="text-muted-foreground">
          Metraje salida (suma etiquetas):{" "}
          <span className="font-mono font-medium text-foreground">{res.metrajeTotalM.toFixed(2)} m</span>
        </p>
      ) : null}

      <p className="text-muted-foreground">
        Tiempo efectivo{" "}
        <span className="font-mono font-medium text-foreground">
          {formatTimerHms(turno.timer.effectiveAccSec)}
        </span>
        {" · "}
        Paradas ({res.numParadas}):{" "}
        <span className="font-mono font-medium text-foreground">
          {formatTimerHms(turno.timer.deadAccSec)}
        </span>
      </p>

      {people.length > 0 ? (
        <div>
          <p className="mb-1 font-medium text-foreground">Personal</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {people.map((line, i) => (
              <li key={`${turno.id}-p-${i}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">Sin personal registrado en este turno.</p>
      )}

      {pauses.length > 0 ? (
        <div>
          <p className="mb-1 font-medium text-foreground">Paradas del turno</p>
          <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border bg-muted/10 p-2">
            {pauses.map((p, i) => (
              <li key={`${turno.id}-pause-${i}`} className="text-muted-foreground leading-snug">
                <span className="font-medium text-foreground">{p.reason || "Sin motivo"}</span>
                {p.duration_sec > 0 ? (
                  <span className="font-mono"> · {formatTimerHms(p.duration_sec)}</span>
                ) : null}
                {p.obs?.trim() ? <span className="block text-[11px]">{p.obs.trim()}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {turno.observaciones.trim() ? (
        <p className="rounded-md border border-dashed px-2.5 py-2 text-muted-foreground">
          <span className="font-medium text-foreground">Observaciones: </span>
          {turno.observaciones.trim()}
        </p>
      ) : null}

      {turno.closed_by?.name ? (
        <p className="text-[11px] text-muted-foreground">
          Cerrado por: <span className="text-foreground">{turno.closed_by.name}</span>
        </p>
      ) : null}
    </div>
  )
}

type PrintingTurnoHistorialItemProps = {
  turno: PrintingTurnoEntry
  formatTimerHms?: (s: number) => string
  defaultOpen?: boolean
}

export function PrintingTurnoHistorialItem({
  turno,
  formatTimerHms = formatHmsFromSeconds,
  defaultOpen = false,
}: PrintingTurnoHistorialItemProps) {
  const res = printingTurnoResumen(turno)
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-background">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-muted/40">
        <span className="min-w-0">
          <span className="block font-medium text-foreground">{formatClosedAt(turno.closed_at)}</span>
          <span className="text-muted-foreground mt-0.5 block">
            {turnoGrupoLabelPrinting(turno.turno, turno.grupo)} · {turno.operador || "—"} · Salida{" "}
            {res.pesoSalidaKg.toFixed(2)} Kg
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 pb-3 pt-2">
        <PrintingTurnoDetailBody turno={turno} formatTimerHms={formatTimerHms} compact />
      </CollapsibleContent>
    </Collapsible>
  )
}

type PrintingLastClosedReadonlyPanelProps = {
  turno: PrintingTurnoEntry
  formatTimerHms?: (s: number) => string
}

/** Panel entre turnos: último turno cerrado (solo lectura), patrón montaje. */
export function PrintingLastClosedReadonlyPanel({
  turno,
  formatTimerHms = formatHmsFromSeconds,
}: PrintingLastClosedReadonlyPanelProps) {
  const res = printingTurnoResumen(turno)

  return (
    <div className="rounded-lg border border-sky-300/50 bg-sky-50/40 p-3 dark:border-sky-700/40 dark:bg-sky-950/25">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
        Último turno cerrado (solo lectura)
      </div>
      <p className="text-muted-foreground mb-3 text-xs leading-snug">
        Cerrado el {formatClosedAt(turno.closed_at)}. Revise bobinas, paradas y personal antes de iniciar el
        siguiente turno.
      </p>
      <div className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-md border bg-background px-2.5 py-2">
          <p className="text-muted-foreground">Bobinas / salida</p>
          <p className="font-semibold text-foreground">
            {res.numBobinasSalida} · {res.pesoSalidaKg.toFixed(2)} Kg
          </p>
        </div>
        <div className="rounded-md border bg-background px-2.5 py-2">
          <p className="text-muted-foreground">Entrada</p>
          <p className="font-semibold text-foreground">{res.pesoEntradaKg.toFixed(2)} Kg</p>
        </div>
        <div className="rounded-md border bg-background px-2.5 py-2">
          <p className="text-muted-foreground">Desperdicio · paradas</p>
          <p className="font-semibold text-foreground">
            {res.scrapKg.toFixed(2)} Kg · {res.numParadas}
          </p>
        </div>
      </div>
      <PrintingTurnoDetailBody turno={turno} formatTimerHms={formatTimerHms} compact />
      <p className="text-muted-foreground mt-3 text-xs leading-snug">
        Para capturar nuevos datos, use <span className="font-semibold text-foreground">Iniciar turno</span> arriba.
      </p>
    </div>
  )
}

type PrintingTurnosHistorialSectionProps = {
  cerrados: PrintingTurnoEntry[]
  formatTimerHms?: (s: number) => string
  /** Abrir el último turno por defecto en el acordeón. */
  expandLatest?: boolean
}

export function PrintingTurnosHistorialSection({
  cerrados,
  formatTimerHms = formatHmsFromSeconds,
  expandLatest = true,
}: PrintingTurnosHistorialSectionProps) {
  const [sectionOpen, setSectionOpen] = useState(true)
  if (cerrados.length === 0) return null

  const sorted = [...cerrados].sort((a, b) =>
    String(b.closed_at ?? "").localeCompare(String(a.closed_at ?? "")),
  )
  const latestId = sorted[0]?.id

  return (
    <Collapsible
      open={sectionOpen}
      onOpenChange={setSectionOpen}
      className="rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-background"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium hover:bg-muted/50">
        <span className="inline-flex items-center gap-2">
          <History className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          Historial por turno — acumulativo ({cerrados.length})
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", sectionOpen && "rotate-180")}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-2 border-t px-3 pb-3 pt-2">
          {sorted.map((t) => (
            <li key={t.id}>
              <PrintingTurnoHistorialItem
                turno={t}
                formatTimerHms={formatTimerHms}
                defaultOpen={expandLatest && t.id === latestId}
              />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
