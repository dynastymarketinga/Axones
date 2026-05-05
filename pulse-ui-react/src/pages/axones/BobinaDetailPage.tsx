"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { PageLoadingBlock } from "@/components/axones/LoadingStates"

type BobinaDetail = {
  id: number
  material_id: number
  code: string
  weight_kg: string
  status: string
  inventory_return_id?: number | null
  material?: MaterialRow
  inventory_return?: { work_order_id?: number | null } | null
  can_edit_structural?: boolean
}

function statusLabel(status: string): string {
  if (status === "available") return "Disponible"
  if (status === "issued") return "Despachada"
  if (status === "consumed") return "Consumida"
  if (status === "rejected") return "Rechazada"
  return status
}

export default function BobinaDetailPage() {
  const { bobinaId } = useParams<{ bobinaId: string }>()
  const id = bobinaId ? Number(bobinaId) : NaN
  const valid = Number.isFinite(id) && id > 0

  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState<BobinaDetail | null>(null)

  const load = useCallback(async () => {
    if (!valid) return
    setLoading(true)
    try {
      const data = await apiFetch<BobinaDetail>(`bobinas/${id}`)
      setRow(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la bobina.")
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [id, valid])

  useEffect(() => {
    void load()
  }, [load])

  if (!valid) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <p className="text-muted-foreground text-sm">Identificador de bobina no válido.</p>
        <Button variant="outline" asChild>
          <Link to="/bobinas">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bobina #{id}</h1>
          <p className="text-muted-foreground text-sm">Detalle y trazabilidad.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/bobinas">Volver al listado</Link>
          </Button>
          {row ? (
            <Button size="sm" asChild>
              <Link to={`/bobinas/${id}/editar`}>Editar</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <PageLoadingBlock />
      ) : !row ? (
        <p className="text-muted-foreground text-sm">No se encontró la bobina.</p>
      ) : (
        <div className="bg-card border rounded-2xl shadow-sm p-4 md:p-6 space-y-4 max-w-xl">
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Código</span>
            <span className="font-mono text-sm">{row.code}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Material</span>
            <span className="text-sm">
              {row.material ? `${row.material.sku} · ${row.material.name}` : `ID ${row.material_id}`}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Proveedor (material)</span>
            <span className="text-sm text-muted-foreground">
              {row.material?.supplier?.name?.trim() ? row.material.supplier.name : "—"}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Estado</span>
            <span className="text-sm">{statusLabel(row.status)}</span>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-xs">
              <li>Disponible: en almacén, sin despacho a producción.</li>
              <li>Despachada: enviada o asignada a producción / solicitud.</li>
              <li>Consumida: ya consumida en producción.</li>
              <li>Rechazada: no conforme; suele asociarse a devolución aceptada.</li>
            </ul>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Peso (kg)</span>
            <span className="text-sm">{row.weight_kg}</span>
          </div>
          {row.inventory_return?.work_order_id != null ? (
            <div className="grid gap-1">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">OT (devolución)</span>
              <span className="text-sm">#{row.inventory_return.work_order_id}</span>
            </div>
          ) : null}
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Edición estructural</span>
            <span className="text-sm">
              {row.can_edit_structural
                ? "Permitida (material, código y peso si aplica)."
                : "No permitida: despacho, producción o bobina rechazada."}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
