"use client"

import { PackageCheck, Undo2 } from "lucide-react"

import type { MesBandejaDevolucionesSnapshot } from "@/lib/printing-mes-band-devoluciones"

type MesBandejaBobinasExpandPanelProps = {
  devoluciones: MesBandejaDevolucionesSnapshot
  workOrderCode: string
}

/** Acordeón compacto: solo kilos acumulados buena / mala. */
export function MesBandejaBobinasExpandPanel({
  devoluciones,
  workOrderCode,
}: MesBandejaBobinasExpandPanelProps) {
  return (
    <div className="flex flex-wrap items-stretch gap-3 px-1 py-1">
      <p className="flex w-full flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Undo2 className="h-3.5 w-3.5 shrink-0 text-primary/60" aria-hidden />
        <span>
          Devoluciones ·{" "}
          <span className="font-mono font-semibold text-foreground">{workOrderCode}</span>
        </span>
      </p>
      <div className="flex min-w-[9rem] flex-1 items-center gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/25">
        <PackageCheck className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900/80 dark:text-emerald-200/90">
            Devolución buena acum.
          </p>
          <p className="font-mono text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-100">
            {devoluciones.buenaTotalKg.toFixed(2)}{" "}
            <span className="text-sm font-semibold">Kg</span>
          </p>
        </div>
      </div>
      <div className="flex min-w-[9rem] flex-1 items-center gap-3 rounded-lg border border-rose-200/80 bg-rose-50/50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/25">
        <Undo2 className="h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-900/80 dark:text-rose-200/90">
            Devolución mala acum.
          </p>
          <p className="font-mono text-lg font-bold tabular-nums text-rose-800 dark:text-rose-100">
            {devoluciones.malaTotalKg.toFixed(2)}{" "}
            <span className="text-sm font-semibold">Kg</span>
          </p>
        </div>
      </div>
    </div>
  )
}
