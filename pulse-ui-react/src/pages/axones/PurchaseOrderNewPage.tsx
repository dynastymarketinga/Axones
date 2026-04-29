"use client"

import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow, SupplierRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PoLineDraft = {
  description: string
  material_id: string
  quantity_ordered: string
  unit: string
}

const emptyLine = (): PoLineDraft => ({
  description: "",
  material_id: "",
  quantity_ordered: "",
  unit: "kg",
})

export default function PurchaseOrderNewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [saving, setSaving] = useState(false)

  const [supplierId, setSupplierId] = useState("")
  const [code, setCode] = useState("")
  const [status, setStatus] = useState<string>("open")
  const [orderedAt, setOrderedAt] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<PoLineDraft[]>([emptyLine()])

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/ordenes-compra"
  }, [location.state])

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const [supRes, matRes] = await Promise.all([
          apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
            query: { per_page: 100, page: 1 },
          }),
          apiFetch<LaravelPaginated<MaterialRow>>("materials", {
            query: { per_page: 200, page: 1 },
          }),
        ])
        if (!c) {
          setSuppliers(supRes.data)
          setMaterials(matRes.data)
        }
      } catch {
        if (!c) {
          setSuppliers([])
          setMaterials([])
        }
      }
    })()
    return () => {
      c = true
    }
  }, [])

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function updateLine(i: number, patch: Partial<PoLineDraft>) {
    setLines((prev) =>
      prev.map((row, j) => (j === i ? { ...row, ...patch } : row)),
    )
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, j) => j !== i))
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const sid = Number(supplierId)
    if (!Number.isFinite(sid) || sid < 1) {
      toast.error("Seleccione un proveedor.")
      return
    }
    if (!code.trim()) {
      toast.error("Indique el código de la OC.")
      return
    }
    const payloadLines = lines
      .map((L) => ({
        description: L.description.trim() || null,
        material_id:
          L.material_id && L.material_id !== "none"
            ? Number(L.material_id)
            : null,
        quantity_ordered: Number(L.quantity_ordered),
        unit: L.unit.trim() || "kg",
      }))
      .filter((L) => Number.isFinite(L.quantity_ordered) && L.quantity_ordered > 0)

    if (!payloadLines.length) {
      toast.error("Agregue al menos una línea con cantidad válida.")
      return
    }

    setSaving(true)
    try {
      await apiFetch("purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: sid,
          code: code.trim(),
          status: status || undefined,
          ordered_at: orderedAt || null,
          notes: notes.trim() || null,
          lines: payloadLines,
        }),
      })
      toast.success("Orden de compra creada.")
      navigate(returnTo)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la OC.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nueva orden de compra
          </h1>
          <p className="text-muted-foreground text-sm">
            Indique proveedor, líneas y condiciones de la compra.
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to={returnTo}>Volver al listado</Link>
        </Button>
      </div>

      <form
        onSubmit={(ev) => void submit(ev)}
        className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Proveedor *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione…" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="po-code">Código único *</Label>
            <Input
              id="po-code"
              value={code}
              onChange={(ev) => setCode(ev.target.value)}
              placeholder="ej. OC-2026-001"
            />
          </div>
          <div className="grid gap-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">open</SelectItem>
                <SelectItem value="partial">partial</SelectItem>
                <SelectItem value="completed">completed</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="po-date">Fecha pedido</Label>
            <Input
              id="po-date"
              type="date"
              value={orderedAt}
              onChange={(ev) => setOrderedAt(ev.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="po-notes">Notas</Label>
          <Textarea
            id="po-notes"
            rows={2}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Líneas</h2>
            <Button type="button" size="sm" variant="secondary" onClick={addLine}>
              Añadir línea
            </Button>
          </div>
          <div className="space-y-4">
            {lines.map((line, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-xl border p-4 md:grid-cols-12 md:items-end"
              >
                <div className="md:col-span-4 grid gap-2">
                  <Label className="text-xs">Material</Label>
                  <Select
                    value={line.material_id || "none"}
                    onValueChange={(v) =>
                      updateLine(i, { material_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin material vinculado</SelectItem>
                      {materials.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.sku} — {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 grid gap-2">
                  <Label className="text-xs">Cantidad pedida *</Label>
                  <Input
                    inputMode="decimal"
                    value={line.quantity_ordered}
                    onChange={(ev) =>
                      updateLine(i, { quantity_ordered: ev.target.value })
                    }
                  />
                </div>
                <div className="md:col-span-2 grid gap-2">
                  <Label className="text-xs">Unidad</Label>
                  <Input
                    value={line.unit}
                    onChange={(ev) => updateLine(i, { unit: ev.target.value })}
                  />
                </div>
                <div className="md:col-span-2 grid gap-2">
                  <Label className="text-xs">Descripción</Label>
                  <Input
                    value={line.description}
                    onChange={(ev) =>
                      updateLine(i, { description: ev.target.value })
                    }
                  />
                </div>
                <div className="md:col-span-1 flex md:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={lines.length <= 1}
                    onClick={() => removeLine(i)}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Crear orden"}
        </Button>
      </form>
    </div>
  )
}
