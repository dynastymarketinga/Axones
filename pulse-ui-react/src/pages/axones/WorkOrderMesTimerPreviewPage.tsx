"use client"

import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type TimerPauseRow = {
  at: string
  reason: string
  obs: string
  duration_hms: string
}

export type MesTimerPreviewPayload = {
  generated_at: string
  work_order_id: number
  work_order_code: string
  turno: {
    turno: string
    grupo: string
    operador: string
    ayudante: string
    supervisor: string
  }
  timer: {
    state: string
    total_hms: string
    dead_hms: string
    effective_hms: string
    kg_hora: string
  }
  pauses: TimerPauseRow[]
}

type MesTimerPreviewArea = "impresion" | "montaje" | "laminacion" | "corte"

const AREA_CONFIG: Record<
  MesTimerPreviewArea,
  {
    title: string
    storageKey: (workOrderId: number) => string
    productionTab: string
    backLabel: string
  }
> = {
  impresion: {
    title: "Temporizador de impresión",
    storageKey: (id) => `axones.printing.timer-preview.${id}`,
    productionTab: "printing",
    backLabel: "Volver a impresión",
  },
  montaje: {
    title: "Temporizador de montaje",
    storageKey: (id) => `axones.montaje.timer-preview.${id}`,
    productionTab: "montaje",
    backLabel: "Volver a montaje",
  },
  laminacion: {
    title: "Temporizador de laminación",
    storageKey: (id) => `axones.laminacion.timer-preview.${id}`,
    productionTab: "laminacion",
    backLabel: "Volver a laminación",
  },
  corte: {
    title: "Temporizador de corte",
    storageKey: (id) => `axones.corte.timer-preview.${id}`,
    productionTab: "corte",
    backLabel: "Volver a corte",
  },
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readPayloadFromHash(): MesTimerPreviewPayload | null {
  const hash = window.location.hash
  if (!hash.startsWith("#p=")) return null
  try {
    const encoded = decodeURIComponent(hash.slice(3))
    const json = decodeURIComponent(escape(atob(encoded)))
    return JSON.parse(json) as MesTimerPreviewPayload
  } catch {
    return null
  }
}

function readPayloadFromStorage(storageKey: string): MesTimerPreviewPayload | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as MesTimerPreviewPayload
  } catch {
    return null
  }
}

type Props = {
  area: MesTimerPreviewArea
}

export function WorkOrderMesTimerPreviewPage({ area }: Props) {
  const { woId } = useParams()
  const id = Number(woId ?? "")
  const config = AREA_CONFIG[area]

  const payload = useMemo(() => {
    if (!Number.isFinite(id) || id < 1) return null
    const fromHash = readPayloadFromHash()
    if (fromHash) return fromHash
    return readPayloadFromStorage(config.storageKey(id))
  }, [config, id])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa · {config.title}</h1>
          <p className="text-muted-foreground text-sm">
            Use esta vista para revisar y preparar reporte/impresión del temporizador (incluye paradas).
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to={`/ordenes-trabajo/${Number.isFinite(id) ? id : ""}/produccion?tab=${config.productionTab}`}>
            {config.backLabel}
          </Link>
        </Button>
      </div>

      {!payload ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          No hay datos de vista previa. Vuelva a la OT, inicie el temporizador y presione{" "}
          <span className="font-semibold text-foreground">Vista previa</span>.
        </div>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">OT</p>
              <p className="text-sm font-semibold font-mono">{payload.work_order_code}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Generado</p>
              <p className="text-sm font-medium font-mono">{readString(payload.generated_at).slice(0, 19) || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Estado</p>
              <p className="text-sm font-medium">{readString(payload.timer?.state) || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Turno / Grupo</p>
              <p className="text-sm font-medium">
                {readString(payload.turno?.turno) || "—"} / {readString(payload.turno?.grupo) || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Operador</p>
              <p className="text-sm font-medium">{readString(payload.turno?.operador) || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Ayudantes</p>
              <p className="text-sm font-medium">{readString(payload.turno?.ayudante) || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Supervisor</p>
              <p className="text-sm font-medium">{readString(payload.turno?.supervisor) || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Kg/H estimado</p>
              <p className="text-sm font-semibold">{readString(payload.timer?.kg_hora) || "0.00"}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Total acumulado</p>
              <p className="text-lg font-bold font-mono">{readString(payload.timer?.total_hms) || "00:00:00"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tiempo efectivo</p>
              <p className="text-lg font-bold font-mono">{readString(payload.timer?.effective_hms) || "00:00:00"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tiempo muerto</p>
              <p className="text-lg font-bold font-mono">{readString(payload.timer?.dead_hms) || "00:00:00"}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="text-sm font-semibold">Paradas registradas</div>
              <div className="text-muted-foreground text-xs">{payload.pauses?.length ?? 0} filas</div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Duración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payload.pauses ?? []).length ? (
                  (payload.pauses ?? []).map((p, idx) => (
                    <TableRow key={`${p.at}-${idx}`}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{readString(p.at).slice(0, 19) || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{readString(p.reason) || "—"}</div>
                        {readString(p.obs) ? (
                          <div className="text-muted-foreground mt-1">{readString(p.obs)}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{readString(p.duration_hms) || "00:00:00"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Sin paradas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

export default function WorkOrderPrintingTimerPreviewPage() {
  return <WorkOrderMesTimerPreviewPage area="impresion" />
}
