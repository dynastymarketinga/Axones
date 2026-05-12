"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Hash,
  Layers,
  Package,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type {
  ClientOrderDetailRecord,
  ClientOrderLineDetail,
  ClientRecord,
  LaravelPaginated,
  MaterialRow,
  ProductRecord,
} from "@/types/api"
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
  clientOrderStatusBadgeClass,
  clientOrderStatusLabel,
  CLIENT_ORDER_CREATE_CLIENT_LINK,
  CLIENT_ORDER_EDIT_CLIENT_SECTION_HELPER,
  CLIENT_ORDER_EDIT_HEADER_HINT,
  CLIENT_ORDER_EDIT_LINES_HELPER,
  CLIENT_ORDER_EDIT_LINES_SECTION_TITLE,
  CLIENT_ORDER_EDIT_ONLY_OPEN_TOAST,
  CLIENT_ORDER_LINE_INVALID_PRODUCT_TOAST,
  CLIENT_ORDER_LINE_MATERIAL_EMPTY,
  CLIENT_ORDER_LINE_MATERIAL_LABEL,
  CLIENT_ORDER_LINE_MATERIAL_PLACEHOLDER,
  CLIENT_ORDER_LINE_MATERIAL_SEARCH_PLACEHOLDER,
  CLIENT_ORDER_LINE_NO_PRODUCT_TOAST,
  CLIENT_ORDER_LINE_DESCRIPTION_LABEL,
  CLIENT_ORDER_LINE_DESCRIPTION_PLACEHOLDER,
  CLIENT_ORDER_LINE_QUANTITY_TOAST,
  CLIENT_ORDER_LOADING_LABEL,
  CLIENT_ORDER_MODULE_EDIT_TITLE,
  CLIENT_ORDER_NOTES_PLACEHOLDER,
  CLIENT_ORDER_ORDERED_AT_HELPER,
  CLIENT_ORDER_ORDERED_AT_LABEL,
  CLIENT_ORDER_REPLACE_CLIENT_BUTTON,
  CLIENT_ORDER_REPLACE_DIALOG_CONFIRM,
  CLIENT_ORDER_REPLACE_DIALOG_DESCRIPTION,
  CLIENT_ORDER_REPLACE_DIALOG_TITLE,
  CLIENT_ORDER_REPLACE_EMPTY,
  CLIENT_ORDER_REPLACE_SEARCH_PLACEHOLDER,
  CLIENT_ORDER_TOAST_LOAD_FAILED,
  CLIENT_ORDER_TOAST_SAVE_FAILED,
  CLIENT_ORDER_TOAST_UPDATED,
} from "@/pages/axones/client-order-i18n"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const CO_FOCUS_RING =
  "transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:shadow-md"

function todayLocalDateInput(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function orderedAtToInput(v: string | null | undefined): string {
  if (v == null || String(v).trim() === "") return todayLocalDateInput()
  const s = String(v).trim()
  const d = s.includes("T") ? s.slice(0, 10) : s
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayLocalDateInput()
}

type ProductOption = {
  id: string
  client_id: number
  name: string
  cpe: string | null
  mps: string | null
}

type LineDraft = {
  key: string
  product_id: string
  material_id: string
  description: string
  quantity: string
  unit: string
}

function newLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    product_id: "",
    material_id: "",
    description: "",
    quantity: "",
    unit: "kg",
  }
}

function formatQty(q: string | number | undefined): string {
  if (q === undefined || q === null) return ""
  if (typeof q === "number") return String(q)
  return String(q).trim()
}

function orderLinesToDrafts(lines: ClientOrderLineDetail[]): LineDraft[] {
  return (lines ?? []).map((l) => ({
    key: `line-${l.id}`,
    product_id:
      l.product_id != null && Number(l.product_id) > 0 ? String(l.product_id) : "",
    material_id:
      l.material_id != null && Number(l.material_id) > 0 ? String(l.material_id) : "",
    description: (l.description ?? "").trim(),
    quantity: formatQty(l.quantity),
    unit: (l.unit ?? "kg").trim() || "kg",
  }))
}

function isLineQuantityInvalid(quantity: string): boolean {
  const qtyTrim = quantity.trim()
  const q = Number(qtyTrim)
  return !qtyTrim || !Number.isFinite(q) || q <= 0
}

export default function ClientOrderEditPage() {
  const { coId } = useParams<{ coId: string }>()
  const nav = useNavigate()
  const orderId = coId && /^\d+$/.test(coId) ? Number(coId) : NaN

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<ClientOrderDetailRecord | null>(null)
  const [orderCode, setOrderCode] = useState<string>("")
  const [orderStatus, setOrderStatus] = useState<string>("")
  const [notes, setNotes] = useState("")

  const [clients, setClients] = useState<ClientRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const initialClientIdRef = useRef<number | null>(null)

  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([])
  const [productComboOpenKey, setProductComboOpenKey] = useState<string | null>(null)

  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false)
  const [replaceDraftId, setReplaceDraftId] = useState<string>("")

  const isOpen = orderStatus === "open"
  const canEdit = orderStatus === "" || isOpen

  const hasNonProductLines = useMemo(
    () => Boolean(order?.lines.some((l) => !l.product_id || Number(l.product_id) < 1)),
    [order?.lines],
  )

  const allProductOptions = useMemo<ProductOption[]>(
    () =>
      products.map((p) => ({
        id: String(p.id),
        client_id: p.client_id ?? 0,
        name: p.name,
        cpe: p.cpe ?? null,
        mps: p.mps ?? null,
      })),
    [products],
  )

  const productsForClient = useMemo(() => {
    const cid = selectedClientId
    if (!cid || cid < 1) return []
    return allProductOptions.filter((p) => p.client_id === cid)
  }, [selectedClientId, allProductOptions])

  const selectedProductByLineKey = useMemo(() => {
    const map = new Map<string, ProductOption>()
    for (const row of lineDrafts) {
      const pid = row.product_id.trim()
      if (!pid) continue
      const opt = allProductOptions.find((p) => p.id === pid)
      if (opt) map.set(row.key, opt)
    }
    return map
  }, [lineDrafts, allProductOptions])

  useEffect(() => {
    const cid = selectedClientId
    if (!cid || cid < 1) return
    const allowedIds = new Set(productsForClient.map((p) => p.id))
    setLineDrafts((prev) =>
      prev.map((line) => {
        if (!line.product_id.trim()) return line
        if (!allowedIds.has(line.product_id)) return { ...line, product_id: "" }
        return line
      }),
    )
  }, [selectedClientId, productsForClient])

  const loadClientsAndProducts = useCallback(async () => {
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
      else toast.error("No se pudo cargar clientes o productos.")
    }
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId < 1) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const co = await apiFetch<ClientOrderDetailRecord>(`client-orders/${orderId}`)
      setOrder(co)
      setOrderCode(co.code)
      setOrderStatus(co.status)
      setNotes(co.notes ?? "")
      setSelectedClientId(co.client_id)
      initialClientIdRef.current = co.client_id
      setLineDrafts(orderLinesToDrafts(co.lines ?? []))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error(CLIENT_ORDER_TOAST_LOAD_FAILED)
      setOrderCode("")
      setOrder(null)
      setSelectedClientId(null)
      initialClientIdRef.current = null
      setLineDrafts([])
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadClientsAndProducts()
  }, [loadClientsAndProducts])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void load()
        void loadClientsAndProducts()
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load, loadClientsAndProducts])

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLineDrafts((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeLine(key: string) {
    setLineDrafts((prev) => prev.filter((r) => r.key !== key))
  }

  function addLine() {
    setLineDrafts((prev) => [...prev, newLine()])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) {
      toast.error(CLIENT_ORDER_EDIT_ONLY_OPEN_TOAST)
      return
    }

    if (selectedClientId === null || selectedClientId < 1) {
      toast.error("Seleccione un cliente válido.")
      return
    }

    const initial = initialClientIdRef.current
    const clientChanged = initial !== null && selectedClientId !== initial

    const payload: Record<string, unknown> = {
      notes: notes.trim() || null,
    }

    if (clientChanged) {
      payload.client_id = selectedClientId
    }

    if (hasNonProductLines) {
      if (clientChanged) {
        toast.error(
          "Esta orden tiene líneas que no son producto; no puede cambiar el cliente desde aquí. Contacte a soporte o use solo notas.",
        )
        return
      }
      try {
        setSaving(true)
        await apiFetch<ClientOrderDetailRecord>(`client-orders/${orderId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        toast.success(CLIENT_ORDER_TOAST_UPDATED)
        nav("/ordenes-cliente")
      } catch (err) {
        if (err instanceof ApiError) toast.error(err.message)
        else toast.error(CLIENT_ORDER_TOAST_SAVE_FAILED)
      } finally {
        setSaving(false)
      }
      return
    }

    const allowedIds = new Set(productsForClient.map((p) => p.id))
    for (const row of lineDrafts) {
      if (!row.product_id.trim()) {
        toast.error(CLIENT_ORDER_LINE_NO_PRODUCT_TOAST)
        return
      }
      if (!allowedIds.has(row.product_id)) {
        toast.error(CLIENT_ORDER_LINE_INVALID_PRODUCT_TOAST)
        return
      }
      if (isLineQuantityInvalid(row.product_id, row.quantity)) {
        toast.error(CLIENT_ORDER_LINE_QUANTITY_TOAST)
        return
      }
    }

    if (lineDrafts.length === 0) {
      toast.error(CLIENT_ORDER_LINE_NO_PRODUCT_TOAST)
      return
    }

    payload.lines = lineDrafts.map((row) => ({
      product_id: Number(row.product_id),
      quantity: row.quantity.trim(),
      unit: row.unit.trim() || "kg",
    }))

    setSaving(true)
    try {
      await apiFetch<ClientOrderDetailRecord>(`client-orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
      toast.success(CLIENT_ORDER_TOAST_UPDATED)
      nav("/ordenes-cliente")
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error(CLIENT_ORDER_TOAST_SAVE_FAILED)
    } finally {
      setSaving(false)
    }
  }

  const newClientLink = {
    pathname: "/clientes/form" as const,
    state: { from: `/ordenes-cliente/${orderId}` as const },
  }

  const newProductLink = useMemo(() => {
    const p = new URLSearchParams()
    p.set("returnTo", `/ordenes-cliente/${orderId}`)
    if (selectedClientId) p.set("client_id", String(selectedClientId))
    return {
      pathname: "/productos/form" as const,
      search: `?${p.toString()}`,
      state: { from: `/ordenes-cliente/${orderId}` as const },
    }
  }, [orderId, selectedClientId])

  const displayClient = useMemo(() => {
    if (selectedClientId === null) return null
    const fromList = clients.find((c) => c.id === selectedClientId)
    if (fromList) return fromList
    const oc = order?.client
    if (oc && oc.id === selectedClientId) return oc
    return null
  }, [clients, order?.client, selectedClientId])

  if (!Number.isFinite(orderId) || orderId < 1) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-destructive text-sm">Identificador de orden no válido.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/ordenes-cliente">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground text-sm">{CLIENT_ORDER_LOADING_LABEL}</p>
      </div>
    )
  }

  if (!orderCode) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground text-sm">No se encontró la orden.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/ordenes-cliente">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  const linesLocked = !canEdit || hasNonProductLines

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{CLIENT_ORDER_MODULE_EDIT_TITLE}</h1>
          <p className="text-foreground/90 font-mono text-sm">{orderCode}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
            <span>Estado</span>
            <Badge
              variant="outline"
              className={cn("font-medium border", clientOrderStatusBadgeClass(orderStatus))}
            >
              {clientOrderStatusLabel(orderStatus)}
            </Badge>
            {canEdit ? (
              <span className="max-w-xl text-muted-foreground">· {CLIENT_ORDER_EDIT_HEADER_HINT}</span>
            ) : (
              <span>· Solo lectura.</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          <Button type="button" variant="default" size="sm" asChild>
            <Link to="/ordenes-cliente">Volver al listado</Link>
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          Esta orden no está <strong>Abierta</strong>, por lo que no se permite editar notas ni cambiar el cliente. Use el
          listado.
        </p>
      ) : null}

      {hasNonProductLines ? (
        <p className="text-sm text-amber-900 dark:text-amber-100 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          {CLIENT_ORDER_EDIT_NON_PRODUCT_LINES_WARNING}
        </p>
      ) : null}

      <form
        onSubmit={(ev) => void submit(ev)}
        className="space-y-6 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <CardTitle className="text-base">Cliente</CardTitle>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={!canEdit || hasNonProductLines}
                  onClick={() => {
                    setReplaceDraftId(selectedClientId !== null ? String(selectedClientId) : "")
                    setReplaceDialogOpen(true)
                  }}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  {CLIENT_ORDER_REPLACE_CLIENT_BUTTON}
                </Button>
                <Button variant="link" size="sm" className="h-auto shrink-0 px-2 text-muted-foreground" asChild>
                  <Link to={newClientLink.pathname} state={newClientLink.state}>
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    {CLIENT_ORDER_CREATE_CLIENT_LINK}
                  </Link>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{CLIENT_ORDER_EDIT_CLIENT_SECTION_HELPER}</p>
          </CardHeader>
          <CardContent className="pt-0">
            {displayClient ? (
              <div className="text-sm">
                <p className="text-base font-medium text-foreground">
                  {displayClient.name}
                  {displayClient.rif ? (
                    <span className="font-normal text-muted-foreground"> · {displayClient.rif}</span>
                  ) : null}
                </p>
                {displayClient.city || displayClient.state || displayClient.address ? (
                  <p className="text-muted-foreground mt-1.5">
                    {[displayClient.address, [displayClient.city, displayClient.state].filter(Boolean).join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            ) : selectedClientId !== null ? (
              <p className="text-sm text-muted-foreground">Cliente #{selectedClientId}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin cliente seleccionado.</p>
            )}
          </CardContent>
        </Card>

        <div
          className={cn(
            "space-y-3 border-t border-border pt-4",
            linesLocked && "pointer-events-none opacity-60",
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Package className="h-4 w-4 text-muted-foreground" />
                {CLIENT_ORDER_EDIT_LINES_SECTION_TITLE}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">{CLIENT_ORDER_EDIT_LINES_HELPER}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={linesLocked || !selectedClientId}
                className="shrink-0"
                asChild
              >
                <Link
                  className="inline-flex items-center"
                  to={{ pathname: newProductLink.pathname, search: newProductLink.search }}
                  state={newProductLink.state}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo producto
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={linesLocked}
                onClick={() => addLine()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Añadir línea
              </Button>
            </div>
          </div>

          {lineDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/20 p-4">
              No hay líneas con producto. Pulse «Añadir línea» o cargue la orden de nuevo.
            </p>
          ) : (
            lineDrafts.map((row, i) => {
              const selected = selectedProductByLineKey.get(row.key) ?? null
              return (
                <div
                  key={row.key}
                  className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-2"
                >
                  <div className="grid gap-2 sm:col-span-2">
                    <Label className="text-sm font-medium leading-snug">Producto</Label>
                    <Popover
                      open={productComboOpenKey === row.key}
                      onOpenChange={(open) => setProductComboOpenKey(open ? row.key : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          disabled={linesLocked}
                          aria-expanded={productComboOpenKey === row.key}
                          className={cn(
                            "h-10 w-full justify-between gap-2 bg-background px-3 font-normal",
                            CO_FOCUS_RING,
                            "focus-visible:ring-primary/35",
                          )}
                        >
                          <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-left",
                              selected ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {selected ? selected.name : "Seleccione un producto del cliente"}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
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
                                <Button type="button" variant="secondary" size="sm" asChild>
                                  <Link
                                    className="inline-flex items-center"
                                    to={{
                                      pathname: newProductLink.pathname,
                                      search: newProductLink.search,
                                    }}
                                    state={newProductLink.state}
                                    onClick={() => setProductComboOpenKey(null)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Crear producto
                                  </Link>
                                </Button>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {productsForClient.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.cpe ?? ""} ${p.mps ?? ""}`}
                                  onSelect={() => {
                                    updateLine(row.key, { product_id: p.id })
                                    setProductComboOpenKey(null)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      row.product_id === p.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
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
                    <div className="grid gap-1.5">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        C.P.E.
                      </Label>
                      <Input
                        value={selected?.cpe ?? ""}
                        readOnly
                        tabIndex={-1}
                        className={cn(
                          "h-10 bg-background",
                          CO_FOCUS_RING,
                          "focus-visible:ring-muted-foreground/25",
                        )}
                        placeholder="—"
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
                        tabIndex={-1}
                        className={cn(
                          "h-10 bg-background",
                          CO_FOCUS_RING,
                          "focus-visible:ring-muted-foreground/25",
                        )}
                        placeholder="—"
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-1">
                      <Label className="text-sm font-medium">Cantidad</Label>
                      <Input
                        inputMode="decimal"
                        disabled={linesLocked}
                        value={row.quantity}
                        onChange={(e) => updateLine(row.key, { quantity: e.target.value })}
                        className={cn("h-10 bg-background", CO_FOCUS_RING, "focus-visible:ring-primary/35")}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="grid gap-1.5 max-w-[8rem]">
                      <Label className="text-sm font-medium">Unidad</Label>
                      <Input
                        disabled={linesLocked}
                        value={row.unit}
                        onChange={(e) => updateLine(row.key, { unit: e.target.value })}
                        className={cn("h-10 bg-background", CO_FOCUS_RING, "focus-visible:ring-primary/35")}
                        placeholder="kg"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={linesLocked}
                      onClick={() => removeLine(row.key)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Quitar línea {i + 1}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="co-notes" className="text-foreground">
            Notas <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="co-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="min-h-[120px] resize-y bg-background"
            placeholder={CLIENT_ORDER_NOTES_PLACEHOLDER}
            disabled={!canEdit}
          />
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-2 border-t border-border/80 pt-4">
          <Button type="submit" size="lg" disabled={saving || !canEdit} className="min-w-40">
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/ordenes-cliente">Cancelar</Link>
          </Button>
        </div>
      </form>

      <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-4">
            <DialogTitle className="text-base">{CLIENT_ORDER_REPLACE_DIALOG_TITLE}</DialogTitle>
            <DialogDescription className="text-sm">{CLIENT_ORDER_REPLACE_DIALOG_DESCRIPTION}</DialogDescription>
          </DialogHeader>
          <Command className="rounded-none border-0 bg-transparent">
            <CommandInput placeholder={CLIENT_ORDER_REPLACE_SEARCH_PLACEHOLDER} className="mx-3 border-b border-border/60" />
            <CommandList className="max-h-[min(50vh,280px)] overflow-y-auto px-2 py-2">
              <CommandEmpty>{CLIENT_ORDER_REPLACE_EMPTY}</CommandEmpty>
              <CommandGroup>
                {clients.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.rif ?? ""}`}
                    onSelect={() => setReplaceDraftId(String(c.id))}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        replaceDraftId === String(c.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{c.name}</span>
                    {c.rif ? <span className="text-muted-foreground ml-1 truncate text-xs">· {c.rif}</span> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setReplaceDialogOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={!replaceDraftId.trim()}
              onClick={() => {
                const id = Number(replaceDraftId)
                if (!Number.isFinite(id) || id < 1) return
                setSelectedClientId(id)
                setReplaceDialogOpen(false)
              }}
            >
              {CLIENT_ORDER_REPLACE_DIALOG_CONFIRM}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
