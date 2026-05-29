"use client"

import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type WastagePreviewPayload = {
  generated_at: string
  work_order_id: number
  work_order_code: string
  product?: string | null
  client?: string | null
  turno: {
    turno: string
    grupo: string
    operador: string
    ayudante: string
    supervisor: string
  }
  metrics: {
    total_entrada_kg: number
    salida_kg: number
    scrap_kg: number
    devolucion_buena_kg: number
    devolucion_rechazada_kg: number
  }
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  return 0
}

export default function WorkOrderPrintingDesperdicioPreviewPage() {
  const { woId } = useParams()
  const id = Number(woId ?? "")

  const payload = useMemo(() => {
    if (!Number.isFinite(id) || id < 1) return null
    try {
      const raw = localStorage.getItem(`axones.printing.wastage-preview.${id}`)
      if (!raw) return null
      return JSON.parse(raw) as WastagePreviewPayload
    } catch {
      return null
    }
  }, [id])

  const m = payload?.metrics

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa · Desperdicio (impresión)</h1>
          <p className="text-muted-foreground text-sm">
            Revise métricas de desperdicio y materiales antes de imprimir el resumen operativo del turno.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to={`/ordenes-trabajo/${Number.isFinite(id) ? id : ""}/produccion?tab=printing`}>
              Volver a impresión
            </Link>
          </Button>
          <Button type="button" onClick={() => window.print()} disabled={!payload}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {!payload ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          No hay datos de vista previa. Vuelva a la OT, active el turno y presione{" "}
          <span className="font-semibold text-foreground">Vista previa desperdicio</span> en el resumen de producción.
        </div>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">OT</p>
              <p className="font-mono text-sm font-semibold">{payload.work_order_code}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Generado</p>
              <p className="font-mono text-sm font-medium">{readString(payload.generated_at).slice(0, 19) || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Cliente</p>
              <p className="text-sm font-medium">{readString(payload.client) || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Producto</p>
              <p className="text-sm font-medium">{readString(payload.product) || "—"}</p>
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
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Totales del turno (Kg / %)</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Material entrada</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {readNum(m?.total_entrada_kg).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Total salida</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {readNum(m?.salida_kg).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Total desperdicio</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {readNum(m?.scrap_kg).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Devolución buena</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {readNum(m?.devolucion_buena_kg).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Devolución rechazada</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {readNum(m?.devolucion_rechazada_kg).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
