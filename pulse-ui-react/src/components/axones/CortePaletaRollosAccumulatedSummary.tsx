"use client"

import { Scale } from "lucide-react"

import { formatDispatchKg } from "@/lib/dispatch-selection"
import {
  countRollosWithKg,
  filledRollosFromKg,
  sumRollosKg,
} from "@/lib/delivery-note-paleta-utils"
import { cn } from "@/lib/utils"

type Props = {
  workOrderCode?: string
  paletaLabel?: string
  rollosKg?: string[] | null
  /** Si el API trae total de paleta distinto a la suma de rollos. */
  totalKgHint?: string | number
  className?: string
}

/**
 * Resumen acumulado por paleta: solo rollos con peso + total (sin grilla de 48 huecos).
 */
export function CortePaletaRollosAccumulatedSummary({
  workOrderCode,
  paletaLabel,
  rollosKg,
  totalKgHint,
  className,
}: Props) {
  const filled = filledRollosFromKg(rollosKg)
  const rollosCount = countRollosWithKg(rollosKg)
  const sumFromRollos = sumRollosKg(rollosKg)
  const hintNum =
    totalKgHint != null && totalKgHint !== ""
      ? Number(String(totalKgHint).replace(",", "."))
      : NaN
  const totalKg =
    sumFromRollos > 0
      ? sumFromRollos
      : Number.isFinite(hintNum) && hintNum > 0
        ? hintNum
        : 0

  if (filled.length === 0 && totalKg <= 0) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        Sin rollos con peso registrados en esta paleta.
      </p>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-foreground">
          {workOrderCode ? (
            <>
              <span className="font-mono font-semibold">{workOrderCode}</span>
              {paletaLabel ? " · " : null}
            </>
          ) : null}
          {paletaLabel ?? null}
          {workOrderCode || paletaLabel ? " · " : null}
          {rollosCount} rollo(s) registrado(s)
        </p>
        <p className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
          <Scale className="h-4 w-4 shrink-0" aria-hidden />
          Acumulado: {formatDispatchKg(totalKg)}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[220px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Rollo</th>
              <th className="px-3 py-2 text-right font-semibold">Kg neto</th>
            </tr>
          </thead>
          <tbody>
            {filled.map((entry) => (
              <tr key={`r-${entry.rolloNumber}`} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-1.5 font-medium tabular-nums">
                  {String(entry.rolloNumber).padStart(2, "0")}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{entry.kgDisplay}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-500/10 font-semibold text-emerald-950 dark:text-emerald-100">
              <td className="px-3 py-2">Total ({rollosCount} rollo(s))</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatDispatchKg(totalKg)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
