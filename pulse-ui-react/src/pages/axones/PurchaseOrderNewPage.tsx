"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Check, ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, SupplierRecord } from "@/types/api"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type PoLineDraft = {
  description: string
  material_id: string
  item_type: "sustrato" | "tinta" | "quimico" | "otros"
  micras: string
  ancho_mm: string
  quantity_ordered: string
  unit: string
  unit_price: string
}

const ADD_ARTICLE_TOOLTIP_LINES = [
  "Las filas vacías se omiten si hay al menos una válida.",
  "Si completa material, descripción o precio en una fila, indique cantidad ≥ 0,001.",
  "Este botón añade otra fila al pedido.",
] as const

function parseDecimalInput(raw: string, emptyAsZero = false): number {
  const t = raw.trim().replace(/\s+/g, "").replace(",", ".")
  if (!t) return emptyAsZero ? 0 : Number.NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

/** Fecha local en formato `YYYY-MM-DD` para `<input type="date">`. */
function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Unidades alineadas con recepción de inventario (`StorePurchaseReceiptRequest`). */
const PO_LINE_UNITS = ["kg", "unidad", "m", "rollo", "otros"] as const
type PoLineUnit = (typeof PO_LINE_UNITS)[number]

function isPoLineUnit(u: string): u is PoLineUnit {
  return (PO_LINE_UNITS as readonly string[]).includes(u)
}

/**
 * Solo dígitos y un separador decimal (`.` o `,` → se guarda `.` en estado).
 * Máximo `maxFracDigits` decimales tras el separador.
 */
function sanitizePositiveDecimalInput(raw: string, maxFracDigits: number): string {
  let out = ""
  let hasSep = false
  let fracCount = 0
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (hasSep) {
        if (fracCount >= maxFracDigits) continue
        fracCount++
      }
      out += ch
      continue
    }
    if ((ch === "." || ch === ",") && !hasSep) {
      hasSep = true
      out += "."
    }
  }
  return out
}

function formatMoneyUsdEs(value: number): string {
  return `${new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} $`
}

const emptyLine = (): PoLineDraft => ({
  description: "",
  material_id: "",
  item_type: "sustrato",
  micras: "",
  ancho_mm: "",
  quantity_ordered: "",
  unit: "kg" satisfies PoLineUnit,
  unit_price: "",
})

const PO_ITEM_TYPES: { value: PoLineDraft["item_type"]; label: string; hideDims: boolean }[] = [
  { value: "sustrato", label: "Sustrato", hideDims: false },
  { value: "tinta", label: "Tinta", hideDims: true },
  { value: "quimico", label: "Químico", hideDims: true },
  { value: "otros", label: "Otros", hideDims: false },
] as const

function shouldHideDims(itemType: PoLineDraft["item_type"]) {
  return itemType === "tinta" || itemType === "quimico"
}

function buildLineDescription(line: PoLineDraft): string | null {
  const base = line.description.trim()
  const micras = line.micras.trim()
  const ancho = line.ancho_mm.trim()
  const parts: string[] = []
  if (base) parts.push(base)
  // Guardar tipo y dimensiones como referencia para Recepción (sin tocar esquema BD).
  parts.push(`Tipo: ${line.item_type}`)
  if (!shouldHideDims(line.item_type)) {
    if (micras) parts.push(`Micras: ${micras}`)
    if (ancho) parts.push(`Ancho(mm): ${ancho}`)
  }
  const out = parts.join(" | ").trim()
  return out ? out : null
}

const OC_CODE_SEQ_KEY = "axones_oc_code_seq_v1"

/** Misma longitud máxima que `StorePurchaseOrderRequest` (`max:64`). */
const PO_CODE_MAX_LEN = 64

const PURCHASE_ORDER_NEW_DRAFT_KEY = "axones:purchase-order-new-draft"

type PurchaseOrderNewDraftV1 = {
  v: 1
  supplierId: string
  code: string
  codeTouched: boolean
  orderedAt: string
  notes: string
  taxApplies: boolean
  lines: PoLineDraft[]
}

/** Alinea micras/ancho si el tipo oculta dimensiones (mismo criterio que al editar en UI). */
function normalizeLineByBusinessRules(line: PoLineDraft): PoLineDraft {
  const hide = shouldHideDims(line.item_type)
  return {
    ...line,
    ...(hide ? { micras: "", ancho_mm: "" } : {}),
  }
}

function normalizePoLineDraftFromStorage(raw: unknown): PoLineDraft {
  if (!raw || typeof raw !== "object") return emptyLine()
  const r = raw as Partial<PoLineDraft>
  const it = r.item_type
  const item_type: PoLineDraft["item_type"] =
    it === "sustrato" || it === "tinta" || it === "quimico" || it === "otros" ? it : "sustrato"
  const u = typeof r.unit === "string" ? r.unit.trim() : ""
  const unit: PoLineUnit = isPoLineUnit(u) ? u : "kg"
  return normalizeLineByBusinessRules({
    description: typeof r.description === "string" ? r.description : "",
    material_id: typeof r.material_id === "string" ? r.material_id : "",
    item_type,
    micras: typeof r.micras === "string" ? r.micras : "",
    ancho_mm: typeof r.ancho_mm === "string" ? r.ancho_mm : "",
    quantity_ordered: typeof r.quantity_ordered === "string" ? r.quantity_ordered : "",
    unit,
    unit_price: typeof r.unit_price === "string" ? r.unit_price : "",
  })
}

type PoFieldErrors = {
  supplier?: string
  code?: string
  linesGeneral?: string
}

type PoLineFieldErrors = {
  quantity?: string
  unit_price?: string
  unit?: string
}

function buildAutoPoCode(): string {
  const year = new Date().getFullYear()
  const seqRaw = window.localStorage.getItem(OC_CODE_SEQ_KEY)
  const seqMap = seqRaw ? (JSON.parse(seqRaw) as Record<string, number>) : {}
  const next = (seqMap[String(year)] ?? 0) + 1
  seqMap[String(year)] = next
  window.localStorage.setItem(OC_CODE_SEQ_KEY, JSON.stringify(seqMap))
  return `OC-${year}-${String(next).padStart(3, "0")}`
}

function lineHasAnyValue(line: PoLineDraft): boolean {
  const price = parseDecimalInput(line.unit_price, true)
  return Boolean(
    line.description.trim() ||
      line.material_id.trim() ||
      line.micras.trim() ||
      line.ancho_mm.trim() ||
      line.quantity_ordered.trim() ||
      line.unit.trim() !== "kg" ||
      (Number.isFinite(price) && price > 0),
  )
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100
}

function lineDraftTotal(line: PoLineDraft): number {
  const q = parseDecimalInput(line.quantity_ordered)
  const p = parseDecimalInput(line.unit_price, true)
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0) return 0
  return roundMoney2(q * p)
}

export default function PurchaseOrderNewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [supplierListReady, setSupplierListReady] = useState(false)
  const [resolvingSupplier, setResolvingSupplier] = useState(false)
  const supplierResolveFailedForRef = useRef<string | null>(null)

  const [supplierId, setSupplierId] = useState("")
  const [code, setCode] = useState("")
  const [codeTouched, setCodeTouched] = useState(false)
  const [orderedAt, setOrderedAt] = useState(() => toDateInputValue(new Date()))
  const [notes, setNotes] = useState("")
  const [taxApplies, setTaxApplies] = useState(true)
  const [lines, setLines] = useState<PoLineDraft[]>([emptyLine()])
  const [fieldErrors, setFieldErrors] = useState<PoFieldErrors>({})
  const [lineErrors, setLineErrors] = useState<Record<number, PoLineFieldErrors>>({})

  const selectedSupplier = useMemo(
    () => suppliers.find((x) => String(x.id) === supplierId) ?? null,
    [suppliers, supplierId],
  )

  const monetaryTotals = useMemo(() => {
    let subtotal = 0
    for (const line of lines) {
      subtotal += lineDraftTotal(line)
    }
    subtotal = roundMoney2(subtotal)
    const tax = taxApplies ? roundMoney2(subtotal * 0.16) : 0
    return { subtotal, tax, total: roundMoney2(subtotal + tax) }
  }, [lines, taxApplies])

  const supplierTriggerDisplay = useMemo(() => {
    if (!supplierId.trim()) return { text: "Seleccione…", muted: true }
    if (selectedSupplier) {
      const name = selectedSupplier.name?.trim() || "Sin nombre"
      return {
        text: `${name}${selectedSupplier.rif ? ` · ${selectedSupplier.rif}` : ""}`,
        muted: false,
      }
    }
    if (!supplierListReady) return { text: "Cargando…", muted: true }
    if (resolvingSupplier) return { text: "Cargando proveedor…", muted: true }
    return {
      text: "Abra la lista y elija el proveedor de nuevo.",
      muted: true,
    }
  }, [
    supplierId,
    selectedSupplier,
    supplierListReady,
    resolvingSupplier,
  ])

  const navState = location.state as { from?: string; presetSupplierId?: number } | null
  const presetSupplierConsumedRef = useRef(false)

  const returnTo = useMemo(() => {
    const from = navState?.from?.trim()
    return from && from.startsWith("/") ? from : "/ordenes-compra"
  }, [navState?.from])

  function savePoDraftToSession(): boolean {
    const draft: PurchaseOrderNewDraftV1 = {
      v: 1,
      supplierId,
      code,
      codeTouched,
      orderedAt,
      notes,
      taxApplies,
      lines,
    }
    try {
      sessionStorage.setItem(PURCHASE_ORDER_NEW_DRAFT_KEY, JSON.stringify(draft))
      return true
    } catch {
      toast.error("No se pudo guardar el borrador del formulario. Intente de nuevo.")
      return false
    }
  }

  function persistPoDraftAndGoToNewSupplier() {
    if (!savePoDraftToSession()) return
    navigate("/proveedores/form", { state: { from: "/ordenes-compra/nueva" } })
  }

  useEffect(() => {
    if (!codeTouched && !code.trim()) {
      setCode(buildAutoPoCode())
    }
  }, [code, codeTouched])

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const supRes = await apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
          query: { per_page: 100, page: 1 },
        })
        if (!c) {
          setSuppliers(supRes.data)
          setSupplierListReady(true)
        }
      } catch {
        if (!c) {
          setSuppliers([])
          setSupplierListReady(true)
        }
      }
    })()
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    if (!supplierListReady) return
    if (presetSupplierConsumedRef.current) return
    const pid = navState?.presetSupplierId
    if (!Number.isFinite(pid) || (pid ?? 0) < 1) return
    presetSupplierConsumedRef.current = true
    setSupplierId(String(pid))
  }, [supplierListReady, navState?.presetSupplierId])

  useEffect(() => {
    const proveedorRaw = searchParams.get("proveedor")
    const proveedorNum = proveedorRaw ? Number(proveedorRaw) : NaN
    const hasProveedor = Number.isFinite(proveedorNum) && proveedorNum > 0
    if (!hasProveedor) return

    let parsed: PurchaseOrderNewDraftV1 | null = null
    try {
      const raw = sessionStorage.getItem(PURCHASE_ORDER_NEW_DRAFT_KEY)
      if (raw) {
        const data = JSON.parse(raw) as Partial<PurchaseOrderNewDraftV1>
        if (data?.v === 1) parsed = data as PurchaseOrderNewDraftV1
      }
    } catch {
      parsed = null
    }

    setSupplierId(String(proveedorNum))
    supplierResolveFailedForRef.current = null
    setFieldErrors({})
    setLineErrors({})

    if (parsed) {
      setCode(typeof parsed.code === "string" ? parsed.code : "")
      setCodeTouched(Boolean(parsed.codeTouched))
      setOrderedAt(
        typeof parsed.orderedAt === "string" && parsed.orderedAt
          ? parsed.orderedAt
          : toDateInputValue(new Date()),
      )
      setNotes(typeof parsed.notes === "string" ? parsed.notes : "")
      setTaxApplies(typeof parsed.taxApplies === "boolean" ? parsed.taxApplies : true)
      if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
        setLines(parsed.lines.map((row) => normalizePoLineDraftFromStorage(row)))
      } else {
        setLines([emptyLine()])
      }
    }

    void (async () => {
      try {
        const one = await apiFetch<SupplierRecord>(`suppliers/${proveedorNum}`)
        setSuppliers((prev) => {
          if (prev.some((s) => s.id === one.id)) return prev
          return [...prev, one].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        })
      } catch {
        /* el combo puede mostrar vacío hasta recargar */
      }
    })()

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("proveedor")
        return next
      },
      { replace: true },
    )

    if (parsed) {
      try {
        sessionStorage.removeItem(PURCHASE_ORDER_NEW_DRAFT_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    supplierResolveFailedForRef.current = null
  }, [supplierId])

  useEffect(() => {
    if (!supplierListReady || !supplierId.trim()) return
    const sid = Number(supplierId)
    if (!Number.isFinite(sid) || sid < 1) return
    if (suppliers.some((s) => String(s.id) === supplierId)) return
    if (supplierResolveFailedForRef.current === supplierId) return

    let cancelled = false
    setResolvingSupplier(true)
    void (async () => {
      try {
        const rec = await apiFetch<SupplierRecord>(`suppliers/${sid}`)
        if (cancelled) return
        setSuppliers((prev) =>
          prev.some((p) => p.id === rec.id) ? prev : [...prev, rec],
        )
      } catch {
        if (!cancelled) {
          supplierResolveFailedForRef.current = supplierId
          toast.error("No se pudo cargar el proveedor guardado. Elija otro en la lista.")
        }
      } finally {
        if (!cancelled) setResolvingSupplier(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supplierListReady, supplierId, suppliers])

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function updateLine(i: number, patch: Partial<PoLineDraft>) {
    setLineErrors((prev) => {
      if (!prev[i]) return prev
      const next = { ...prev }
      delete next[i]
      return next
    })
    setLines((prev) =>
      prev.map((row, j) => (j === i ? { ...row, ...patch } : row)),
    )
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, j) => j !== i))
    setLineErrors((prev) => {
      const next: Record<number, PoLineFieldErrors> = {}
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k)
        if (!Number.isFinite(idx)) continue
        if (idx === i) continue
        next[idx > i ? idx - 1 : idx] = v
      }
      return next
    })
  }

  function computePurchaseOrderValidation(): {
    ok: boolean
    fieldErrors: PoFieldErrors
    lineErrors: Record<number, PoLineFieldErrors>
  } {
    const nextField: PoFieldErrors = {}
    const nextLine: Record<number, PoLineFieldErrors> = {}

    const sid = Number(supplierId)
    if (!Number.isFinite(sid) || sid < 1) {
      nextField.supplier = "Seleccione un proveedor."
    }

    const codeTrim = code.trim()
    if (!codeTrim) {
      nextField.code = "El código único es obligatorio."
    } else if (codeTrim.length > PO_CODE_MAX_LEN) {
      nextField.code = `Como máximo ${PO_CODE_MAX_LEN} caracteres (coincide con el servidor).`
    }

    const editedRowIndexes = lines
      .map((line, idx) => (lineHasAnyValue(line) ? idx : -1))
      .filter((idx) => idx >= 0)

    if (editedRowIndexes.length === 0) {
      nextField.linesGeneral =
        "Agregue al menos una línea con cantidad mayor a cero (y completada según corresponda)."
    }

    for (const i of editedRowIndexes) {
      const L = lines[i]
      const errs: PoLineFieldErrors = {}
      const qty = parseDecimalInput(L.quantity_ordered)
      if (!Number.isFinite(qty) || qty < 0.001) {
        errs.quantity =
          "Use un número mayor o igual a 0,001 (coma o punto decimal). Ej.: 10 o 10,5."
      }
      const priceRaw = L.unit_price.trim()
      if (priceRaw !== "") {
        const pr = parseDecimalInput(priceRaw)
        if (!Number.isFinite(pr) || pr < 0) {
          errs.unit_price = "Precio inválido. Indique un número ≥ 0."
        }
      }
      const unitTrim = L.unit.trim() || "kg"
      if (!isPoLineUnit(unitTrim)) {
        errs.unit = "Seleccione una unidad válida."
      }
      if (Object.keys(errs).length) nextLine[i] = errs
    }

    const payloadCandidate = lines
      .map((L) => ({
        quantity_ordered: parseDecimalInput(L.quantity_ordered),
        unit_price: parseDecimalInput(L.unit_price, true),
        unit: L.unit.trim() || "kg",
      }))
      .filter(
        (L) =>
          Number.isFinite(L.quantity_ordered) &&
          L.quantity_ordered >= 0.001 &&
          Number.isFinite(L.unit_price) &&
          L.unit_price >= 0 &&
          isPoLineUnit(L.unit.trim() || "kg"),
      )

    if (!nextField.linesGeneral && payloadCandidate.length === 0) {
      nextField.linesGeneral =
        "Ninguna línea tiene cantidad válida. Revise cantidad (≥ 0,001), precio y unidad."
    }

    const ok =
      !nextField.supplier &&
      !nextField.code &&
      !nextField.linesGeneral &&
      Object.keys(nextLine).length === 0 &&
      payloadCandidate.length > 0

    return { ok, fieldErrors: nextField, lineErrors: nextLine }
  }

  function toastPurchaseOrderValidationErrors(
    field: PoFieldErrors,
    lineErrs: Record<number, PoLineFieldErrors>,
  ) {
    if (field.supplier) toast.error(`Proveedor: ${field.supplier}`)
    if (field.code) toast.error(`Código: ${field.code}`)
    if (field.linesGeneral) toast.error(`Artículos: ${field.linesGeneral}`)
    const rowIndexes = Object.keys(lineErrs)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    for (const i of rowIndexes) {
      const row = lineErrs[i]
      const n = i + 1
      if (row.quantity) toast.error(`Ítem ${n} · Cantidad: ${row.quantity}`)
      if (row.unit_price) toast.error(`Ítem ${n} · Precio: ${row.unit_price}`)
      if (row.unit) toast.error(`Ítem ${n} · Unidad: ${row.unit}`)
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()

    const validation = computePurchaseOrderValidation()
    setFieldErrors(validation.fieldErrors)
    setLineErrors(validation.lineErrors)
    if (!validation.ok) {
      toastPurchaseOrderValidationErrors(validation.fieldErrors, validation.lineErrors)
      return
    }

    const sid = Number(supplierId)

    const payloadLines = lines
      .map((L) => ({
        description: buildLineDescription(L),
        material_id: null,
        quantity_ordered: parseDecimalInput(L.quantity_ordered),
        unit: L.unit.trim() || "kg",
        unit_price: parseDecimalInput(L.unit_price, true),
      }))
      .filter(
        (L) =>
          Number.isFinite(L.quantity_ordered) &&
          L.quantity_ordered >= 0.001 &&
          Number.isFinite(L.unit_price) &&
          L.unit_price >= 0 &&
          isPoLineUnit(L.unit.trim() || "kg"),
      )

    setSaving(true)
    try {
      await apiFetch("purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: sid,
          code: code.trim(),
          ordered_at: orderedAt || null,
          notes: notes.trim() || null,
          tax_applies: taxApplies,
          lines: payloadLines,
        }),
      })
      toast.success("Orden de compra creada.")
      try {
        sessionStorage.removeItem(PURCHASE_ORDER_NEW_DRAFT_KEY)
      } catch {
        /* ignore */
      }
      navigate(returnTo)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la OC.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nueva orden de compra
          </h1>
          <p className="text-muted-foreground text-sm">
            Indique proveedor, artículos y condiciones de la compra. La orden queda abierta; Parcial y Completada las marca el
            inventario al recibir.
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to={returnTo}>Volver al listado</Link>
        </Button>
      </div>

      <form
        noValidate
        onSubmit={(ev) => void submit(ev)}
        className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="po-supplier-trigger">Proveedor *</Label>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="po-supplier-trigger"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={supplierOpen}
                      aria-invalid={Boolean(fieldErrors.supplier)}
                      aria-describedby={fieldErrors.supplier ? "po-supplier-error" : undefined}
                      className={cn(
                        "h-10 w-full justify-between font-normal",
                        "border-primary/25 bg-background/90",
                        fieldErrors.supplier && "border-destructive ring-1 ring-destructive/40",
                      )}
                    >
                      <span
                        className={cn(
                          "truncate text-left",
                          supplierTriggerDisplay.muted && "text-muted-foreground",
                        )}
                      >
                        {supplierTriggerDisplay.text}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
                  align="start"
                >
                  <Command shouldFilter>
                    <CommandInput placeholder="Buscar proveedor..." />
                    <CommandList className="max-h-60">
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        {suppliers.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.name} ${s.rif ?? ""}`}
                            onSelect={() => {
                              supplierResolveFailedForRef.current = null
                              setSupplierId(String(s.id))
                              setSupplierOpen(false)
                              setFieldErrors((prev) => {
                                if (!prev.supplier) return prev
                                const next = { ...prev }
                                delete next.supplier
                                return next
                              })
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                String(s.id) === supplierId ? "opacity-100" : "opacity-0",
                              )}
                              aria-hidden
                            />
                            <span className="truncate">{s.name}</span>
                            {s.rif ? (
                              <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                                {s.rif}
                              </span>
                            ) : null}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => persistPoDraftAndGoToNewSupplier()}
                disabled={saving}
              >
                + Nuevo
              </Button>
            </div>
            {fieldErrors.supplier ? (
              <p id="po-supplier-error" className="text-destructive text-xs font-medium">
                {fieldErrors.supplier}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="po-code">Código único *</Label>
            <Input
              id="po-code"
              value={code}
              required
              maxLength={PO_CODE_MAX_LEN}
              aria-invalid={Boolean(fieldErrors.code)}
              aria-describedby={fieldErrors.code ? "po-code-error" : undefined}
              onChange={(ev) => {
                setCodeTouched(true)
                setCode(ev.target.value)
                setFieldErrors((prev) => {
                  if (!prev.code) return prev
                  const next = { ...prev }
                  delete next.code
                  return next
                })
              }}
              placeholder="ej. OC-2026-001"
            />
            {fieldErrors.code ? (
              <p id="po-code-error" className="text-destructive text-xs font-medium">
                {fieldErrors.code}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid w-full max-w-full gap-2 sm:w-auto sm:max-w-[11rem]">
            <Label htmlFor="po-date">Fecha pedido</Label>
            <Input
              id="po-date"
              type="date"
              value={orderedAt}
              onChange={(ev) => setOrderedAt(ev.target.value)}
              className="min-w-0"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5 sm:pb-[2px]">
            <Checkbox
              id="po-tax-applies"
              checked={taxApplies}
              onCheckedChange={(v) => setTaxApplies(v === true)}
            />
            <Label htmlFor="po-tax-applies" className="cursor-pointer font-normal leading-snug">
              Aplicar IVA (16&nbsp;%)
            </Label>
          </div>
        </div>

        {supplierId && selectedSupplier ? (
          <div className="rounded-xl border border-primary/15 bg-muted/30 p-4 text-sm">
            <p className="font-medium text-foreground">Dirección del proveedor</p>
            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
              {selectedSupplier.address?.trim() || "Sin dirección registrada en el proveedor."}
            </p>
            {!selectedSupplier.address?.trim() ? (
              <Link
                to={`/proveedores/form?id=${supplierId}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="text-primary mt-2 inline-block text-xs underline underline-offset-4"
              >
                Registrar dirección del proveedor
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="po-notes">Notas / observación (PDF)</Label>
          <Textarea
            id="po-notes"
            rows={2}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="grid min-w-0 gap-1">
              <h2 className="text-sm font-medium">Artículos del pedido</h2>
              {fieldErrors.linesGeneral ? (
                <p className="text-destructive text-xs font-medium">{fieldErrors.linesGeneral}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={addLine}
              title={ADD_ARTICLE_TOOLTIP_LINES.join(" ")}
            >
              Agregar ítem
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            {/* Ítems: la OC es solicitud (texto); el alta real ocurre en Recepción. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">N°</TableHead>
                  <TableHead className="min-w-[260px]">Material solicitado</TableHead>
                  <TableHead className="w-36">Tipo</TableHead>
                  <TableHead className="w-24">Micras</TableHead>
                  <TableHead className="w-24">Ancho</TableHead>
                  <TableHead className="w-32">Cantidad pedida *</TableHead>
                  <TableHead className="w-36">Unidad</TableHead>
                  <TableHead className="w-36">Precio unitario (USD)</TableHead>
                  <TableHead className="w-32">Total línea</TableHead>
                  <TableHead className="w-20 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, i) => {
                  const rowErr = lineErrors[i]
                  const rowHasError = Boolean(rowErr && Object.keys(rowErr).length > 0)
                  return (
                    <Fragment key={i}>
                      <TableRow
                        id={`po-line-row-${i}`}
                        className={cn(rowHasError && "bg-red-50/40")}
                      >
                        <TableCell className="align-top">
                          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                            {i + 1}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            id={`po-line-${i}-requested`}
                            value={line.description}
                            onChange={(ev) => {
                              const next = ev.target.value
                              updateLine(i, { description: next, material_id: "" })
                            }}
                            placeholder="Ej: BOPP transparente 20 micras 520 mm"
                            aria-label={`Material solicitado, fila ${i + 1}`}
                            disabled={saving}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Select
                            value={line.item_type}
                            disabled={saving}
                            onValueChange={(v) => {
                              const next = v as PoLineDraft["item_type"]
                              const hide = shouldHideDims(next)
                              updateLine(i, {
                                item_type: next,
                                ...(hide ? { micras: "", ancho_mm: "" } : {}),
                              })
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {PO_ITEM_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            inputMode="numeric"
                            value={line.micras}
                            onChange={(ev) => updateLine(i, { micras: sanitizePositiveDecimalInput(ev.target.value, 3) })}
                            placeholder="µ"
                            disabled={saving || shouldHideDims(line.item_type)}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            inputMode="numeric"
                            value={line.ancho_mm}
                            onChange={(ev) => updateLine(i, { ancho_mm: sanitizePositiveDecimalInput(ev.target.value, 3) })}
                            placeholder="mm"
                            disabled={saving || shouldHideDims(line.item_type)}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="grid gap-1">
                            <Input
                              id={`po-line-${i}-qty`}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`Cantidad pedida, fila ${i + 1}`}
                              aria-invalid={Boolean(lineErrors[i]?.quantity)}
                              aria-describedby={
                                lineErrors[i]?.quantity ? `po-line-${i}-qty-err` : undefined
                              }
                              value={line.quantity_ordered}
                              onChange={(ev) =>
                                updateLine(i, {
                                  quantity_ordered: sanitizePositiveDecimalInput(
                                    ev.target.value,
                                    6,
                                  ),
                                })
                              }
                              className={cn(lineErrors[i]?.quantity && "border-destructive")}
                            />
                            {lineErrors[i]?.quantity ? (
                              <p id={`po-line-${i}-qty-err`} className="text-destructive text-xs">
                                {lineErrors[i].quantity}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="grid gap-1">
                            <Select
                              value={
                                isPoLineUnit(line.unit.trim()) ? line.unit.trim() : "kg"
                              }
                              onValueChange={(v) =>
                                updateLine(i, { unit: v as PoLineUnit })
                              }
                            >
                              <SelectTrigger
                                id={`po-line-${i}-unit`}
                                className={cn(
                                  "h-9",
                                  lineErrors[i]?.unit && "border-destructive ring-1 ring-destructive/40",
                                )}
                                aria-label={`Unidad, fila ${i + 1}`}
                                aria-invalid={Boolean(lineErrors[i]?.unit)}
                                aria-describedby={
                                  lineErrors[i]?.unit ? `po-line-${i}-unit-err` : undefined
                                }
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="unidad">Unidad</SelectItem>
                                <SelectItem value="m">m</SelectItem>
                                <SelectItem value="rollo">Rollo</SelectItem>
                                <SelectItem value="otros">Otros</SelectItem>
                              </SelectContent>
                            </Select>
                            {lineErrors[i]?.unit ? (
                              <p id={`po-line-${i}-unit-err`} className="text-destructive text-xs">
                                {lineErrors[i].unit}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="grid gap-1">
                            <Input
                              id={`po-line-${i}-price`}
                              inputMode="decimal"
                              placeholder="0"
                              autoComplete="off"
                              aria-label={`Precio unitario USD, fila ${i + 1}`}
                              aria-invalid={Boolean(lineErrors[i]?.unit_price)}
                              aria-describedby={
                                lineErrors[i]?.unit_price ? `po-line-${i}-price-err` : undefined
                              }
                              value={line.unit_price}
                              onChange={(ev) =>
                                updateLine(i, {
                                  unit_price: sanitizePositiveDecimalInput(
                                    ev.target.value,
                                    6,
                                  ),
                                })
                              }
                              className={cn(lineErrors[i]?.unit_price && "border-destructive")}
                            />
                            {lineErrors[i]?.unit_price ? (
                              <p id={`po-line-${i}-price-err`} className="text-destructive text-xs">
                                {lineErrors[i].unit_price}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm tabular-nums">
                            {formatMoneyUsdEs(lineDraftTotal(line))}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-start justify-end">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-base font-semibold leading-none text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={lines.length <= 1}
                              onClick={() => removeLine(i)}
                              aria-label={`Eliminar fila ${i + 1}`}
                              title={`Eliminar fila ${i + 1}`}
                            >
                              ×
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <h3 className="text-sm font-medium">Resumen</h3>
          <dl className="mt-3 space-y-2 text-sm tabular-nums">
            <div className="flex justify-between gap-6 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatMoneyUsdEs(monetaryTotals.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-6 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">
                {taxApplies ? "IVA (16 %)" : "Sin IVA"}
              </dt>
              <dd>{formatMoneyUsdEs(monetaryTotals.tax)}</dd>
            </div>
            <div className="flex justify-between gap-6 pt-1 font-semibold">
              <dt>Total</dt>
              <dd>{formatMoneyUsdEs(monetaryTotals.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex w-full justify-center pt-1">
          <Button type="submit" disabled={saving} className="min-w-[10rem]">
            <LoadingButtonLabel
              loading={saving}
              loadingText="Guardando..."
              idleText="Crear orden"
            />
          </Button>
        </div>
      </form>
      </div>
    </>
  )
}
