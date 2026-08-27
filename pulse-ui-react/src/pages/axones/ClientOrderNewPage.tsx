"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Package,
  ScrollText,
  StickyNote,
  UserPlus,
  Users,
} from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import {
  formatDecimalTwoOnBlur,
  parseDecimalTwoInput,
} from "@/lib/decimal-two-input"
import type {
  ClientRecord,
  LaravelPaginated,
  MaterialRow,
  ProductRecord,
} from "@/types/api"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import { CatalogMasterFormBackButton } from "@/components/axones/CatalogMasterFormBackButton"
import { CatalogMasterFormDateInput } from "@/components/axones/CatalogMasterFormDateInput"
import { ClientOrderLinesEditor } from "@/components/axones/ClientOrderLinesEditor"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import {
  catalogMasterFormActionsClass,
  catalogMasterFormInputClass,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  CLIENT_ORDER_CONFIRM_ORDERED_AT_LABEL,
  CLIENT_ORDER_LINE_INVALID_PRODUCT_HELPER,
  CLIENT_ORDER_LINE_INVALID_PRODUCT_TOAST,
  CLIENT_ORDER_LINE_NO_PRODUCT_TOAST,
  CLIENT_ORDER_LINE_PRODUCT_REQUIRED_HELPER,
  CLIENT_ORDER_LINE_QUANTITY_BLUR_TOAST,
  CLIENT_ORDER_LINE_QUANTITY_REQUIRED_HELPER,
  CLIENT_ORDER_LINE_QUANTITY_TOAST,
  CLIENT_ORDER_MODULE_NEW_SUBTITLE,
  CLIENT_ORDER_MODULE_NEW_TITLE,
  CLIENT_ORDER_MODULE_TITLE,
  CLIENT_ORDER_NOTES_PLACEHOLDER,
  CLIENT_ORDER_NOTES_REQUIRED_HELPER,
  CLIENT_ORDER_NOTES_REQUIRED_TOAST,
  CLIENT_ORDER_ORDERED_AT_HELPER,
  CLIENT_ORDER_ORDERED_AT_LABEL,
} from "@/pages/axones/client-order-i18n"

/** Tras crear/editar producto desde esta pantalla, volver aquí (también en `?returnTo=`). */
const RETURN_TO_NEW_CLIENT_ORDER_PATH = "/ordenes-cliente/nueva"

const notesFieldIconClass =
  "pointer-events-none absolute left-3 top-3 h-4 w-4 transition-colors text-muted-foreground group-focus-within/field:text-primary"

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

function isLineQuantityInvalid(productId: string, quantity: string): boolean {
  const pid = productId.trim()
  if (!pid) return false
  const q = parseDecimalTwoInput(quantity)
  return q === null || q <= 0
}

type LineDraft = {
  key: string
  /** Id numérico del producto (`"123"`). */
  product_id: string
  quantity: string
  /** Id numérico del material (`"456"`), opcional. */
  material_id: string
  /** Texto libre corto por línea (`client_order_lines.description`). */
  description: string
}

function newLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    product_id: "",
    quantity: "",
    material_id: "",
    description: "",
  }
}

type LinePayloadEntry = {
  product_id_raw: string
  quantity: string
  material_id_raw: string
  description: string
}

function buildPayloadLines(lines: LineDraft[]): LinePayloadEntry[] {
  return lines
    .map((r) => ({
      product_id_raw: r.product_id,
      quantity: (r.quantity || "").trim(),
      material_id_raw: (r.material_id || "").trim(),
      description: (r.description || "").trim(),
    }))
    .filter((l) => l.product_id_raw && l.product_id_raw.length > 0)
}

type LineSubmitGate =
  | { ok: true; payloadLines: LinePayloadEntry[] }
  | { ok: false; reason: "no_product" | "bad_quantity" | "wrong_product_client" }

function gatePayloadLines(lines: LineDraft[], allowedIds: Set<string>): LineSubmitGate {
  const payloadLines = buildPayloadLines(lines)
  if (payloadLines.length === 0) return { ok: false, reason: "no_product" }
  for (const l of payloadLines) {
    const q = parseDecimalTwoInput(l.quantity)
    if (q === null || q <= 0) {
      return { ok: false, reason: "bad_quantity" }
    }
  }
  for (const l of payloadLines) {
    if (!allowedIds.has(l.product_id_raw)) {
      return { ok: false, reason: "wrong_product_client" }
    }
  }
  return { ok: true, payloadLines }
}

type LineFieldErrors = { product?: string; quantity?: string }

function lineUiErrorsFromGate(
  gate: LineSubmitGate,
  lines: LineDraft[],
  allowedIds: Set<string>,
): Map<string, LineFieldErrors> {
  const map = new Map<string, LineFieldErrors>()
  if (gate.ok) return map
  if (gate.reason === "no_product") {
    for (const row of lines) {
      if (!row.product_id?.trim()) {
        map.set(row.key, { product: CLIENT_ORDER_LINE_PRODUCT_REQUIRED_HELPER })
      }
    }
    return map
  }
  if (gate.reason === "bad_quantity") {
    for (const row of lines) {
      const pid = row.product_id?.trim()
      if (!pid) continue
      const qtyTrim = (row.quantity || "").trim()
      const q = parseDecimalTwoInput(qtyTrim)
      if (q === null || q <= 0) {
        map.set(row.key, { quantity: CLIENT_ORDER_LINE_QUANTITY_REQUIRED_HELPER })
      }
    }
    return map
  }
  for (const row of lines) {
    const pid = row.product_id?.trim()
    if (!pid) continue
    if (!allowedIds.has(pid)) {
      map.set(row.key, { product: CLIENT_ORDER_LINE_INVALID_PRODUCT_HELPER })
    }
  }
  return map
}

/** Opción de producto para combobox (catálogo). */
type ProductOption = {
  id: string
  client_id: number
  name: string
  cpe: string | null
  mps: string | null
  created_at?: string
}

type ClientOrderPostBody = {
  client_id: number
  notes: string
  ordered_at: string
  lines: LinePayloadEntry[]
}

type ConfirmSummaryLine = {
  productName: string
  cpe: string
  mps: string
  quantity: string
  materialLabel?: string
  lineDescription?: string
}

type ConfirmSummary = {
  clientName: string
  clientRif?: string
  clientLocation?: string
  notes: string
  orderedAtDisplay: string
  lines: ConfirmSummaryLine[]
}

export default function ClientOrderNewPage() {
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])

  const [clientId, setClientId] = useState<string>("")
  const [pendingSelectProductId, setPendingSelectProductId] = useState<string | null>(null)
  const [clientComboOpen, setClientComboOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [orderedAt, setOrderedAt] = useState(todayLocalDateInput)
  const [lines, setLines] = useState<LineDraft[]>([newLine()])
  const [productComboOpenKey, setProductComboOpenKey] = useState<string | null>(null)
  const [materialComboOpenKey, setMaterialComboOpenKey] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPost, setPendingPost] = useState<ClientOrderPostBody | null>(null)
  const [confirmSummary, setConfirmSummary] = useState<ConfirmSummary | null>(null)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [notesBlurredInvalid, setNotesBlurredInvalid] = useState(false)
  const [qtyBlurKeys, setQtyBlurKeys] = useState<Set<string>>(() => new Set())
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const notesBlurToastIssuedRef = useRef(false)
  const qtyBlurToastIssuedRef = useRef<Set<string>>(new Set())
  const initialLoadDoneRef = useRef(false)

  const load = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) setLoading(true)
    try {
      const [cl, pr, mat] = await Promise.all([
        apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 200, page: 1 },
        }),
        apiFetch<LaravelPaginated<ProductRecord>>("products", {
          query: { per_page: 200, page: 1 },
        }),
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { per_page: 500, page: 1 },
        }),
      ])
      setClients(cl.data ?? [])
      setProducts(pr.data ?? [])
      setMaterials(mat.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar clientes, productos o materiales.")
    } finally {
      initialLoadDoneRef.current = true
      if (!options?.background) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Volver desde alta de producto: ?client_id= & select_product= (se limpia del URL tras leer). */
  useEffect(() => {
    const cidParam = searchParams.get("client_id")
    const pidParam = searchParams.get("select_product")
    if (cidParam == null && pidParam == null) return

    if (cidParam != null) {
      const n = Number(cidParam)
      if (Number.isFinite(n) && n >= 1) setClientId(String(n))
    }
    if (pidParam != null) {
      const n = Number(pidParam)
      if (Number.isFinite(n) && n >= 1) setPendingSelectProductId(String(n))
    }

    const next = new URLSearchParams(searchParams)
    next.delete("client_id")
    next.delete("select_product")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const allProductOptions = useMemo<ProductOption[]>(() => {
    return products.map((p) => ({
      id: String(p.id),
      client_id: p.client_id ?? 0,
      name: p.name,
      cpe: p.cpe ?? null,
      mps: p.mps ?? null,
      created_at: p.created_at,
    }))
  }, [products])

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
    if (!pendingSelectProductId) return
    const cid = Number(clientId)
    if (!Number.isFinite(cid) || cid < 1) return
    const exists = allProductOptions.some(
      (p) => p.id === pendingSelectProductId && p.client_id === cid,
    )
    if (!exists) return
    setLines((prev) => {
      if (prev.length === 0) return prev
      const emptyIdx = prev.findIndex((l) => !l.product_id.trim())
      const idx = emptyIdx >= 0 ? emptyIdx : 0
      return prev.map((line, i) =>
        i === idx ? { ...line, product_id: pendingSelectProductId } : line,
      )
    })
    setPendingSelectProductId(null)
  }, [pendingSelectProductId, clientId, allProductOptions])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && initialLoadDoneRef.current) {
        void load({ background: true })
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])

  /** Quitar marca blur en cantidad cuando la línea queda válida sin nuevo blur. */
  useEffect(() => {
    setQtyBlurKeys((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const key of prev) {
        const row = lines.find((l) => l.key === key)
        if (
          !row ||
          !row.product_id.trim() ||
          !isLineQuantityInvalid(row.product_id, row.quantity)
        ) {
          next.delete(key)
          qtyBlurToastIssuedRef.current.delete(key)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [lines])

  const productsForClient = useMemo<ProductOption[]>(() => {
    const cid = clientId ? Number(clientId) : null
    if (!cid) return []
    return allProductOptions.filter((p) => p.client_id === cid)
  }, [clientId, allProductOptions])

  // Auto-seleccionar el producto más reciente del cliente en la primera línea vacía.
  useEffect(() => {
    if (pendingSelectProductId) return
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
  }, [clientId, productsForClient, pendingSelectProductId])

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

  const selectedMaterialByLineKey = useMemo(() => {
    const map = new Map<string, MaterialRow | null>()
    for (const row of lines) {
      const mid = row.material_id?.trim()
      const material = mid
        ? materials.find((m) => String(m.id) === mid) ?? null
        : null
      map.set(row.key, material)
    }
    return map
  }, [lines, materials])

  const canEvaluateLinesUIErrors = useMemo(() => {
    const cid = Number(clientId)
    return (
      attemptedSubmit &&
      Number.isFinite(cid) &&
      cid >= 1 &&
      Boolean(notes.trim())
    )
  }, [attemptedSubmit, clientId, notes])

  const lineFieldErrorsByKey = useMemo(() => {
    if (!canEvaluateLinesUIErrors) return new Map<string, LineFieldErrors>()
    const cid = Number(clientId)
    const allowedIds = new Set(
      allProductOptions.filter((p) => p.client_id === cid).map((p) => p.id),
    )
    const gate = gatePayloadLines(lines, allowedIds)
    return lineUiErrorsFromGate(gate, lines, allowedIds)
  }, [canEvaluateLinesUIErrors, lines, clientId, allProductOptions])

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()])
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))
  }

  function validateAndBuildPostBody(): ClientOrderPostBody | null {
    setAttemptedSubmit(true)
    const cid = Number(clientId)
    if (!Number.isFinite(cid) || cid < 1) {
      toast.error("Seleccione el cliente que encarga la orden.")
      return null
    }
    

    const allowedIds = new Set(
      allProductOptions.filter((p) => p.client_id === cid).map((p) => p.id),
    )
    const gate = gatePayloadLines(lines, allowedIds)
    if (!gate.ok) {
      if (gate.reason === "no_product") toast.error(CLIENT_ORDER_LINE_NO_PRODUCT_TOAST)
      else if (gate.reason === "bad_quantity") toast.error(CLIENT_ORDER_LINE_QUANTITY_TOAST)
      else toast.error(CLIENT_ORDER_LINE_INVALID_PRODUCT_TOAST)
      return null
    }

    return {
      client_id: cid,
      notes: notes.trim(),
      ordered_at: orderedAt.trim() || todayLocalDateInput(),
      lines: gate.payloadLines,
    }
  }

  function openApproveConfirm() {
    const body = validateAndBuildPostBody()
    if (!body) return
    const client = clients.find((c) => c.id === body.client_id)
    const loc = [client?.city, client?.state].filter(Boolean).join(", ")
    const orderedAtDisplay =
      body.ordered_at.trim().length > 0
        ? new Date(`${body.ordered_at.trim()}T12:00:00`).toLocaleDateString("es-VE", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "—"
    const summary: ConfirmSummary = {
      clientName: client?.name ?? "",
      clientRif: client?.rif?.trim() ? client.rif.trim() : undefined,
      clientLocation: loc || undefined,
      notes: body.notes,
      orderedAtDisplay,
      lines: body.lines.map((l) => {
        const p = allProductOptions.find((pr) => pr.id === l.product_id_raw)
        const mid = l.material_id_raw.trim()
        const mat = mid ? materials.find((m) => String(m.id) === mid) : undefined
        const descTrim = l.description.trim()
        return {
          productName: p?.name ?? `Producto ${l.product_id_raw}`,
          cpe: (p?.cpe ?? "").trim() || "—",
          mps: (p?.mps ?? "").trim() || "—",
          quantity: l.quantity,
          materialLabel:
            mat != null ? `${mat.sku} — ${mat.name}` : mid ? `material #${mid}` : undefined,
          lineDescription: descTrim.length > 0 ? descTrim : undefined,
        }
      }),
    }
    setPendingPost(body)
    setConfirmSummary(summary)
    setConfirmOpen(true)
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    openApproveConfirm()
  }

  async function executeConfirmedPost() {
    if (!pendingPost) return
    setSaving(true)
    try {
      const resolvedLines = pendingPost.lines.map((l) => {
        const line: {
          product_id: number
          quantity: number
          material_id?: number
          description?: string
        } = {
          product_id: Number(l.product_id_raw),
          quantity: parseDecimalTwoInput(l.quantity)!,
        }
        const mid = l.material_id_raw.trim()
        if (mid && Number.isFinite(Number(mid)) && Number(mid) >= 1) {
          line.material_id = Number(mid)
        }
        if (l.description.trim()) {
          line.description = l.description.trim()
        }
        return line
      })
      const payload: Record<string, unknown> = {
        client_id: pendingPost.client_id,
        notes: pendingPost.notes,
        lines: resolvedLines,
      }
      const ord = pendingPost.ordered_at.trim()
      if (ord) payload.ordered_at = ord
      const res = await apiFetch<{ id: number; code: string }>("client-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      toast.success(`${CLIENT_ORDER_MODULE_TITLE} ${res.code ?? ""} creada.`.trim())
      setConfirmOpen(false)
      setPendingPost(null)
      setConfirmSummary(null)
      nav("/ordenes-cliente")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo aprobar el pedido cliente (OC).")
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
    state: { from: RETURN_TO_NEW_CLIENT_ORDER_PATH },
  }

  const newProductLink = useMemo(() => {
    const p = new URLSearchParams()
    p.set("returnTo", RETURN_TO_NEW_CLIENT_ORDER_PATH)
    if (clientId) p.set("client_id", clientId)
    return {
      pathname: "/productos/form" as const,
      search: `?${p.toString()}`,
      state: { from: RETURN_TO_NEW_CLIENT_ORDER_PATH },
    }
  }, [clientId])

  /** Tras crear material desde una línea, volver al alta de OC (`MaterialFormPage` usa `state.from`). */
  const newMaterialLink = {
    pathname: "/materiales/nuevo" as const,
    state: { from: RETURN_TO_NEW_CLIENT_ORDER_PATH },
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground text-sm">Cargando clientes, productos y materiales…</p>
      </div>
    )
  }

  const clientMissing = !clientId
  const showClientError = attemptedSubmit && clientMissing
  const showNotesError =
    (attemptedSubmit && !notes.trim()) || (notesBlurredInvalid && !notes.trim())
  const aprobarDisabled = saving || clientMissing

  function handleNotesBlur() {
    if (!notes.trim()) {
      setNotesBlurredInvalid(true)
      if (!notesBlurToastIssuedRef.current) {
        notesBlurToastIssuedRef.current = true
        toast.error(CLIENT_ORDER_NOTES_REQUIRED_TOAST)
      }
    }
  }

  function handleQuantityBlur(rowKey: string, productId: string, quantity: string) {
    if (!productId.trim()) {
      setQtyBlurKeys((prev) => {
        if (!prev.has(rowKey)) return prev
        const n = new Set(prev)
        n.delete(rowKey)
        return n
      })
      qtyBlurToastIssuedRef.current.delete(rowKey)
      return
    }
    if (isLineQuantityInvalid(productId, quantity)) {
      setQtyBlurKeys((prev) => new Set(prev).add(rowKey))
      if (!qtyBlurToastIssuedRef.current.has(rowKey)) {
        qtyBlurToastIssuedRef.current.add(rowKey)
        toast.error(CLIENT_ORDER_LINE_QUANTITY_BLUR_TOAST)
      }
    } else {
      setQtyBlurKeys((prev) => {
        if (!prev.has(rowKey)) return prev
        const n = new Set(prev)
        n.delete(rowKey)
        return n
      })
      qtyBlurToastIssuedRef.current.delete(rowKey)
    }
  }

  function handleQuantityFieldBlur(
    rowKey: string,
    lineIndex: number,
    productId: string,
    quantity: string,
  ) {
    const formatted = formatDecimalTwoOnBlur(quantity)
    if (formatted !== quantity) {
      updateLine(lineIndex, { quantity: formatted })
    }
    handleQuantityBlur(rowKey, productId, formatted || quantity)
  }

  return (
    <CatalogPageShell
      title={CLIENT_ORDER_MODULE_NEW_TITLE}
      subtitle={CLIENT_ORDER_MODULE_NEW_SUBTITLE}
      icon={ScrollText}
      headerVariant="elevated"
      action={<CatalogMasterFormBackButton to="/ordenes-cliente" />}
    >
      <form
        noValidate
        onSubmit={handleFormSubmit}
        className={catalogMasterFormPanelWideClass}
      >
        <div className={catalogMasterFormSectionClass}>
          <h2 className="text-base font-semibold tracking-tight">Datos del pedido</h2>
          <p className="text-muted-foreground text-sm">
            Cliente y notas son obligatorios. La fecha refleja el día comercial del pedido.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid w-full min-w-0 gap-1.5">
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
                    catalogMasterFormPlainInputClass,
                    "justify-between px-3 font-normal",
                    !selectedClient && "text-muted-foreground",
                    showClientError
                      ? "border-destructive focus-visible:ring-destructive"
                      : "",
                  )}
                >
                  <span className="truncate text-left">
                    {selectedClient ? selectedClient.name : "— Seleccione el cliente —"}
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
                      <div className="space-y-2 p-2 text-sm">
                        <p className="text-muted-foreground">No hay clientes que coincidan.</p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className={CLIENT_ORDER_MASTER_SECONDARY_HOVER}
                          onClick={() => {
                            setClientComboOpen(false)
                            nav(newClientLink.pathname, { state: newClientLink.state })
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" aria-hidden />
                          Nuevo cliente
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="nuevo cliente crear"
                        onSelect={() => {
                          setClientComboOpen(false)
                          nav(newClientLink.pathname, { state: newClientLink.state })
                        }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" aria-hidden />
                        Nuevo cliente
                      </CommandItem>
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
                          <span className="truncate">{c.name}</span>
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
        </div>

        <div className="grid gap-2">
          <Label htmlFor="co-notes" className="text-sm font-medium leading-snug">
            Notas 
          </Label>
          <div className="group/field relative">
            <StickyNote
              className={cn(
                notesFieldIconClass,
                showNotesError
                  ? "text-destructive"
                  : "text-muted-foreground group-focus-within/field:text-primary",
              )}
              aria-hidden
            />
            <Textarea
              ref={notesRef}
              id="co-notes"
              value={notes}
              onChange={(e) => {
                const v = e.target.value
                setNotes(v)
                if (v.trim()) {
                  setNotesBlurredInvalid(false)
                  notesBlurToastIssuedRef.current = false
                }
              }}
              onBlur={handleNotesBlur}
              rows={4}
              aria-required="true"
              aria-invalid={showNotesError}
              className={cn(
                "resize-y pl-10 pt-2.5 min-h-[5.5rem]",
                catalogMasterFormInputClass,
                showNotesError
                  ? "border-destructive bg-destructive/5 focus-visible:ring-destructive"
                  : "",
              )}
              placeholder={CLIENT_ORDER_NOTES_PLACEHOLDER}
            />
          </div>
          {showNotesError ? (
            <p className="text-destructive text-xs">{CLIENT_ORDER_NOTES_REQUIRED_HELPER}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor="co-ordered-at"
            className="flex items-center gap-2 text-sm font-medium leading-snug"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {CLIENT_ORDER_ORDERED_AT_LABEL}
          </Label>
          <CatalogMasterFormDateInput
            id="co-ordered-at"
            value={orderedAt}
            onChange={setOrderedAt}
            disabled={saving}
          />
          <p className="text-muted-foreground text-xs">{CLIENT_ORDER_ORDERED_AT_HELPER}</p>
        </div>

        <div
          className={cn(
            "space-y-3 border-t border-primary/10 pt-6 transition-opacity",
            clientMissing && "pointer-events-none opacity-50",
          )}
          aria-disabled={clientMissing}
        >
          <div className={catalogMasterFormSectionClass}>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Package className="h-4 w-4 text-muted-foreground" />
              Líneas de la solicitud *
            </h2>
            <p className="text-muted-foreground text-sm">
              Cada línea debe tener producto y cantidad. Puede añadir material o descripción opcional.
            </p>
          </div>

          <ClientOrderLinesEditor
            variant="new"
            lines={lines}
            disabled={saving}
            clientMissing={clientMissing}
            productsForClient={productsForClient}
            materials={materials}
            productComboOpenKey={productComboOpenKey}
            onProductComboOpenKeyChange={setProductComboOpenKey}
            materialComboOpenKey={materialComboOpenKey}
            onMaterialComboOpenKeyChange={setMaterialComboOpenKey}
            selectedProductByLineKey={selectedProductByLineKey}
            selectedMaterialByLineKey={selectedMaterialByLineKey}
            lineFieldErrorsByKey={lineFieldErrorsByKey}
            qtyBlurKeys={qtyBlurKeys}
            newProductLink={newProductLink}
            newMaterialLink={newMaterialLink}
            onUpdateLine={(i, patch) => updateLine(i, patch)}
            onRemoveLine={(i) => removeLine(i)}
            onAddLine={addLine}
            onQuantityBlur={handleQuantityFieldBlur}
          />
        </div>

        <div className={catalogMasterFormActionsClass}>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/ordenes-cliente">Cancelar</Link>
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={aprobarDisabled}
            className="min-h-11 min-w-44 w-full sm:w-auto"
            title={clientMissing ? "Seleccione un cliente primero" : undefined}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <LoadingButtonLabel loading={saving} loadingText="Aprobando..." idleText="Aprobar" />
          </Button>
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={closeConfirmModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle
              asChild
              className="flex flex-wrap items-center justify-center gap-2 text-center text-xl font-bold leading-tight tracking-tight sm:text-2xl"
            >
              <h1>
                <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                <strong>Confirmar envío a producción</strong>
              </h1>
            </DialogTitle>
            <DialogDescription className="text-pretty">
              Revise los datos. Al confirmar se registrará el pedido cliente (OC).
            </DialogDescription>
          </DialogHeader>
          {confirmSummary ? (
            <div className="overflow-hidden rounded-lg border border-border bg-muted/30 text-sm">
              <div className="border-b border-border px-3 py-3">
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
              <div className="border-b border-border px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {CLIENT_ORDER_CONFIRM_ORDERED_AT_LABEL}
                </p>
                <p className="mt-1 text-foreground">{confirmSummary.orderedAtDisplay}</p>
              </div>
              <div className="border-b border-border px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">
                  {confirmSummary.notes?.trim() ? confirmSummary.notes : "—"}
                </p>
              </div>
              <div className="px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Líneas
                </p>
                <ul className="mt-2 divide-y divide-border">
                  {confirmSummary.lines.map((ln, idx) => (
                    <li
                      key={idx}
                      className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{ln.productName}</p>
                        <p className="text-muted-foreground text-xs">
                          C.P.E.: {ln.cpe} · M.P.P.S.: {ln.mps}
                        </p>
                        {ln.materialLabel ? (
                          <p className="text-muted-foreground text-xs">Material: {ln.materialLabel}</p>
                        ) : null}
                        {ln.lineDescription ? (
                          <p className="text-muted-foreground text-xs">
                            Descripción: {ln.lineDescription}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-foreground sm:text-right">
                        <span className="text-muted-foreground">Cant.: </span>
                        {ln.quantity}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <div
            role="group"
            aria-label="Acciones del diálogo"
            className="flex w-full flex-col-reverse items-center justify-center gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3"
          >
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
          </div>
        </DialogContent>
      </Dialog>
    </CatalogPageShell>
  )
}
