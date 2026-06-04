import { Info } from "lucide-react"

import { mesBandejaStatePillClass, type MesOperativoEstado } from "@/lib/mes-timer-band-shared"

type Props = {
  areaLabel: string
  estado: MesOperativoEstado
  /** Kg producidos acumulados (sufijo opcional en el pie del banner). */
  producidoKg?: number
  lastServerSaveAt?: string | null
}

export function MesOperativoEstadoCard({
  areaLabel,
  estado,
  producidoKg = 0,
  lastServerSaveAt = null,
}: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="flex min-w-0 flex-1 gap-3">
        <Info className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Estado operativo {areaLabel}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={mesBandejaStatePillClass(estado.workflow)}
              role="status"
            >
              {estado.mes.statusLabel ?? estado.title}
            </span>
            {estado.contextLine ? (
              <span className="text-muted-foreground text-xs">{estado.contextLine}</span>
            ) : null}
          </div>
          <p className="text-foreground text-xs leading-relaxed">{estado.mes.hint}</p>
          <p className="text-muted-foreground border-t border-border/60 pt-2 text-xs leading-relaxed">
            {estado.bannerHint}
            {producidoKg > 0.005 ? ` · ${producidoKg.toFixed(2)} kg producidos` : ""}
          </p>
          {lastServerSaveAt ? (
            <p className="text-muted-foreground text-[11px]">
              Último guardado en servidor:{" "}
              <time dateTime={lastServerSaveAt}>
                {new Date(lastServerSaveAt).toLocaleString()}
              </time>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
