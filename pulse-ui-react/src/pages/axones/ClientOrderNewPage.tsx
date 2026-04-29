"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Check, ChevronsUpDown, Plus, Trash2, UserPlus } from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  quantity: string
}

function newLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    product_id: "",
    quantity: "1",
  }
}

const SELECT_NONE = "0"

export default function ClientOrderNewPage() {
  const nav = useNavigate()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])

  const [clientId, setClientId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<LineDraft[]>([newLine()])
  const [productComboOpenKey, setProductComboOpenKey] = useState<string | null>(null)
  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [createProductSaving, setCreateProductSaving] = useState(false)
  const [createProductLineKey, setCreateProductLineKey] = useState<string | null>(null)
  const [newProductName, setNewProductName] = useState("")
  const [newProductCpe, setNewProductCpe] = useState("")
  const [newProductMps, setNewProductMps] = useState("")
  const [newProductBarcode, setNewProductBarcode] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cl, pr] = await Promise.all([
        apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 200, page: 1 },
        }),
        apiFetch<LaravelPaginated<ProductRecord>>("products", {
          query: { per_page: 200, page: 1 },
        }),
      ])
      setClients(cl.data ?? [])
      setProducts(pr.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar clientes o productos.")
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

  const selectedProductByLineKey = useMemo(() => {
    const map = new Map<string, ProductRecord | null>()
    for (const row of lines) {
      const pid = row.product_id ? Number(row.product_id) : null
      const product = pid ? products.find((p) => p.id === pid) ?? null : null
      map.set(row.key, product)
    }
    return map
  }, [lines, products])

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()])
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))
  }

  function openCreateProductModal(lineKey: string | null = null) {
    setCreateProductLineKey(lineKey)
    setNewProductName("")
    setNewProductCpe("")
    setNewProductMps("")
    setNewProductBarcode("")
    setCreateProductOpen(true)
  }

  async function submitQuickProduct(e: React.FormEvent) {
    e.preventDefault()
    const name = newProductName.trim()
    if (!name) {
      toast.error("El nombre del producto es obligatorio.")
      return
    }
    setCreateProductSaving(true)
    try {
      const cid = clientId ? Number(clientId) : null
      const created = await apiFetch<ProductRecord>("products", {
        method: "POST",
        body: JSON.stringify({
          name,
          client_id: Number.isFinite(cid) && (cid ?? 0) > 0 ? cid : null,
          cpe: newProductCpe.trim() || null,
          mps: newProductMps.trim() || null,
          barcode: newProductBarcode.trim() || null,
        }),
      })
      setProducts((prev) => [created, ...prev])
      if (createProductLineKey) {
        setLines((prev) => prev.map((line) => (line.key === createProductLineKey ? { ...line, product_id: String(created.id) } : line)))
      }
      setCreateProductOpen(false)
      toast.success("Producto creado y seleccionado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear el producto.")
    } finally {
      setCreateProductSaving(false)
    }
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
        const quantity = (r.quantity || "").trim() || "0"
        return {
          product_id: product_id && product_id > 0 ? product_id : null,
          quantity,
        }
      })
      .filter((l) => l.product_id != null && l.product_id > 0)

    if (payloadLines.length === 0) {
      toast.error("Agregue al menos una línea con producto seleccionado.")
      return
    }

    for (const l of payloadLines) {
      if (Number(l.quantity) <= 0) {
        toast.error("Cada línea debe tener una cantidad a solicitar mayor a cero.")
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
      toast.success(`Pedido del cliente ${res.code ?? ""} creado.`.trim())
      nav("/ordenes-cliente")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar el pedido del cliente.")
    } finally {
      setSaving(false)
    }
  }

  const newClientLink = {
    pathname: "/clientes/form" as const,
    state: { from: "/ordenes-cliente/nueva" as const },
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground text-sm">Cargando clientes y productos…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo pedido del cliente</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/ordenes-cliente">Volver al listado</Link>
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
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              onClick={() => openCreateProductModal(null)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo producto
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
          <h2 className="text-base font-semibold">Líneas de la solicitud *</h2>

          {lines.map((row, i) => (
            <div
              key={row.key}
              className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2"
            >
              <div className="grid gap-2 sm:col-span-2">
                <Label>Producto</Label>
                <Popover open={productComboOpenKey === row.key} onOpenChange={(open) => setProductComboOpenKey(open ? row.key : null)}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={productComboOpenKey === row.key}
                      className="h-11 w-full justify-between bg-background text-foreground font-normal"
                    >
                      <span className="truncate text-left">
                        {selectedProductByLineKey.get(row.key)?.name ?? "Seleccione un producto"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[18rem]" align="start">
                    <Command shouldFilter>
                      <CommandInput placeholder="Buscar por nombre, C.P.E. o barra…" />
                      <CommandList>
                        <CommandEmpty>
                          <div className="space-y-2 p-2 text-sm">
                            <p>No hay productos que coincidan.</p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setProductComboOpenKey(null)
                                openCreateProductModal(row.key)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Crear producto
                            </Button>
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="sin-producto"
                            onSelect={() => {
                              updateLine(i, { product_id: "" })
                              setProductComboOpenKey(null)
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", row.product_id ? "opacity-0" : "opacity-100")} />
                            Sin producto
                          </CommandItem>
                          {productsForClient.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.cpe ?? ""} ${p.barcode ?? ""}`}
                              onSelect={() => {
                                updateLine(i, { product_id: String(p.id) })
                                setProductComboOpenKey(null)
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", row.product_id === String(p.id) ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{p.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>C.P.E.</Label>
                  <Input value={selectedProductByLineKey.get(row.key)?.cpe ?? ""} readOnly className="h-11 bg-background" placeholder="Dato maestro" />
                </div>
                <div className="grid gap-2">
                  <Label>M.P.P.S.</Label>
                  <Input value={selectedProductByLineKey.get(row.key)?.mps ?? ""} readOnly className="h-11 bg-background" placeholder="Dato maestro" />
                </div>
                <div className="grid gap-2">
                  <Label>Cod. barra</Label>
                  <Input value={selectedProductByLineKey.get(row.key)?.barcode ?? ""} readOnly className="h-11 bg-background" placeholder="Dato maestro" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Cantidad a solicitar *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  className="h-11 bg-background"
                  value={row.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
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
            {saving ? "Guardando…" : "Guardar pedido del cliente"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/ordenes-cliente">Cancelar</Link>
          </Button>
        </div>
      </form>

      <Dialog open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>Creación rápida desde pedido del cliente.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(ev) => void submitQuickProduct(ev)} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="quick-product-name">Nombre *</Label>
              <Input id="quick-product-name" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quick-product-client">Cliente</Label>
              <Input
                id="quick-product-client"
                value={selectedClient ? `${selectedClient.name}${selectedClient.rif ? ` · ${selectedClient.rif}` : ""}` : "Sin cliente"}
                readOnly
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="quick-product-cpe">C.P.E.</Label>
                <Input id="quick-product-cpe" value={newProductCpe} onChange={(e) => setNewProductCpe(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quick-product-mps">M.P.P.S.</Label>
                <Input id="quick-product-mps" value={newProductMps} onChange={(e) => setNewProductMps(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quick-product-barcode">Cod. barra</Label>
                <Input id="quick-product-barcode" value={newProductBarcode} onChange={(e) => setNewProductBarcode(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateProductOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createProductSaving}>
                {createProductSaving ? "Creando…" : "Crear producto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
