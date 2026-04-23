"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { ProductionAreaPanel } from "@/components/axones/ProductionAreaPanel"
import { WorkOrderDocumentSheet } from "@/components/axones/WorkOrderDocumentSheet"
import { apiDownloadFile, apiFetch, ApiError } from "@/lib/api"
import type { WorkOrderDetailRecord } from "@/types/api"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown } from "lucide-react"

function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":")
}

function AreaTimeMini({
  label,
  data,
}: {
  label: string
  data: unknown
}) {
  const o = data as Record<string, unknown> | null | undefined
  const t = o?.time_totals_seconds as Record<string, string> | undefined
  if (!t) {
    return (
      <div className="rounded-lg border p-3 text-sm">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground">Sin tiempos</div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground mt-1 grid grid-cols-3 gap-1 font-mono text-xs">
        <span>M {formatHms(Number(t.mount ?? 0))}</span>
        <span>P {formatHms(Number(t.production ?? 0))}</span>
        <span>T {formatHms(Number(t.downtime ?? 0))}</span>
      </div>
    </div>
  )
}

export default function WorkOrderDetailPage() {
  const { woId } = useParams<{ woId: string }>()
  const id = Number(woId)
  const [searchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") ?? "").toLowerCase().trim()
  const initialTab =
    tabParam === "printing" ||
    tabParam === "montaje" ||
    tabParam === "laminacion" ||
    tabParam === "corte"
      ? tabParam
      : "montaje"
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<WorkOrderDetailRecord | null>(null)
  const [summary, setSummary] = useState<Record<string, unknown> | null>(
    null,
  )

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setLoading(true)
    try {
      const o = await apiFetch<WorkOrderDetailRecord>(`work-orders/${id}`)
      setOrder(o)
      try {
        const s = await apiFetch<Record<string, unknown>>(
          `work-orders/${id}/production-summary`,
        )
        setSummary(s)
      } catch {
        setSummary(null)
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT.")
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  async function downloadOrdenPdf() {
    if (!Number.isFinite(id)) return
    try {
      await apiDownloadFile(`work-orders/${id}/orden-produccion.pdf`, {
        fallbackName: `orden-produccion-${id}.pdf`,
      })
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF.")
    }
  }

  if (!Number.isFinite(id)) {
    return (
      <div className="p-6">
        <p className="text-destructive">ID de orden inválido.</p>
        <Link to="/axones/ordenes-trabajo" className="text-primary underline">
          Volver al listado
        </Link>
      </div>
    )
  }

  const client = order?.client
  const product = order?.product
  const code = order?.code ?? `OT #${id}`

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/axones/ordenes-trabajo"
          className="text-muted-foreground text-sm hover:text-foreground"
        >
          ← Órdenes de trabajo
        </Link>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : !order ? (
        <p className="text-destructive">No se encontró la orden.</p>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight font-mono">
              {code}
            </h1>
            <p className="text-muted-foreground text-sm">
              {client?.name ?? "—"} · {product?.name ?? "—"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Seleccione una pestaña de fase para temporizadores, consumos y
              mermas. Los datos se guardan en el API por área.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void downloadOrdenPdf()}>
              Orden de producción (PDF)
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to={`/axones/calidad?ot=${id}`}>Calidad / certificado</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadOrder()}
            >
              Refrescar cabecera
            </Button>
          </div>

          <WorkOrderDocumentSheet
            workOrder={order}
            workOrderId={id}
            onSaved={() => void loadOrder()}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Movimiento y tiempos (vista rápida)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary ? (
                <>
                  <p className="text-muted-foreground text-xs">
                    Totales acumulados por tipo de segmento (montaje / producción
                    / tiempo muerto) hasta el momento.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <AreaTimeMini label="Montaje" data={summary.montaje} />
                    <AreaTimeMini label="Impresión" data={summary.printing} />
                    <AreaTimeMini
                      label="Laminación"
                      data={summary.laminacion}
                    />
                    <AreaTimeMini label="Corte" data={summary.corte} />
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No se pudo cargar el resumen agregado.
                </p>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="montaje">Montaje</TabsTrigger>
              <TabsTrigger value="printing">Impresión</TabsTrigger>
              <TabsTrigger value="laminacion">Laminación</TabsTrigger>
              <TabsTrigger value="corte">Corte</TabsTrigger>
            </TabsList>
            <TabsContent value="montaje" className="mt-4">
              <ProductionAreaPanel
                workOrderId={id}
                title="Montaje"
                areaPath="montaje"
                usageMode="montaje"
              />
            </TabsContent>
            <TabsContent value="printing" className="mt-4">
              <ProductionAreaPanel
                workOrderId={id}
                title="Impresión"
                areaPath="printing"
                usageMode="bobina"
              />
            </TabsContent>
            <TabsContent value="laminacion" className="mt-4">
              <ProductionAreaPanel
                workOrderId={id}
                title="Laminación"
                areaPath="laminacion"
                usageMode="bobina"
                laminacionSolvent
              />
            </TabsContent>
            <TabsContent value="corte" className="mt-4">
              <ProductionAreaPanel
                workOrderId={id}
                title="Corte"
                areaPath="corte"
                usageMode="bobina"
              />
            </TabsContent>
          </Tabs>

          <Collapsible className="rounded-xl border">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-4 text-left text-sm font-medium hover:bg-muted/50">
              <span>Datos técnicos (JSON)</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="max-h-80 overflow-auto border-t p-4 text-xs">
                {JSON.stringify(
                  {
                    order,
                    production_summary: summary as Record<string, unknown>,
                  },
                  null,
                  2,
                )}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  )
}
