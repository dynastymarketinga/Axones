"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { ProductionAreaPanel } from "@/components/axones/ProductionAreaPanel"
import { WorkOrderDocumentSheet } from "@/components/axones/WorkOrderDocumentSheet"
import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import WorkOrderPrintingControlPanel from "@/pages/axones/WorkOrderPrintingControlPanel"
import WorkOrderLaminacionControlPanel from "@/pages/axones/WorkOrderLaminacionControlPanel"
import WorkOrderCorteControlPanel from "@/pages/axones/WorkOrderCorteControlPanel"
import type { WorkOrderDetailRecord } from "@/types/api"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown } from "lucide-react"

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function yesNoLabel(v: unknown): string {
  const s = readString(v).trim().toLowerCase()
  if (s === "si" || s === "sí") return "Si"
  if (s === "no") return "No"
  return "—"
}

export default function WorkOrderDetailPage() {
  const { woId } = useParams<{ woId: string }>()
  const id = Number(woId)
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()
  const isBoss =
    role === "boss" ||
    role === "admin" ||
    role === "jefe_supremo" ||
    role === "superadmin"
  const canUsePrintingOps = isBoss || role === "impresion" || role === "printing"
  const canUseLaminacionOps = isBoss || role === "laminacion"
  const canUseTintasOps = isBoss || role === "tintas"
  const isPrintingOperator = role === "impresion" || role === "printing"
  const otBackPath = isPrintingOperator ? "/impresion" : "/ordenes-trabajo"
  const [searchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") ?? "").toLowerCase().trim()
  const initialTab = (() => {
    if (tabParam === "printing" && canUsePrintingOps) return "printing"
    if (tabParam === "laminacion" && canUseLaminacionOps) return "laminacion"
    if (tabParam === "tintas" && canUseTintasOps) return "tintas"
    if (tabParam === "montaje" || tabParam === "corte") return tabParam
    return "montaje"
  })()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<WorkOrderDetailRecord | null>(null)

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setLoading(true)
    try {
      const o = await apiFetch<WorkOrderDetailRecord>(`work-orders/${id}`)
      setOrder(o)
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

  if (!Number.isFinite(id)) {
    return (
      <div className="p-6">
        <p className="text-destructive">ID de orden inválido.</p>
        <Link to={otBackPath} className="text-primary underline">
          Volver al listado
        </Link>
      </div>
    )
  }

  const client = order?.client
  const product = order?.product
  const code = order?.code ?? `OT #${id}`
  const form = (order?.technical_document?.form ?? {}) as Record<string, unknown>
  const sustratosImpRaw = Array.isArray(form.sustratosVirgenImp)
    ? (form.sustratosVirgenImp as Array<Record<string, unknown>>)
    : []
  const sustratoImp1Id = readString(
    sustratosImpRaw[0]?.material_id ?? form.sustratoVirgenImp1,
  )
  const sustratoImp1Free = readString(sustratosImpRaw[0]?.material_free_text).trim()
  const sustratoImp1Display = sustratoImp1Free || sustratoImp1Id || "—"
  const sustratoImp1Kg = readString(sustratosImpRaw[0]?.kg ?? form.kgUtilizarImp1)
  const tintaRows = Array.from({ length: 8 }, (_, idx) => {
    const n = idx + 1
    return {
      posicion: String(n),
      color: readString(form[`tintaColor${n}`]) || "—",
      anilox: readString(form[`tintaAnilox${n}`]) || "—",
      visc: readString(form[`tintaVisc${n}`]) || "—",
      observaciones: readString(form[`tintaObs${n}`]) || "—",
    }
  })
  const isPrintingFocusedView = tabParam === "printing" && canUsePrintingOps
  const isCorteFocusedView = tabParam === "corte"
  const showPrintingPrefill = isPrintingFocusedView

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to={otBackPath}
          className="text-muted-foreground text-sm hover:text-foreground"
        >
          {isPrintingOperator ? "← Área Impresión" : "← Órdenes de trabajo"}
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
              mermas. Los datos se guardan en el sistema por área.
            </p>
          </div>

          <WorkOrderDocumentSheet
            workOrder={order}
            workOrderId={id}
            readOnly={isPrintingOperator && !isBoss}
            onSaved={() => void loadOrder()}
          />

          {showPrintingPrefill ? (
            <Card className="border-l-4 border-fuchsia-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Área de impresión (pre-hecho)
                </CardTitle>
                <p className="text-muted-foreground text-xs">
                  Datos base pre-cargados desde la planilla de orden de trabajo.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-muted-foreground text-xs">Piñón (dientes)</div>
                  <div className="font-medium">{readString(form.pinonImp) || "—"}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-muted-foreground text-xs">Línea de corte</div>
                  <div className="font-medium">{yesNoLabel(form.lineaCorte)}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-muted-foreground text-xs">Figura emb. (1-8)</div>
                  <div className="font-medium">
                    {readString(form.figEmbImpDisplay) || "—"}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-muted-foreground text-xs">Sustrato 1</div>
                  <div className="font-medium">{sustratoImp1Display}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 md:col-span-2">
                  <div className="text-muted-foreground text-xs">Kg a utilizar</div>
                  <div className="font-medium">{sustratoImp1Kg || "—"}</div>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {showPrintingPrefill ? (
            <Card className="border-l-4 border-fuchsia-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  DESCRIPCION DE TINTAS
                </CardTitle>
                <p className="text-muted-foreground text-xs">
                  Vista pre-hecha de tintas guardadas en la planilla de orden de
                  trabajo.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="border px-2 py-1 text-left">POSICION</th>
                        <th className="border px-2 py-1 text-left">COLOR</th>
                        <th className="border px-2 py-1 text-left">ANILOX</th>
                        <th className="border px-2 py-1 text-left">VISC (seg)</th>
                        <th className="border px-2 py-1 text-left">OBSERVACIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tintaRows.map((row) => (
                        <tr key={row.posicion}>
                          <td className="border px-2 py-1">{row.posicion}</td>
                          <td className="border px-2 py-1">{row.color}</td>
                          <td className="border px-2 py-1">{row.anilox}</td>
                          <td className="border px-2 py-1">{row.visc}</td>
                          <td className="border px-2 py-1">{row.observaciones}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {isPrintingFocusedView ? (
            <WorkOrderPrintingControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
          ) : isCorteFocusedView ? (
            <WorkOrderCorteControlPanel workOrderId={id} />
          ) : (
            <Tabs defaultValue={initialTab} className="w-full">
              {initialTab !== "laminacion" && initialTab !== "corte" ? (
                <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="montaje">Montaje</TabsTrigger>
                  {canUsePrintingOps ? (
                    <TabsTrigger value="printing">Impresión</TabsTrigger>
                  ) : null}
                  {canUseLaminacionOps ? (
                    <TabsTrigger value="laminacion">Laminación</TabsTrigger>
                  ) : null}
                  {canUseTintasOps ? <TabsTrigger value="tintas">Tintas</TabsTrigger> : null}
                  <TabsTrigger value="corte">Corte</TabsTrigger>
                </TabsList>
              ) : null}
              <TabsContent value="montaje" className="mt-4">
                <ProductionAreaPanel
                  workOrderId={id}
                  title="Montaje"
                  areaPath="montaje"
                  usageMode="montaje"
                />
              </TabsContent>
              {canUsePrintingOps ? (
                <TabsContent value="printing" className="mt-4">
                  <WorkOrderPrintingControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
                </TabsContent>
              ) : null}
              {canUseLaminacionOps ? (
                <TabsContent value="laminacion" className="mt-4">
                  <WorkOrderLaminacionControlPanel workOrderId={id} />
                </TabsContent>
              ) : null}
              {canUseTintasOps ? (
                <TabsContent value="tintas" className="mt-4">
                  <ProductionAreaPanel
                    workOrderId={id}
                    title="Tintas"
                    areaPath="tintas"
                    usageMode="none"
                  />
                </TabsContent>
              ) : null}
              <TabsContent value="corte" className="mt-4">
                <WorkOrderCorteControlPanel workOrderId={id} />
              </TabsContent>
            </Tabs>
          )}

        </>
      )}
    </div>
  )
}
