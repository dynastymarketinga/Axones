"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Trash2, UserPlus } from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, MaterialRow, ProductRecord } from "@/types/api"
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
import { cn } from "@/lib/utils"

type LineDraft = {
  key: string
  product_id: string
  material_id: string
  quantity: string
  unit: string
  description: string
}

function newLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    product_id: "",
    material_id: "",
    quantity: "1",
    unit: "kg",
    description: "",
  }
}

const SELECT_NONE = "0"

export default function ClientOrderNewPage() {
  const nav = useNavigate()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])

  const [clientId, setClientId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<LineDraft[]>([newLine()])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cl, mat, pr] = await Promise.all([
        apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 200, page: 1 },
        }),
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { inventory_area: "material", per_page: 300, page: 1 },
        }),
        apiFetch<LaravelPaginated<ProductRecord>>("products", {
          query: { per_page: 200, page: 1 },
        }),
      ])
      setClients(cl.data ?? [])
      setMaterials(mat.data ?? [])
      setProducts(pr.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar clientes, materiales o productos.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])

  const productsForClient = useMemo(() => {
    const cid = clientId ? Number(clientId) : null
    if (!cid) return products
    return products.filter((p) => p.client_id == null || p.client_id === cid)
  }, [clientId, products])

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === clientId) ?? null,
    [clientId, clients],
  )

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()])
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cid = Number(clientId)
    if (!Number.isFinite(cid) || cid < 1) {
      toast.error("Seleccione el cliente que encarga la orden (no hay valor predefinido: elija uno de la lista).")
      return
    }

    const payloadLines = lines
      .map((r) => {
        const product_id = r.product_id ? Number(r.product_id) : null
        const material_id = r.material_id ? Number(r.material_id) : null
        const quantity = (r.quantity || "").trim() || "0"
        return {
          product_id: product_id && product_id > 0 ? product_id : null,
          material_id: material_id && material_id > 0 ? material_id : null,
          quantity,
          unit: (r.unit || "kg").trim() || "kg",
          description: r.description.trim() || null,
        }
      })
      .filter(
        (l) =>
          (l.product_id != null && l.product_id > 0) ||
          (l.material_id != null && l.material_id > 0) ||
          (l.description && l.description.length > 0),
      )

    if (payloadLines.length === 0) {
      toast.error("Agregue al menos una línea con producto, material o descripción.")
      return
    }

    for (const l of payloadLines) {
      if (Number(l.quantity) <= 0) {
        toast.error("Cada línea con cantidad debe ser mayor a cero.")
        return
      }
    }

    setSaving(true)
    try {
      const res = await apiFetch<{ id: number; code: string }>("client-orders", {
        method: "POST",
        body: JSON.stringify({
          client_id: cid,
          notes: notes.trim() || null,
          lines: payloadLines,
        }),
      })
      toast.success(`Orden de cliente ${res.code ?? ""} creada.`.trim())
      nav("/axones/ordenes-cliente")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar la orden de cliente.")
    } finally {
      setSaving(false)
    }
  }

  const newClientLink = {
    pathname: "/axones/clientes/form" as const,
    state: { from: "/axones/ordenes-cliente/nueva" as const },
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground text-sm">Cargando clientes y materiales…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">Nueva orden de cliente</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Elija <span className="text-foreground font-medium">el cliente</span> y defina las{" "}
            <span className="text-foreground font-medium">líneas</span> del pedido: producto (datos maestros), material de
            inventario y/o descripción, con cantidad y unidad. Use las notas para referencias internas (entrega, contacto,
            etc.).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/axones/ordenes-cliente">Volver al listado</Link>
          </Button>
        </div>
      </div>

      <form
        onSubmit={(ev) => void submit(ev)}
        className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid w-full flex-1 gap-2 min-w-0 sm:max-w-xl">
              <Label htmlFor="co-cliente" className="text-foreground">
                Cliente que encarga la orden *
              </Label>
              <Select
                value={clientId || SELECT_NONE}
                onValueChange={(v) => setClientId(v === SELECT_NONE ? "" : v)}
                required
              >
                <SelectTrigger
                  id="co-cliente"
                  className={cn(
                    "h-11 w-full text-base",
                    "border-input bg-background text-foreground",
                    "focus:ring-2 focus:ring-ring",
                    (clientId || "") === "" && "text-muted-foreground",
                  )}
                >
                  <SelectValue placeholder="— Seleccione el cliente —" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={SELECT_NONE} className="text-muted-foreground">
                    — Seleccione el cliente —
                  </SelectItem>
                  {clients.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      No hay clientes. Registre uno con el botón de abajo.
                    </div>
                  ) : (
                    clients.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={String(c.id)}
                        className="text-foreground"
                        textValue={`${c.name} ${c.rif ?? ""}`}
                      >
                        {c.rif ? `${c.name} · ${c.rif}` : c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="secondary" asChild className="shrink-0">
              <Link to={newClientLink.pathname} state={newClientLink.state}>
                <UserPlus className="mr-2 h-4 w-4" />
                Nuevo cliente
              </Link>
            </Button>
          </div>

          {selectedClient ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Resumen (datos maestros)</p>
              <p className="text-foreground mt-1">
                <span className="font-semibold">{selectedClient.name}</span>
                {selectedClient.rif ? <span> · {selectedClient.rif}</span> : null}
                {selectedClient.city || selectedClient.state ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {[selectedClient.city, selectedClient.state].filter(Boolean).join(", ")}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="co-notes">Notas (opcional)</Label>
          <Textarea
            id="co-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="resize-y bg-background"
            placeholder="Referencia interna, fecha de entrega deseada, contacto, etc."
          />
        </div>

        <div className="space-y-3 border-t pt-6">
          <div>
            <h2 className="text-base font-semibold">Líneas de la solicitud *</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Cada línea es un renglón del pedido. Puede mezclar <span className="text-foreground">producto</span>,{" "}
              <span className="text-foreground">material</span> o solo <span className="text-foreground">descripción</span>;
              indique al menos un dato y una cantidad válida por línea.
            </p>
          </div>

          {lines.map((row, i) => (
            <div
              key={row.key}
              className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2"
            >
              <div className="grid gap-2 sm:col-span-2">
                <Label>Producto (maestro, opcional)</Label>
                <Select
                  value={row.product_id || SELECT_NONE}
                  onValueChange={(v) => updateLine(i, { product_id: v === SELECT_NONE ? "" : v })}
                >
                  <SelectTrigger className="h-11 bg-background text-foreground">
                    <SelectValue placeholder="Sin producto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE}>Sin producto</SelectItem>
                    {productsForClient.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Material (inventario)</Label>
                <Select
                  value={row.material_id || SELECT_NONE}
                  onValueChange={(v) => updateLine(i, { material_id: v === SELECT_NONE ? "" : v })}
                >
                  <SelectTrigger className="h-11 bg-background text-foreground">
                    <SelectValue placeholder="Sin material" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value={SELECT_NONE}>Sin material</SelectItem>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.sku} — {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Cantidad *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  className="h-11 bg-background"
                  value={row.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Unidad</Label>
                <Input
                  className="h-11 bg-background"
                  value={row.unit}
                  onChange={(e) => updateLine(i, { unit: e.target.value })}
                  placeholder="kg"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Descripción (solo si no usa producto ni material)</Label>
                <Input
                  className="h-11 bg-background"
                  value={row.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                  placeholder="Servicio u otra descripción"
                />
              </div>
              <div className="flex sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 1}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Quitar línea
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" />
            Añadir línea
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-2">
          <Button type="submit" size="lg" disabled={saving} className="min-w-40">
            {saving ? "Guardando…" : "Guardar orden de cliente"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/axones/ordenes-cliente">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
