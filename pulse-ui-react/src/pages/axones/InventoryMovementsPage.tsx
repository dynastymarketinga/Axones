"use client"

import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiDownloadFile, apiFetch, ApiError } from "@/lib/api"
import type { InventoryMovementRow, LaravelPaginated } from "@/types/api"
import { AxonesInventoryModuleNav } from "@/components/axones/inventory-page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const MOVEMENT_TYPES = ["in", "out", "adjustment_add", "adjustment_sub"]
const REFERENCE_TYPES = [
  "purchase_receipt",
  "miscellaneous_receipt",
  "material_request",
  "inventory_return",
  "inventory_adjustment",
]
const AREAS = [
  "material",
  "tintas",
  "cementerio_tintas",
  "quimicos",
  "bobinas_rechazadas",
  "miscelaneos",
]

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export default function InventoryMovementsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [from, setFrom] = useState(() => searchParams.get("from") ?? defaultFrom())
  const [to, setTo] = useState(() => searchParams.get("to") ?? new Date().toISOString().slice(0, 10))
  const [movementType, setMovementType] = useState<string>(() => searchParams.get("movement_type") ?? "all")
  const [inventoryArea, setInventoryArea] = useState<string>(() => searchParams.get("inventory_area") ?? "all")
  const [referenceType, setReferenceType] = useState<string>(() => searchParams.get("reference_type") ?? "all")
  const [invalidOnly, setInvalidOnly] = useState<string>(() => (searchParams.get("invalid_only") === "1" ? "invalid" : "all"))
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [rows, setRows] = useState<LaravelPaginated<InventoryMovementRow> | null>(
    null,
  )
  const [summary, setSummary] = useState<{
    entries_total: string
    exits_total: string
    adjustment_total: string
    adjustment_percent: string
    invalid_reference_count: number
  } | null>(null)
  const [topMaterials, setTopMaterials] = useState<
    Array<{ material_id: number | null; sku: string; name: string; total_qty: string; unit: string }>
  >([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const query = {
        from,
        to,
        page,
        per_page: 50,
        movement_type: movementType !== "all" ? movementType : undefined,
        inventory_area: inventoryArea !== "all" ? inventoryArea : undefined,
        reference_type: referenceType !== "all" ? referenceType : undefined,
        invalid_only: invalidOnly === "invalid" ? 1 : undefined,
      }
      const [data, report] = await Promise.all([
        apiFetch<LaravelPaginated<InventoryMovementRow>>("inventory-movements", { query }),
        apiFetch<{
          summary: {
            entries_total: string
            exits_total: string
            adjustment_total: string
            adjustment_percent: string
            invalid_reference_count: number
          }
          top_materials: Array<{ material_id: number | null; sku: string; name: string; total_qty: string; unit: string }>
        }>("reports/inventory-movements-general", {
          query: {
            from,
            to,
            movement_type: movementType !== "all" ? movementType : undefined,
            inventory_area: inventoryArea !== "all" ? inventoryArea : undefined,
            reference_type: referenceType !== "all" ? referenceType : undefined,
            invalid_only: invalidOnly === "invalid" ? 1 : undefined,
          },
        }),
      ])
      setRows(data)
      setSummary(report.summary)
      setTopMaterials(report.top_materials ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar los movimientos.")
      setRows(null)
      setSummary(null)
      setTopMaterials([])
    } finally {
      setLoading(false)
    }
  }, [from, to, page, movementType, inventoryArea, referenceType, invalidOnly])

  async function downloadMovementsPdf() {
    setReportLoading(true)
    try {
      await apiDownloadFile("reports/inventory-movements-general.pdf", {
        query: {
          from,
          to,
          movement_type: movementType !== "all" ? movementType : undefined,
          inventory_area: inventoryArea !== "all" ? inventoryArea : undefined,
          reference_type: referenceType !== "all" ? referenceType : undefined,
          invalid_only: invalidOnly === "invalid" ? 1 : undefined,
        },
        fallbackName: `inventory-movements-general-${from}-${to}.pdf`,
      })
      toast.success("PDF generado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar el PDF.")
    } finally {
      setReportLoading(false)
    }
  }

  function openPreview() {
    const params = new URLSearchParams({
      from,
      to,
    })
    if (movementType !== "all") params.set("movement_type", movementType)
    if (inventoryArea !== "all") params.set("inventory_area", inventoryArea)
    if (referenceType !== "all") params.set("reference_type", referenceType)
    if (invalidOnly === "invalid") params.set("invalid_only", "1")
    navigate(`/movimientos-inventario/vista-previa?${params.toString()}`)
  }

  const adjustmentPercentNumber = Number(summary?.adjustment_percent ?? "0")
  const adjustmentAlertClass =
    adjustmentPercentNumber > 20
      ? "border-red-300 bg-red-50/60"
      : adjustmentPercentNumber > 10
        ? "border-amber-300 bg-amber-50/60"
        : "border-emerald-300 bg-emerald-50/60"

  const movementTypeLabel: Record<string, string> = {
    in: "Entrada",
    out: "Salida",
    adjustment_add: "Ajuste +",
    adjustment_sub: "Ajuste -",
  }

  const referenceTypeLabel: Record<string, string> = {
    purchase_receipt: "Recepción",
    miscellaneous_receipt: "Ingreso misceláneo",
    material_request: "Despacho / solicitud",
    inventory_return: "Devolución",
    inventory_adjustment: "Ajuste",
  }

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Movimientos generales
        </h1>
        <p className="text-muted-foreground text-sm">
          Historial general de inventario: recepciones, despachos y movimientos internos.
        </p>
      </div>

      <AxonesInventoryModuleNav active="movimientos-inventario" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div className="grid gap-2">
          <Label>Desde</Label>
          <Input
            type="date"
            value={from}
            onChange={(ev) => {
              setFrom(ev.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={to}
            onChange={(ev) => {
              setTo(ev.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Tipo</Label>
          <Select
            value={movementType}
            onValueChange={(v) => {
              setMovementType(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MOVEMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Área inventario</Label>
          <Select
            value={inventoryArea}
            onValueChange={(v) => {
              setInventoryArea(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Origen</Label>
          <Select
            value={referenceType}
            onValueChange={(v) => {
              setReferenceType(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {REFERENCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {referenceTypeLabel[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={() => void load()}>
            Aplicar
          </Button>
        </div>
        <div className="grid gap-2">
          <Label>Auditoría</Label>
          <Select
            value={invalidOnly}
            onValueChange={(v) => {
              setInvalidOnly(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="invalid">Solo inválidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={openPreview} disabled={loading}>
          Vista previa
        </Button>
        <Button type="button" variant="outline" onClick={() => void downloadMovementsPdf()} disabled={loading || reportLoading}>
          {reportLoading ? "Generando PDF..." : "Generar PDF"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Leyenda de riesgo (% Ajustes)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
            Verde: hasta 10%
          </Badge>
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
            Amarillo: mayor a 10%
          </Badge>
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">
            Rojo: mayor a 20%
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Entradas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.entries_total ?? "0.000"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Salidas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.exits_total ?? "0.000"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ajustes manuales</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.adjustment_total ?? "0.000"}</CardContent>
        </Card>
        <Card className={adjustmentAlertClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">% Ajustes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.adjustment_percent ?? "0.00"}%</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sin referencia válida</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.invalid_reference_count ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top materiales más movidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!topMaterials.length ? (
            <p className="text-muted-foreground">Sin datos en el rango seleccionado.</p>
          ) : (
            topMaterials.slice(0, 5).map((item, index) => (
              <div key={`${item.material_id ?? "none"}-${index}`} className="flex items-center justify-between border-b pb-1 last:border-b-0">
                <span className="truncate pr-3">{item.sku} · {item.name}</span>
                <span className="font-medium whitespace-nowrap">{item.total_qty} {item.unit}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Ref.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows?.data.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Sin movimientos en el rango.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((m) => (
                <TableRow key={m.id} className={m.is_invalid_reference ? "bg-red-50/40" : undefined}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {m.occurred_at?.replace("T", " ").slice(0, 19)}
                  </TableCell>
                  <TableCell>{movementTypeLabel[m.movement_type] ?? m.movement_type}</TableCell>
                  <TableCell>
                    {m.material
                      ? `${m.material.sku} · ${m.material.name}`
                      : "—"}
                  </TableCell>
                  <TableCell>{m.material?.inventory_area ?? "—"}</TableCell>
                  <TableCell>
                    {m.quantity} {m.material?.unit ?? ""}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate text-sm"
                        title={m.reason ?? undefined}
                      >
                        {m.reason ?? "—"}
                      </span>
                      {m.is_manual_adjustment ? (
                        <Badge variant="outline">Ajuste manual</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{m.user?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {m.reference_type && m.reference_id != null
                      ? `${referenceTypeLabel[m.reference_type] ?? m.reference_type} #${m.reference_id}`
                      : "—"}
                    {m.is_invalid_reference ? (
                      <Badge variant="destructive" className="ml-2">
                        Inválida
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {rows && rows.last_page > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {rows.current_page} de {rows.last_page} · {rows.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.current_page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.current_page >= rows.last_page || loading}
              onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
