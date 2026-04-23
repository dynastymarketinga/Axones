"use client"

import { useState } from "react"
import { toast } from "sonner"

import { apiDownloadFile, apiFetch, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export default function AxonesReportsPage() {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [woId, setWoId] = useState("")
  const [clientId, setClientId] = useState("")
  const [productId, setProductId] = useState("")
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)

  async function run(
    path: string,
    query: Record<string, string | number | undefined>,
  ) {
    setLoading(true)
    setResult("")
    try {
      const data = await apiFetch<unknown>(path, { query })
      setResult(JSON.stringify(data, null, 2))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("Error al generar el reporte.")
    } finally {
      setLoading(false)
    }
  }

  async function csvInventoryDaily() {
    setLoading(true)
    try {
      await apiDownloadFile("reports/inventory-daily", {
        query: { from, to, format: "csv" },
        fallbackName: "inventory-daily.csv",
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el CSV.")
    } finally {
      setLoading(false)
    }
  }

  async function copyResult() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      toast.success("Copiado al portapapeles.")
    } catch {
      toast.error("No se pudo copiar.")
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground text-sm">
          Consultas al API <code className="text-xs">/reports/*</code> con
          vista por módulo. Use CSV donde esté disponible.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rango de fechas global</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="grid gap-2">
            <Label>Desde</Label>
            <Input
              type="date"
              value={from}
              onChange={(ev) => setFrom(ev.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Hasta</Label>
            <Input
              type="date"
              value={to}
              onChange={(ev) => setTo(ev.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inventario" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="produccion">Producción y tiempos</TabsTrigger>
          <TabsTrigger value="mermas">Mermas</TabsTrigger>
          <TabsTrigger value="ot">Por orden de trabajo</TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="mt-4 space-y-3">
          <p className="text-muted-foreground text-sm">
            Entradas y salidas por fecha; consumo agregado cliente/producto;
            inventario de bobinas rechazadas.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void run("reports/inventory-daily", { from, to })}
            >
              Movimientos diarios (JSON)
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void csvInventoryDaily()}
            >
              Movimientos diarios (CSV)
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() =>
                void run("reports/consumption-by-client-product", { from, to })
              }
            >
              Consumo por cliente y producto
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void run("reports/rejected-bobinas", {})}
            >
              Bobinas rechazadas
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="produccion" className="mt-4 space-y-3">
          <p className="text-muted-foreground text-sm">
            Tiempos por área (montaje, producción, paradas) y consumo de tintas
            por cliente en el período.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() =>
                void run("reports/production-time-by-area", { from, to })
              }
            >
              Tiempos por área
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() =>
                void run("reports/tinta-consumption-by-client", { from, to })
              }
            >
              Consumo tintas por cliente
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="mermas" className="mt-4 space-y-4">
          <p className="text-muted-foreground text-sm">
            Desperdicio filtrable por fechas y opcionalmente cliente/producto.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label>client_id</Label>
              <Input
                inputMode="numeric"
                value={clientId}
                onChange={(ev) => setClientId(ev.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="grid gap-2">
              <Label>product_id</Label>
              <Input
                inputMode="numeric"
                value={productId}
                onChange={(ev) => setProductId(ev.target.value)}
                placeholder="opcional"
              />
            </div>
            <Button
              type="button"
              disabled={loading}
              onClick={() =>
                void run("reports/scrap-by-filters", {
                  from,
                  to,
                  client_id: clientId.trim()
                    ? Number(clientId)
                    : undefined,
                  product_id: productId.trim()
                    ? Number(productId)
                    : undefined,
                })
              }
            >
              Ejecutar reporte de mermas
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="ot" className="mt-4 space-y-4">
          <p className="text-muted-foreground text-sm">
            Resumen de material, despachos y usos por bobina vinculados a una OT
            (movimiento de orden §9).
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label>work_order_id</Label>
              <Input
                inputMode="numeric"
                value={woId}
                onChange={(ev) => setWoId(ev.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={loading || !woId.trim()}
              onClick={() =>
                void run("reports/work-order-material-summary", {
                  work_order_id: Number(woId),
                })
              }
            >
              Ejecutar
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {result ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyResult()}
            >
              Copiar JSON
            </Button>
          </div>
          <pre className="max-h-[480px] overflow-auto rounded-xl border bg-muted p-4 text-xs">
            {result}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
