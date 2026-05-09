"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import { apiFetch, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CorteDispatchRow = {
  corte_bobina_usage_id?: number
  work_order_id?: number
  work_order_code?: string
  client_name?: string
  product_id?: number
  product_name?: string
  product_cpe?: string
  material_sku?: string
  quantity_finished_kg?: string | number
  quantity_dispatched_kg?: string | number
  quantity_remaining_kg?: string | number
}

type DispatchSelectionItem = {
  corte_bobina_usage_id: number
  work_order_id: number
  work_order_code?: string
  client_name?: string
  product_id: number | null
  product_name?: string
  product_cpe?: string
  description: string
  quantity_finished_kg?: string
  quantity_dispatched_kg?: string
  quantity_remaining_kg?: string
  quantity_kg: string
  pallet_code: string
  bobbin_count: number
}

const DISPATCH_SELECTION_KEY = "axones.dispatch.selection.v1"

function formatKg(value: string | number | undefined): string {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN
  if (!Number.isFinite(parsed)) return "-"
  return `${parsed.toLocaleString("es-DO", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`
}

export default function CorteDispatchPage() {
  const navigate = useNavigate()
  const [wo, setWo] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CorteDispatchRow[]>([])
  const [selectedUsageIds, setSelectedUsageIds] = useState<Record<number, boolean>>(
    {},
  )
  const [page, setPage] = useState(1)
  const pageSize = 8

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const haystack = [
        r.work_order_code ?? (r.work_order_id ? `OT-${r.work_order_id}` : ""),
        r.client_name,
        r.product_name,
        r.product_cpe,
        r.material_sku,
      ]
        .filter((v) => v !== null && v !== undefined)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page])

  const selectedRows = useMemo(() => {
    return rows.filter(
      (r) =>
        r.corte_bobina_usage_id &&
        selectedUsageIds[r.corte_bobina_usage_id] &&
        Number(r.quantity_remaining_kg) > 0,
    )
  }, [rows, selectedUsageIds])

  const selectedTotalKg = useMemo(
    () =>
      selectedRows.reduce(
        (acc, r) => acc + (Number(r.quantity_remaining_kg) || 0),
        0,
      ),
    [selectedRows],
  )

  function toggleUsage(row: CorteDispatchRow, checked: boolean) {
    if (!row.corte_bobina_usage_id) return
    setSelectedUsageIds((prev) => ({ ...prev, [row.corte_bobina_usage_id!]: checked }))
  }

  function createSelectionPayload(): DispatchSelectionItem[] {
    return selectedRows
      .filter((r) => r.corte_bobina_usage_id && r.work_order_id)
      .map((r) => ({
        corte_bobina_usage_id: Number(r.corte_bobina_usage_id),
        work_order_id: Number(r.work_order_id),
        work_order_code: r.work_order_code ?? undefined,
        client_name: r.client_name ?? undefined,
        product_id: r.product_id ? Number(r.product_id) : null,
        product_name: r.product_name ?? undefined,
        product_cpe: r.product_cpe ?? undefined,
        description:
          [
            r.client_name ? `Cliente: ${r.client_name}` : null,
            [r.product_name, r.product_cpe].filter(Boolean).join(" · "),
          ]
            .filter(Boolean)
            .join(" | ") || "Línea de despacho",
        quantity_finished_kg: String(r.quantity_finished_kg ?? "0.000"),
        quantity_dispatched_kg: String(r.quantity_dispatched_kg ?? "0.000"),
        quantity_remaining_kg: String(r.quantity_remaining_kg ?? "0.000"),
        quantity_kg: String(r.quantity_remaining_kg ?? "0.000"),
        pallet_code: r.work_order_code ?? (r.work_order_id ? `OT-${r.work_order_id}` : ""),
        bobbin_count: 1,
      }))
      .filter((r) => Number(r.quantity_kg) > 0)
  }

  function proceedToNewNote() {
    const payload = createSelectionPayload()
    if (!payload.length) {
      toast.error("Seleccione al menos una paleta con saldo pendiente.")
      return
    }
    sessionStorage.setItem(DISPATCH_SELECTION_KEY, JSON.stringify(payload))
    navigate("/nota-entrega-nueva?source=despacho-corte")
  }

  useEffect(() => {
    setPage(1)
  }, [search, wo])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const wid = wo.trim() ? Number(wo) : NaN
      const data = await apiFetch<{
        rows: CorteDispatchRow[]
      }>(
        "corte-dispatch/available",
        {
          query: {
            work_order_id: Number.isFinite(wid) ? wid : undefined,
          },
        },
      )
      setRows(data.rows ?? [])
      setSelectedUsageIds({})
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el disponible para despacho.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [wo])

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Despacho · producto terminado
        </h1>
        <p className="text-muted-foreground text-sm">
          Material terminado pendiente de nota de entrega.
        </p>
        <p className="text-muted-foreground text-sm">
          Salida del área de Corte (kg declarados como terminados). Generar la nota o el PDF cierra la entrega y descuenta el saldo disponible.
        </p>
        <WorkOrderStageBadge current="despacho" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/prefill-nota-entrega")}
        >
          Vista previa de nota
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/nota-entrega-nueva")}
        >
          Nueva nota de entrega
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/notas-entrega")}
        >
          Historial de notas
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-40 gap-2">
          <Label htmlFor="cd-wo">ID de orden de trabajo (opcional)</Label>
          <Input
            id="cd-wo"
            inputMode="numeric"
            placeholder="Todos"
            value={wo}
            onChange={(ev) => setWo(ev.target.value)}
          />
        </div>
        <Button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "…" : "Consultar"}
        </Button>
        <div className="grid min-w-[260px] flex-1 gap-2">
          <Label htmlFor="cd-search">Buscar cliente/producto</Label>
          <Input
            id="cd-search"
            placeholder="Ej. Cliente demo o CPE-DEMO-0012"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <p className="text-sm">
          Seleccionadas: <span className="font-medium">{selectedRows.length}</span> OT(s)
          · Total:{" "}
          <span className="font-medium">
            {selectedTotalKg.toLocaleString("es-DO", {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{" "}
            kg
          </span>
        </p>
        <Button type="button" onClick={proceedToNewNote} disabled={!selectedRows.length}>
          Crear nota con seleccionadas
        </Button>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OT de producción</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Terminado</TableHead>
              <TableHead className="text-right">En notas</TableHead>
              <TableHead className="text-right">Disponible</TableHead>
              <TableHead className="text-right">Seleccionar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filteredRows.length ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={7}>
                  {loading
                    ? "Cargando…"
                    : rows.length
                      ? "Sin resultados para esa búsqueda."
                      : "Sin productos disponibles."}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((r, idx) => (
                <TableRow key={`row-${r.corte_bobina_usage_id ?? idx}`}>
                  <TableCell>
                    <div className="font-medium">
                      {r.work_order_code ?? r.work_order_id ?? "-"}
                    </div>
                  </TableCell>
                  <TableCell>{r.client_name ?? "-"}</TableCell>
                  <TableCell>
                    <div>{r.product_name ?? "Producto"}</div>
                    <div className="text-muted-foreground text-xs">
                      {r.product_cpe ?? "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatKg(r.quantity_finished_kg)}</TableCell>
                  <TableCell className="text-right">{formatKg(r.quantity_dispatched_kg)}</TableCell>
                  <TableCell className="text-right">{formatKg(r.quantity_remaining_kg)}</TableCell>
                  <TableCell className="text-right">
                    <input
                      type="checkbox"
                      checked={!!selectedUsageIds[r.corte_bobina_usage_id ?? -1]}
                      onChange={(ev) => toggleUsage(r, ev.target.checked)}
                      disabled={!r.corte_bobina_usage_id || Number(r.quantity_remaining_kg) <= 0}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Mostrando {(page - 1) * pageSize + (pagedRows.length ? 1 : 0)}-
          {(page - 1) * pageSize + pagedRows.length} de {filteredRows.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}
