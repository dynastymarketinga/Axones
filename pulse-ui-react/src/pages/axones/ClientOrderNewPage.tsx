"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Hash,
  Package,
  Plus,
  Scale,
  StickyNote,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
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
import { cn } from "@/lib/utils"
import {
  CLIENT_ORDER_MODULE_NEW_TITLE,
  CLIENT_ORDER_MODULE_TITLE,
} from "@/pages/axones/client-order-i18n"

type LineDraft = {
  key: string
  /** Puede ser un id numérico (`"123"`) o un id temporal (`"tmp-..."`). */
  product_id: string
  quantity: string
}

function newLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    product_id: "",
    quantity: "",
  }
}

type TempProduct = {
  tempId: string
  client_id: number
  name: string
  cpe: string | null
  mps: string | null
  created_at: string
}

/** Vista unificada de productos persistidos y temporales para el combobox y la búsqueda. */
type ProductOption = {
  id: string
  client_id: number
  name: string
  cpe: string | null
  mps: string | null
  isTemporary: boolean
  created_at?: string
}

type ClientOrderPostBody = {
  client_id: number
  notes: string
  /** Conserva el id en crudo (numérico o `tmp-...`) para resolver al confirmar. */
  lines: { product_id_raw: string; quantity: string }[]
}

type ConfirmSummaryLine = {
  productName: string
  cpe: string
  mps: string
  quantity: string
  isTemporary: boolean
}

type ConfirmSummary = {
  clientName: string
  clientRif?: string
  clientLocation?: string
  notes: string
  lines: ConfirmSummaryLine[]
}

export default function ClientOrderNewPage() {
  const nav = useNavigate()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [tempProducts, setTempProducts] = useState<TempProduct[]>([])

  const [clientId, setClientId] = useState<string>("")
  const [clientComboOpen, setClientComboOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<LineDraft[]>([newLine()])
  const [productComboOpenKey, setProductComboOpenKey] = useState<string | null>(null)
  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [createProductLineKey, setCreateProductLineKey] = useState<string | null>(null)
  const [newProductName, setNewProductName] = useState("")
  const [newProductCpe, setNewProductCpe] = useState("")
  const [newProductMps, setNewProductMps] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPost, setPendingPost] = useState<ClientOrderPostBody | null>(null)
  const [confirmSummary, setConfirmSummary] = useState<ConfirmSummary | null>(null)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

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

  const allProductOptions = useMemo<ProductOption[]>(() => {
    const tempOptions: ProductOption[] = tempProducts.map((t) => ({
      id: t.tempId,
      client_id: t.client_id,
      name: t.name,
      cpe: t.cpe,
      mps: t.mps,
      isTemporary: true,
      created_at: t.created_at,
    }))
    const realOptions: ProductOption[] = products.map((p) => ({
      id: String(p.id),
      client_id: p.client_id ?? 0,
      name: p.name,
      cpe: p.cpe ?? null,
      mps: p.mps ?? null,
      isTemporary: false,
      created_at: p.created_at,
    }))
    return [...tempOptions, ...realOptions]
  }, [tempProducts, products])

  useEffect(() => {
    const cid = clientId ? Number(clientId) : null
    if (!cid || !Number.isFinite(cid) || cid < 1) {
      setLines((prev) => prev.map((line) => ({ ...line, product_id: "" })))
      return
    }
    const allowedIds = new Set(
      allProductOptions.filter((p) => p.client_id === cid).map((p) => p.id),
    )
    setLines((prev) =>
      prev.map((line) => {
        if (!line.product_id) return line
        if (!allowedIds.has(line.product_id)) return { ...line, product_id: "" }
        return line
      }),
    )
  }, [clientId, allProductOptions])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])

  const productsForClient = useMemo<ProductOption[]>(() => {
    const cid = clientId ? Number(clientId) : null
    if (!cid) return []
    return allProductOptions.filter((p) => p.client_id === cid)
  }, [clientId, allProductOptions])

  // Auto-seleccionar el producto más reciente del cliente en la primera línea vacía.
  useEffect(() => {
    const cid = clientId ? Number(clientId) : null
    if (!cid) return
    if (productsForClient.length === 0) return
    const sorted = productsForClient
      .slice()
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    const newest = sorted[0]
    if (!newest) return
    setLines((prev) => {
      if (prev.length === 0) return prev
      if (prev[0].product_id) return prev
      return prev.map((line, idx) =>
        idx === 0 ? { ...line, product_id: newest.id } : line,
      )
    })
  }, [clientId, productsForClient])

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === clientId) ?? null,
    [clientId, clients],
  )

  const selectedProductByLineKey = useMemo(() => {
    const map = new Map<string, ProductOption | null>()
    for (const row of lines) {
      const product = row.product_id
        ? allProductOptions.find((p) => p.id === row.product_id) ?? null
        : null
      map.set(row.key, product)
    }
    return map
  }, [lines, allProductOptions])

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
    const cid = Number(clientId)
    if (!Number.isFinite(cid) || cid < 1) {
      toast.error("Seleccione primero el cliente para crear el producto.")
      return
    }
    setCreateProductLineKey(lineKey)
    setNewProductName("")
    setNewProductCpe("")
    setNewProductMps("")
    setCreateProductOpen(true)
  }

  function validateAndBuildPostBody(): ClientOrderPostBody | null {
    setAttemptedSubmit(true)
    const cid = Number(clientId)
    if (!Number.isFinite(cid) || cid < 1) {
      toast.error("Seleccione el cliente que encarga la orden.")
      return null
    }
    if (!notes.trim()) {
      toast.error("Las notas son obligatorias (referencia, fecha, contacto, etc.).")
      return null
    }

    const payloadLines = lines
      .map((r) => ({
        product_id_raw: r.product_id,
        quantity: (r.quantity || "").trim(),
      }))
      .filter((l) => l.product_id_raw && l.product_id_raw.length > 0)

    if (payloadLines.length === 0) {
      toast.error("Agregue al menos una línea con producto seleccionado.")
      return null
    }

    for (const l of payloadLines) {
      if (!l.quantity || Number(l.quantity) <= 0) {
        toast.error("Cada línea debe tener una cantidad a solicitar mayor a cero.")
        return null
      }
    }

    const allowedIds = new Set(
      allProductOptions.filter((p) => p.client_id === cid).map((p) => p.id),
    )
    for (const l of payloadLines) {
      if (!allowedIds.has(l.product_id_raw)) {
        toast.error("Hay productos que no pertenecen al cliente seleccionado. Revise las líneas.")
        return null
      }
    }

    return {
      client_id: cid,
      notes: notes.trim(),
      lines: payloadLines,
    }
  }

  function openApproveConfirm() {
    const body = validateAndBuildPostBody()
    if (!body) return
    const client = clients.find((c) => c.id === body.client_id)
    const loc = [client?.city, client?.state].filter(Boolean).join(", ")
    const summary: ConfirmSummary = {
      clientName: client?.name ?? "",
      clientRif: client?.rif?.trim() ? client.rif.trim() : undefined,
      clientLocation: loc || undefined,
      notes: body.notes,
      lines: body.lines.map((l) => {
        const p = allProductOptions.find((pr) => pr.id === l.product_id_raw)
        return {
          productName: p?.name ?? `Producto ${l.product_id_raw}`,
          cpe: (p?.cpe ?? "").trim() || "—",
          mps: (p?.mps ?? "").trim() || "—",
          quantity: l.quantity,
          isTemporary: p?.isTemporary ?? false,
        }
      }),
    }
    setPendingPost(body)
    setConfirmSummary(summary)
    setConfirmOpen(true)
  }

  function submitQuickProduct(e: React.FormEvent) {
    e.preventDefault()
    const name = newProductName.trim()
    if (!name) {
      toast.error("El nombre del producto es obligatorio.")
      return
    }
    const cid = clientId ? Number(clientId) : null
    if (!Number.isFinite(cid) || (cid ?? 0) < 1) {
      toast.error("Seleccione primero el cliente para crear el producto.")
      return
    }
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const temp: TempProduct = {
      tempId,
      client_id: cid as number,
      name,
      cpe: newProductCpe.trim() || null,
      mps: newProductMps.trim() || null,
      created_at: new Date().toISOString(),
    }
    setTempProducts((prev) => [temp, ...prev])
    if (createProductLineKey) {
      setLines((prev) =>
        prev.map((line) =>
          line.key === createProductLineKey ? { ...line, product_id: tempId } : line,
        ),
      )
    } else {
      // Asignar el temporal a la primera línea vacía si la hay.
      setLines((prev) => {
        const idx = prev.findIndex((l) => !l.product_id)
        if (idx === -1) return prev
        return prev.map((l, i) => (i === idx ? { ...l, product_id: tempId } : l))
      })
    }
    setCreateProductOpen(false)
    toast.success("Producto temporal añadido. Se creará al aprobar la orden.")
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    openApproveConfirm()
  }

  async function executeConfirmedPost() {
    if (!pendingPost) return
    setSaving(true)
    try {
      const tempIdToRealId = new Map<string, number>()
      const usedTempIds = new Set(
        pendingPost.lines
          .map((l) => l.product_id_raw)
          .filter((p) => p.startsWith("tmp-")),
      )
      // Crear productos temporales en serie. Si alguno falla, abortar (atómico).
      for (const t of tempProducts.filter((tp) => usedTempIds.has(tp.tempId))) {
        const created = await apiFetch<ProductRecord>("products", {
          method: "POST",
          body: JSON.stringify({
            name: t.name,
            client_id: t.client_id,
            cpe: t.cpe,
            mps: t.mps,
          }),
        })
        tempIdToRealId.set(t.tempId, created.id)
      }
      const resolvedLines = pendingPost.lines.map((l) => ({
        product_id: l.product_id_raw.startsWith("tmp-")
          ? tempIdToRealId.get(l.product_id_raw)!
          : Number(l.product_id_raw),
        quantity: l.quantity,
      }))
      const res = await apiFetch<{ id: number; code: string }>("client-orders", {
        method: "POST",
        body: JSON.stringify({
          client_id: pendingPost.client_id,
          notes: pendingPost.notes,
          lines: resolvedLines,
        }),
      })
      toast.success(`${CLIENT_ORDER_MODULE_TITLE} ${res.code ?? ""} creada.`.trim())
      setConfirmOpen(false)
      setPendingPost(null)
      setConfirmSummary(null)
      nav("/ordenes-cliente")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo aprobar el pedido del cliente.")
    } finally {
      setSaving(false)
    }
  }

  function closeConfirmModal(open: boolean) {
    if (!open && saving) return
    setConfirmOpen(open)
    if (!open) {
      setPendingPost(null)
      setConfirmSummary(null)
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

  const clientMissing = !clientId
  const showClientError = attemptedSubmit && clientMissing
  const aprobarDisabled = saving || clientMissing

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">{CLIENT_ORDER_MODULE_NEW_TITLE}</h1>
        </div>
        <Button type="button" variant="outline" size="icon" asChild>
          <Link to="/ordenes-cliente" aria-label="Volver al listado">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm"
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid w-full flex-1 gap-1.5 min-w-0 sm:max-w-xl">
              <Label
                htmlFor="co-cliente"
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                Cliente que encarga la orden *
              </Label>
              <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    id="co-cliente"
                    aria-required="true"
                    aria-expanded={clientComboOpen}
                    className={cn(
                      "h-10 w-full justify-between bg-background text-foreground font-normal",
                      !selectedClient && "text-muted-foreground",
                      showClientError && "border-destructive focus-visible:ring-destructive",
                    )}
                  >
                    <span className="truncate text-left">
                      {selectedClient
                        ? selectedClient.rif
                          ? `${selectedClient.name} · ${selectedClient.rif}`
                          : selectedClient.name
                        : "— Seleccione el cliente —"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[20rem]"
                  align="start"
                >
                  <Command shouldFilter>
                    <CommandInput placeholder="Buscar cliente por nombre o RIF…" />
                    <CommandList>
                      <CommandEmpty>
                        <div className="space-y-2 p-2 text-sm text-muted-foreground">
                          No hay clientes que coincidan.
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {clients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.rif ?? ""}`}
                            onSelect={() => {
                              setClientId(String(c.id))
                              setClientComboOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                clientId === String(c.id) ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">
                              {c.rif ? `${c.name} · ${c.rif}` : c.name}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {showClientError ? (
                <p className="text-xs text-destructive">
                  Debe seleccionar el cliente que encarga la orden.
                </p>
              ) : null}
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
              disabled={clientMissing}
              title={clientMissing ? "Seleccione un cliente primero" : undefined}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo producto
            </Button>
          </div>

          {selectedClient ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Resumen (datos maestros)
              </p>
              <p className="text-foreground mt-0.5">
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

        <div className="grid gap-1.5">
          <Label htmlFor="co-notes" className="flex items-center gap-2 text-sm font-medium">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            Notas *
          </Label>
          <Textarea
            id="co-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            required
            aria-required="true"
            className="resize-y bg-background"
            placeholder="Referencia interna, fecha de entrega deseada, contacto, etc."
          />
        </div>

        <div
          className={cn(
            "space-y-3 border-t pt-4 transition-opacity",
            clientMissing && "pointer-events-none opacity-50",
          )}
          aria-disabled={clientMissing}
        >
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Package className="h-4 w-4 text-muted-foreground" />
            Líneas de la solicitud *
          </h2>

          {lines.map((row, i) => {
            const selected = selectedProductByLineKey.get(row.key) ?? null
            return (
              <div
                key={row.key}
                className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-2"
              >
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Producto
                  </Label>
                  <Popover
                    open={productComboOpenKey === row.key}
                    onOpenChange={(open) => setProductComboOpenKey(open ? row.key : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={productComboOpenKey === row.key}
                        className="h-10 w-full justify-between bg-background text-foreground font-normal"
                      >
                        <span className="truncate text-left">
                          {selected ? (
                            <>
                              {selected.name}
                              {selected.isTemporary ? (
                                <span className="ml-2 italic text-muted-foreground">(temporal)</span>
                              ) : null}
                            </>
                          ) : (
                            "Seleccione un producto"
                          )}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[18rem]"
                      align="start"
                    >
                      <Command shouldFilter>
                        <CommandInput placeholder="Buscar por nombre, C.P.E. o M.P.P.S…" />
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
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  row.product_id ? "opacity-0" : "opacity-100",
                                )}
                              />
                              Sin producto
                            </CommandItem>
                            {productsForClient.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={`${p.name} ${p.cpe ?? ""} ${p.mps ?? ""}`}
                                onSelect={() => {
                                  updateLine(i, { product_id: p.id })
                                  setProductComboOpenKey(null)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    row.product_id === p.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="truncate">
                                  {p.name}
                                  {p.isTemporary ? (
                                    <span className="ml-2 italic text-muted-foreground">
                                      (temporal)
                                    </span>
                                  ) : null}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      C.P.E.
                    </Label>
                    <Input
                      value={selected?.cpe ?? ""}
                      readOnly
                      className="h-10 bg-background"
                      placeholder="Dato maestro"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      M.P.P.S.
                    </Label>
                    <Input
                      value={selected?.mps ?? ""}
                      readOnly
                      className="h-10 bg-background"
                      placeholder="Dato maestro"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    Cantidad a solicitar *
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-10 bg-background"
                    value={row.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    placeholder="Ej. 1000"
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
            )
          })}
          <Button type="button" variant="secondary" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" />
            Añadir línea
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-3 border-t pt-4">
          <Button type="button" variant="outline" asChild>
            <Link to="/ordenes-cliente">Cancelar</Link>
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={aprobarDisabled}
            className="min-w-44"
            title={clientMissing ? "Seleccione un cliente primero" : undefined}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <LoadingButtonLabel loading={saving} loadingText="Aprobando..." idleText="Aprobar" />
          </Button>
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={closeConfirmModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Confirmar envío a producción
            </DialogTitle>
            <DialogDescription>
              Revise los datos. Al confirmar, se crearán los productos temporales (si los hay) y se
              enviará la orden.
            </DialogDescription>
          </DialogHeader>
          {confirmSummary ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cliente
                </p>
                <p className="mt-1 text-foreground">
                  <span className="font-semibold">{confirmSummary.clientName}</span>
                  {confirmSummary.clientRif ? <span> · {confirmSummary.clientRif}</span> : null}
                  {confirmSummary.clientLocation ? (
                    <span className="text-muted-foreground"> · {confirmSummary.clientLocation}</span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">
                  {confirmSummary.notes?.trim() ? confirmSummary.notes : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Líneas
                </p>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {confirmSummary.lines.map((ln, idx) => (
                    <li
                      key={idx}
                      className="grid gap-1 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-start"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {ln.productName}
                          {ln.isTemporary ? (
                            <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                              Nuevo (se creará al aprobar)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          C.P.E.: {ln.cpe} · M.P.P.S.: {ln.mps}
                        </p>
                      </div>
                      <p className="text-foreground sm:text-right">
                        <span className="text-muted-foreground">Cant.: </span>
                        {ln.quantity}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => closeConfirmModal(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void executeConfirmedPost()}
              disabled={saving || !pendingPost}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              <LoadingButtonLabel loading={saving} loadingText="Aprobando..." idleText="Sí, aprobar" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Nuevo producto (temporal)
            </DialogTitle>
            <DialogDescription>
              El producto se añadirá temporalmente y solo se creará en el catálogo cuando se apruebe la
              orden de producción.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(ev) => submitQuickProduct(ev)} className="space-y-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor="quick-product-name"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                Nombre *
              </Label>
              <Input
                id="quick-product-name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="quick-product-client"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                Cliente *
              </Label>
              <Input
                id="quick-product-client"
                value={
                  selectedClient
                    ? `${selectedClient.name}${selectedClient.rif ? ` · ${selectedClient.rif}` : ""}`
                    : ""
                }
                placeholder="Seleccione cliente primero"
                readOnly
                className="h-10"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="quick-product-cpe"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  C.P.E.
                </Label>
                <Input
                  id="quick-product-cpe"
                  value={newProductCpe}
                  onChange={(e) => setNewProductCpe(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="quick-product-mps"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  M.P.P.S.
                </Label>
                <Input
                  id="quick-product-mps"
                  value={newProductMps}
                  onChange={(e) => setNewProductMps(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateProductOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Añadir temporal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
