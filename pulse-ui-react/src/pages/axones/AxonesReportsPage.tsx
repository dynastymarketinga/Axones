"use client"

import { useState } from "react"
import { toast } from "sonner"

import { apiDownloadFile, ApiError } from "@/lib/api"
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
  const [loading, setLoading] = useState(false)

  async function downloadCsv(
    path: string,
    fallbackName: string,
    query: Record<string, string | number | undefined>,
  ) {
    setLoading(true)
    try {
      await apiDownloadFile(path, {
        query: { ...query, format: "csv" },
        fallbackName,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el CSV.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground text-sm">
          Informes por módulo y rango de fechas. Use exportación CSV donde esté
          disponible.
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
              variant="outline"
              disabled={loading}
              onClick={() =>
                void downloadCsv("reports/inventory-daily", "inventory-daily.csv", {
                  from,
                  to,
                })
              }
            >
              Movimientos diarios (CSV)
            </Button>
            <div className="flex flex-col gap-1">
              <Button
                variant="outline"
                disabled={loading}
                onClick={() =>
                  void downloadCsv(
                    "reports/consumption-by-client-product",
                    "consumption-by-client-product.csv",
                    { from, to },
                  )
                }
              >
                Consumo por cliente y producto (CSV)
              </Button>
              <p className="text-muted-foreground max-w-xl text-xs">
                Agrega consumo de material vinculado a órdenes de trabajo en el rango (cliente y producto).
              </p>
            </div>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() =>
                void downloadCsv("reports/rejected-bobinas", "rejected-bobinas.csv", {
                  from,
                  to,
                })
              }
            >
              Bobinas rechazadas (CSV)
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
              variant="outline"
              disabled={loading}
              onClick={() =>
                void downloadCsv(
                  "reports/production-time-by-area",
                  "production-time-by-area.csv",
                  { from, to },
                )
              }
            >
              Tiempos por área (CSV)
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() =>
                void downloadCsv(
                  "reports/tinta-consumption-by-client",
                  "tinta-consumption-by-client.csv",
                  { from, to },
                )
              }
            >
              Consumo tintas por cliente (CSV)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="mermas" className="mt-4 space-y-4">
          <p className="text-muted-foreground text-sm">
            Desperdicio filtrable por fechas y opcionalmente cliente/producto.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label>Cliente (ID opcional)</Label>
              <Input
                inputMode="numeric"
                value={clientId}
                onChange={(ev) => setClientId(ev.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="grid gap-2">
              <Label>Producto (ID opcional)</Label>
              <Input
                inputMode="numeric"
                value={productId}
                onChange={(ev) => setProductId(ev.target.value)}
                placeholder="opcional"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() =>
                void downloadCsv("reports/scrap-by-filters", "scrap-by-filters.csv", {
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
              Mermas (CSV)
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
              <Label>Orden de trabajo (ID)</Label>
              <Input
                inputMode="numeric"
                value={woId}
                onChange={(ev) => setWoId(ev.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={loading || !woId.trim()}
              onClick={() =>
                void downloadCsv(
                  "reports/work-order-material-summary",
                  `work-order-material-summary-${woId}.csv`,
                  { work_order_id: Number(woId) },
                )
              }
            >
              Resumen OT (CSV)
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
