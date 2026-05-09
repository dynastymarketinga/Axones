"use client"

import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiDownloadFile, apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const AREAS = [
  { value: "material", label: "Sustrato" },
  { value: "tintas", label: "Tintas" },
  { value: "quimicos", label: "Químicos" },
  { value: "miscelaneos", label: "Misceláneos" },
] as const

function MaterialsTable({ area }: { area: string }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<MaterialRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { inventory_area: area, per_page: 100, page: 1 },
      })
      setRows(data.data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("Error al cargar materiales.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [area])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
        Actualizar
      </Button>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Micras (u)</TableHead>
              <TableHead>Ancho (mm)</TableHead>
              <TableHead>Stock final</TableHead>
              <TableHead>Unidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Sin ítems en esta área.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.micras ?? "-"}</TableCell>
                  <TableCell>{m.ancho ?? "-"}</TableCell>
                  <TableCell>{m.quantity_on_hand}</TableCell>
                  <TableCell>{m.unit}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function MaterialsInventoryHubPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeArea, setActiveArea] = useState<(typeof AREAS)[number]["value"]>("material")
  const [reportDate, setReportDate] = useState(() => searchParams.get("date") ?? new Date().toISOString().slice(0, 10))
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    const areaFromQuery = searchParams.get("area")
    if (areaFromQuery && AREAS.some((a) => a.value === areaFromQuery)) {
      setActiveArea(areaFromQuery as (typeof AREAS)[number]["value"])
    }
  }, [searchParams])

  function openInventoryAreaPreview() {
    navigate(
      `/inventario-areas/vista-previa?date=${encodeURIComponent(reportDate)}&inventory_area=${encodeURIComponent(activeArea)}`,
    )
  }

  async function downloadInventoryAreaPdf() {
    setReportLoading(true)
    try {
      await apiDownloadFile("reports/inventory-area-daily.pdf", {
        query: { date: reportDate, inventory_area: activeArea },
        fallbackName: `inventory-area-daily-${activeArea}-${reportDate}.pdf`,
      })
      toast.success("PDF generado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar el PDF.")
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Inventario por área
        </h1>
        <p className="text-muted-foreground text-sm">
          Las áreas de inventario principales en una sola pantalla (pestañas). Solo insumos; el producto terminado no se gestiona aquí (sale de Corte hacia Despacho).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Fecha de corte</span>
          <Input
            type="date"
            value={reportDate}
            onChange={(ev) => setReportDate(ev.target.value)}
            className="w-[180px]"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={reportLoading}
          onClick={openInventoryAreaPreview}
        >
          Vista previa
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={reportLoading}
          onClick={() => void downloadInventoryAreaPdf()}
        >
          Generar PDF
        </Button>
      </div>

      <Tabs
        defaultValue="material"
        value={activeArea}
        onValueChange={(value) => setActiveArea(value as (typeof AREAS)[number]["value"])}
        className="w-full"
      >
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {AREAS.map((a) => (
            <TabsTrigger key={a.value} value={a.value} className="text-xs sm:text-sm">
              {a.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {AREAS.map((a) => (
          <TabsContent key={a.value} value={a.value} className="mt-4">
            <MaterialsTable area={a.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
