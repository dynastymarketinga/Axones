"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeftRight,
  Check,
  Package,
  ScrollText,
  UserPlus,
} from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import { parseDecimalTwoInput } from "@/lib/decimal-two-input"
import type {
  ClientOrderDetailRecord,
  ClientOrderLineDetail,
  ClientRecord,
  LaravelPaginated,
  ProductRecord,
} from "@/types/api"
import { CatalogMasterFormBackButton } from "@/components/axones/CatalogMasterFormBackButton"
import { ClientOrderLinesEditor } from "@/components/axones/ClientOrderLinesEditor"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { PageLoadingBlock } from "@/components/axones/LoadingStates"
import {
  catalogMasterFormActionsClass,
  catalogMasterFormPanelWideClass,
  catalogMasterFormPlainInputClass,
  catalogMasterFormSectionClass,
} from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
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
  CLIENT_ORDER_EDIT_NON_PRODUCT_LINES_WARNING,
  CLIENT_ORDER_EDIT_ONLY_OPEN_TOAST,
  CLIENT_ORDER_LINE_INVALID_PRODUCT_TOAST,
  CLIENT_ORDER_LINE_NO_PRODUCT_TOAST,
  CLIENT_ORDER_LINE_QUANTITY_TOAST,
  CLIENT_ORDER_LOADING_LABEL,
  CLIENT_ORDER_MODULE_EDIT_TITLE,
  CLIENT_ORDER_NOTES_PLACEHOLDER,
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

/** Secondary con hover en atajos a maestros. */
const CLIENT_ORDER_MASTER_SECONDARY_HOVER =
  "transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-primary/12 hover:text-foreground hover:shadow-md active:translate-y-0 active:shadow-sm dark:hover:bg-primary/18"

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
  const q = parseDecimalTwoInput(quantity)
  return q === null || q <= 0
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
        void loadClientsAndProducts()
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [loadClientsAndProducts])

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
      if (isLineQuantityInvalid(row.quantity)) {
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
      quantity: parseDecimalTwoInput(row.quantity)!,
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
      <CatalogPageShell
        title={CLIENT_ORDER_MODULE_EDIT_TITLE}
        icon={ScrollText}
        headerVariant="elevated"
        action={<CatalogMasterFormBackButton to="/ordenes-cliente" />}
      >
        <p className="text-destructive text-sm">Identificador de orden no válido.</p>
      </CatalogPageShell>
    )
  }

  if (loading) {
    return (
      <CatalogPageShell
        title={CLIENT_ORDER_MODULE_EDIT_TITLE}
        icon={ScrollText}
        headerVariant="elevated"
        action={<CatalogMasterFormBackButton to="/ordenes-cliente" />}
      >
        <PageLoadingBlock />
        <p className="text-muted-foreground text-sm">{CLIENT_ORDER_LOADING_LABEL}</p>
      </CatalogPageShell>
    )
  }

  if (!orderCode) {
    return (
      <CatalogPageShell
        title={CLIENT_ORDER_MODULE_EDIT_TITLE}
        icon={ScrollText}
        headerVariant="elevated"
        action={<CatalogMasterFormBackButton to="/ordenes-cliente" />}
      >
        <p className="text-muted-foreground text-sm">No se encontró la orden.</p>
      </CatalogPageShell>
    )
  }

  const linesLocked = !canEdit || hasNonProductLines

  return (
    <CatalogPageShell
      title={CLIENT_ORDER_MODULE_EDIT_TITLE}
      subtitle={
        canEdit
          ? CLIENT_ORDER_EDIT_HEADER_HINT
          : "Solo lectura: la orden no está en estado Abierta."
      }
      icon={ScrollText}
      headerVariant="elevated"
      action={<CatalogMasterFormBackButton to="/ordenes-cliente" />}
      headerExtras={
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <span className="font-mono text-base font-medium text-foreground">{orderCode}</span>
          <Badge
            variant="outline"
            className={cn("font-medium border", clientOrderStatusBadgeClass(orderStatus))}
          >
            {clientOrderStatusLabel(orderStatus)}
          </Badge>
        </div>
      }
    >
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

      <form onSubmit={(ev) => void submit(ev)} className={catalogMasterFormPanelWideClass}>
        <div className={catalogMasterFormSectionClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Cliente</h2>
              <p className="text-muted-foreground text-sm">{CLIENT_ORDER_EDIT_CLIENT_SECTION_HELPER}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={cn("shrink-0", CLIENT_ORDER_MASTER_SECONDARY_HOVER)}
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
          {displayClient ? (
            <div className="text-sm pt-2">
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
            <p className="text-sm text-muted-foreground pt-2">Cliente #{selectedClientId}</p>
          ) : (
            <p className="text-sm text-muted-foreground pt-2">Sin cliente seleccionado.</p>
          )}
        </div>

        <div
          className={cn(
            "space-y-3 border-t border-primary/10 pt-6",
            linesLocked && "pointer-events-none opacity-60",
          )}
        >
          <div className={catalogMasterFormSectionClass}>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Package className="h-4 w-4 text-muted-foreground" />
              {CLIENT_ORDER_EDIT_LINES_SECTION_TITLE}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">{CLIENT_ORDER_EDIT_LINES_HELPER}</p>
          </div>

          <ClientOrderLinesEditor
            variant="edit"
            lines={lineDrafts}
            disabled={linesLocked || saving}
            clientMissing={!selectedClientId}
            productsForClient={productsForClient}
            productComboOpenKey={productComboOpenKey}
            onProductComboOpenKeyChange={setProductComboOpenKey}
            selectedProductByLineKey={selectedProductByLineKey}
            newProductLink={newProductLink}
            productPlaceholder="Seleccione un producto del cliente"
            onUpdateLine={(i, patch) => updateLine(lineDrafts[i]!.key, patch)}
            onRemoveLine={(i) => removeLine(lineDrafts[i]!.key)}
            onAddLine={addLine}
          />
        </div>

        <div className="space-y-2 border-t border-primary/10 pt-6">
          <Label htmlFor="co-notes" className="text-foreground">
            Notas <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="co-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={cn(catalogMasterFormPlainInputClass, "min-h-[120px] h-auto resize-y py-2.5")}
            placeholder={CLIENT_ORDER_NOTES_PLACEHOLDER}
            disabled={!canEdit}
          />
        </div>

        <div className={catalogMasterFormActionsClass}>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/ordenes-cliente">Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={saving || !canEdit} className="min-w-40 w-full sm:w-auto">
            {saving ? "Guardando…" : "Guardar cambios"}
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
    </CatalogPageShell>
  )
}
