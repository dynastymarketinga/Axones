"use client"

import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Check, ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow, SupplierRecord } from "@/types/api"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

type PoLineDraft = {
  description: string
  material_id: string
  quantity_ordered: string
  unit: string
  unit_price: string
}

type OcTemplateMap = Record<string, PoLineDraft[]>

function parseDecimalInput(raw: string, emptyAsZero = false): number {
  const t = raw.trim().replace(/\s+/g, "").replace(",", ".")
  if (!t) return emptyAsZero ? 0 : Number.NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
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
  quantity_ordered: "",
  unit: "kg",
  unit_price: "",
})

const OC_PREFS_KEY = "axones_oc_prefs_v1"
const OC_CODE_SEQ_KEY = "axones_oc_code_seq_v1"

/** Misma longitud máxima que `StorePurchaseOrderRequest` (`max:64`). */
const PO_CODE_MAX_LEN = 64

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
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [saving, setSaving] = useState(false)
  const [templatesBySupplier, setTemplatesBySupplier] = useState<OcTemplateMap>({})

  const [supplierId, setSupplierId] = useState("")
  const [code, setCode] = useState("")
  const [codeTouched, setCodeTouched] = useState(false)
  const [orderedAt, setOrderedAt] = useState("")
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

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/ordenes-compra"
  }, [location.state])

  useEffect(() => {
    const raw = window.localStorage.getItem(OC_PREFS_KEY)
    if (!raw) {
      if (!codeTouched && !code.trim()) {
        setCode(buildAutoPoCode())
      }
      return
    }
    try {
      const prefs = JSON.parse(raw) as {
        last_supplier_id?: string
        templates_by_supplier?: OcTemplateMap
      }
      if (prefs.last_supplier_id) setSupplierId(prefs.last_supplier_id)
      setTemplatesBySupplier(prefs.templates_by_supplier ?? {})
    } catch {
      setTemplatesBySupplier({})
    }
    if (!codeTouched && !code.trim()) {
      setCode(buildAutoPoCode())
    }
  }, [code, codeTouched])

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

  useEffect(() => {
    const payload = {
      last_supplier_id: supplierId || "",
      templates_by_supplier: templatesBySupplier,
    }
    window.localStorage.setItem(OC_PREFS_KEY, JSON.stringify(payload))
  }, [supplierId, templatesBySupplier])

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

  const hasTemplateForSelectedSupplier = Boolean(
    supplierId && templatesBySupplier[supplierId]?.length,
  )
  const hasDirtyLines = lines.some(lineHasAnyValue)

  function saveSupplierTemplate() {
    if (!supplierId) {
      toast.error("Seleccione un proveedor para guardar plantilla.")
      return
    }
    const cleanLines = lines
      .filter(lineHasAnyValue)
      .map((line) => ({
        description: line.description.trim(),
        material_id: line.material_id.trim(),
        quantity_ordered: line.quantity_ordered.trim(),
        unit: line.unit.trim() || "kg",
        unit_price: line.unit_price.trim(),
      }))
    if (!cleanLines.length) {
      toast.error("No hay líneas con datos para guardar como plantilla.")
      return
    }
    setTemplatesBySupplier((prev) => ({ ...prev, [supplierId]: cleanLines }))
    toast.success("Plantilla guardada para este proveedor.")
  }

  function applySupplierTemplate() {
    if (!supplierId) {
      toast.error("Seleccione un proveedor para aplicar plantilla.")
      return
    }
    const template = templatesBySupplier[supplierId]
    if (!template?.length) {
      toast.error("Este proveedor no tiene plantilla guardada.")
      return
    }
    if (hasDirtyLines) {
      const ok = window.confirm(
        "Ya hay líneas con datos. ¿Desea reemplazarlas por la plantilla del proveedor?",
      )
      if (!ok) return
    }
    setLineErrors({})
    setFieldErrors((prev) => {
      if (!prev.linesGeneral) return prev
      const next = { ...prev }
      delete next.linesGeneral
      return next
    })
    setLines(template.map((line) => ({ ...emptyLine(), ...line, unit_price: line.unit_price ?? "" })))
    toast.success("Plantilla aplicada.")
  }

  function validatePoForm(): boolean {
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
      if (unitTrim.length > 16) {
        errs.unit = "Máximo 16 caracteres en unidad."
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
          L.unit.length <= 16,
      )

    if (!nextField.linesGeneral && payloadCandidate.length === 0) {
      nextField.linesGeneral =
        "Ninguna línea tiene cantidad válida. Revise cantidad (≥ 0,001), precio y unidad."
    }

    setFieldErrors(nextField)
    setLineErrors(nextLine)

    const ok =
      !nextField.supplier &&
      !nextField.code &&
      !nextField.linesGeneral &&
      Object.keys(nextLine).length === 0 &&
      payloadCandidate.length > 0

    return ok
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()

    if (!validatePoForm()) {
      toast.error("Revise los campos marcados en rojo antes de guardar.")
      return
    }

    const sid = Number(supplierId)

    const payloadLines = lines
      .map((L) => ({
        description: L.description.trim() || null,
        material_id:
          L.material_id && L.material_id !== "none"
            ? Number(L.material_id)
            : null,
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
          L.unit.length <= 16,
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
            Indique proveedor, líneas y condiciones de la compra. La orden queda abierta; Parcial y Completada las marca el
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
                  <span className={cn("truncate text-left", !supplierId && "text-muted-foreground")}>
                    {supplierId
                      ? (() => {
                          const s = suppliers.find((x) => String(x.id) === supplierId)
                          return s ? `${s.name}${s.rif ? ` · ${s.rif}` : ""}` : `#${supplierId}`
                        })()
                      : "Seleccione…"}
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
              aria-describedby={
                fieldErrors.code ? "po-code-error po-code-hint" : "po-code-hint"
              }
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
            <p id="po-code-hint" className="text-muted-foreground text-xs">
              Máximo {PO_CODE_MAX_LEN} caracteres; debe ser único en el sistema.
            </p>
            {fieldErrors.code ? (
              <p id="po-code-error" className="text-destructive text-xs font-medium">
                {fieldErrors.code}
              </p>
            ) : null}
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

        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <Checkbox
            id="po-tax-applies"
            checked={taxApplies}
            onCheckedChange={(v) => setTaxApplies(v === true)}
          />
          <Label htmlFor="po-tax-applies" className="cursor-pointer font-normal leading-snug">
            Aplicar IVA (16&nbsp;%)
          </Label>
        </div>

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
            <div className="grid gap-1">
              <h2 className="text-sm font-medium">Líneas</h2>
              {fieldErrors.linesGeneral ? (
                <p className="text-destructive text-xs font-medium">{fieldErrors.linesGeneral}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Las líneas vacías se ignoran si hay al menos una válida. Si completa una línea (material,
                  descripción o precio), debe indicar cantidad ≥ 0,001.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={saveSupplierTemplate}
                disabled={!supplierId}
              >
                Guardar plantilla
              </Button>
              {hasTemplateForSelectedSupplier ? (
                <Button type="button" size="sm" variant="outline" onClick={applySupplierTemplate}>
                  Aplicar plantilla
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="secondary" onClick={addLine}>
                Añadir línea
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "space-y-3 rounded-xl border p-4",
                  lineErrors[i] && Object.keys(lineErrors[i]).length > 0 && "border-destructive/60 ring-1 ring-destructive/20",
                )}
              >
                <p className="text-muted-foreground text-xs font-medium">Línea {i + 1}</p>
                <div className="grid gap-3 md:grid-cols-12 md:items-end">
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
                  <div className="md:col-span-2 grid gap-2">
                    <Label className="text-xs" htmlFor={`po-line-${i}-qty`}>
                      Cantidad pedida *
                    </Label>
                    <Input
                      id={`po-line-${i}-qty`}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={Boolean(lineErrors[i]?.quantity)}
                      aria-describedby={
                        lineErrors[i]?.quantity ? `po-line-${i}-qty-err` : undefined
                      }
                      value={line.quantity_ordered}
                      onChange={(ev) =>
                        updateLine(i, { quantity_ordered: ev.target.value })
                      }
                      className={cn(lineErrors[i]?.quantity && "border-destructive")}
                    />
                    {lineErrors[i]?.quantity ? (
                      <p id={`po-line-${i}-qty-err`} className="text-destructive text-xs">
                        {lineErrors[i].quantity}
                      </p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2 grid gap-2">
                    <Label className="text-xs" htmlFor={`po-line-${i}-unit`}>
                      Unidad
                    </Label>
                    <Input
                      id={`po-line-${i}-unit`}
                      maxLength={16}
                      value={line.unit}
                      onChange={(ev) => updateLine(i, { unit: ev.target.value })}
                      aria-invalid={Boolean(lineErrors[i]?.unit)}
                      aria-describedby={lineErrors[i]?.unit ? `po-line-${i}-unit-err` : undefined}
                      className={cn(lineErrors[i]?.unit && "border-destructive")}
                    />
                    {lineErrors[i]?.unit ? (
                      <p id={`po-line-${i}-unit-err`} className="text-destructive text-xs">
                        {lineErrors[i].unit}
                      </p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2 grid gap-2">
                    <Label className="text-xs" htmlFor={`po-line-${i}-price`}>
                      Precio unitario (USD)
                    </Label>
                    <Input
                      id={`po-line-${i}-price`}
                      inputMode="decimal"
                      placeholder="0"
                      autoComplete="off"
                      value={line.unit_price}
                      onChange={(ev) =>
                        updateLine(i, { unit_price: ev.target.value })
                      }
                      aria-invalid={Boolean(lineErrors[i]?.unit_price)}
                      aria-describedby={
                        lineErrors[i]?.unit_price ? `po-line-${i}-price-err` : undefined
                      }
                      className={cn(lineErrors[i]?.unit_price && "border-destructive")}
                    />
                    {lineErrors[i]?.unit_price ? (
                      <p id={`po-line-${i}-price-err`} className="text-destructive text-xs">
                        {lineErrors[i].unit_price}
                      </p>
                    ) : null}
                  </div>
                  <div className="md:col-span-1 grid gap-2">
                    <Label className="text-xs">Total línea</Label>
                    <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm tabular-nums">
                      {formatMoneyUsdEs(lineDraftTotal(line))}
                    </div>
                  </div>
                  <div className="flex md:col-span-1 md:justify-end md:pb-1">
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
                  <div className="md:col-span-12 grid gap-2">
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      value={line.description}
                      onChange={(ev) =>
                        updateLine(i, { description: ev.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
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

        <Button type="submit" disabled={saving}>
          <LoadingButtonLabel loading={saving} loadingText="Guardando..." idleText="Crear orden" />
        </Button>
      </form>
    </div>
  )
}
