"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  CalendarDays,
  ClipboardList,
  Hash,
  Layers,
  ScrollText,
  StickyNote,
  Truck,
  UserRound,
} from "lucide-react"

import { DeliveryNotePaletaCard } from "@/components/axones/DeliveryNotePaletaCard"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import {
  corteOperabilityFromForm,
  corteProduccionTabPath,
  explainCannotAddPaleta,
  resolveAgregarPaletasDesdeNotaTarget,
  type CorteOperability,
} from "@/lib/corte-paleta-flow"
import { readRolloKg } from "@/lib/delivery-note-paleta-utils"
import {
  DN_DATE_REQUIRED_HELPER,
  DN_DATE_REQUIRED_TOAST,
  DN_DRIVER_DOC_REQUIRED_HELPER,
  DN_DRIVER_DOC_REQUIRED_TOAST,
  DN_DRIVER_REQUIRED_HELPER,
  DN_DRIVER_REQUIRED_TOAST,
  DN_FIELD_TOAST,
  DN_PALETAS_REQUIRED_HELPER,
  DN_PALETAS_REQUIRED_TOAST,
  DN_PLATE_REQUIRED_HELPER,
  DN_PLATE_REQUIRED_TOAST,
  DN_VEHICLE_REQUIRED_HELPER,
  DN_VEHICLE_REQUIRED_TOAST,
  firstDeliveryNoteFormErrorField,
  hasDeliveryNoteFormErrors,
  todayLocalDateInput,
  validateDeliveryNoteForm,
  type DeliveryNoteFormField,
} from "@/lib/delivery-note-form-validation"
import { apiFetch, ApiError } from "@/lib/api"
import {
  clearDispatchSelection,
  formatDispatchKg,
  mergeDispatchSelection,
  readDispatchSelection,
  sumDispatchSelectionKg,
  type DispatchSelectionItem,
  writeDispatchSelection,
} from "@/lib/dispatch-selection"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const fieldIconClass =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
const notesFieldIconClass =
  "pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
const inputWithIconClass = "h-11 pl-10 bg-background md:text-sm"
const CO_FOCUS_RING =
  "transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:shadow-md focus-visible:ring-primary/35"

function fieldErrorRing(showError: boolean) {
  return showError
    ? "border-destructive bg-destructive/5 focus-visible:ring-destructive"
    : "focus-visible:ring-primary/35"
}

type PrefillLine = {
  pallet_code: string
  bobbin_count: number
  quantity_kg: string
  corte_bobina_usage_id: number
  work_order_id: number
  product_id: number | null
  description: string | null
}

type Prefill = {
  work_order: { id: number; code: string }
  suggested_document_date: string
  next_sequential_number: number
  suggested_lines: PrefillLine[]
  transport: { driver_name: string | null; vehicle_notes: string | null }
}

type EditableLine = PrefillLine & { include: boolean }
type EditableLineWithSource = EditableLine & {
  work_order_code?: string
  client_name?: string
  product_name?: string
  product_cpe?: string
  quantity_finished_kg?: string
  quantity_dispatched_kg?: string
  quantity_remaining_kg?: string
  rollos_kg?: string[]
}

function lineOriginLabel(line: EditableLineWithSource): string {
  if (line.description && line.description.trim() !== "") {
    return line.description
  }
  if (line.work_order_id) {
    return `OT #${line.work_order_id}`
  }
  return "—"
}

function dispatchItemToLine(item: DispatchSelectionItem): EditableLineWithSource {
  return {
    pallet_code: item.pallet_code ?? "",
    bobbin_count: Number(item.bobbin_count ?? 1),
    quantity_kg: String(item.quantity_kg ?? "0.000"),
    corte_bobina_usage_id: Number(item.corte_bobina_usage_id),
    work_order_id: Number(item.work_order_id),
    product_id: item.product_id ? Number(item.product_id) : null,
    description: item.description ?? null,
    work_order_code: item.work_order_code ?? undefined,
    client_name: item.client_name ?? undefined,
    product_name: item.product_name ?? undefined,
    product_cpe: item.product_cpe ?? undefined,
    quantity_finished_kg: item.quantity_finished_kg ?? undefined,
    quantity_dispatched_kg: item.quantity_dispatched_kg ?? undefined,
    quantity_remaining_kg: item.quantity_remaining_kg ?? undefined,
    rollos_kg: item.rollos_kg ? [...item.rollos_kg] : undefined,
    include: Number(item.quantity_kg) > 0,
  }
}

function lineToDispatchItem(line: EditableLineWithSource): DispatchSelectionItem {
  return {
    corte_bobina_usage_id: line.corte_bobina_usage_id,
    work_order_id: line.work_order_id,
    work_order_code: line.work_order_code,
    client_name: line.client_name,
    product_id: line.product_id,
    product_name: line.product_name,
    product_cpe: line.product_cpe,
    description:
      line.description ||
      [
        line.client_name ? `Cliente: ${line.client_name}` : null,
        [line.product_name, line.product_cpe].filter(Boolean).join(" · "),
        line.pallet_code ? `Paleta: ${line.pallet_code}` : null,
      ]
        .filter(Boolean)
        .join(" | ") ||
      "Línea de despacho",
    quantity_finished_kg: line.quantity_finished_kg ?? String(line.quantity_kg),
    quantity_dispatched_kg: line.quantity_dispatched_kg ?? "0.000",
    quantity_remaining_kg: line.quantity_remaining_kg ?? String(line.quantity_kg),
    quantity_kg: String(line.quantity_kg),
    pallet_code: line.pallet_code,
    bobbin_count: line.bobbin_count ?? 1,
    rollos_kg: line.rollos_kg ? [...line.rollos_kg] : undefined,
  }
}

export default function DeliveryNoteCreatePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const fromDispatchSelection = searchParams.get("source") === "despacho-corte"
  const [woId, setWoId] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [lines, setLines] = useState<EditableLineWithSource[]>([])
  const [documentDate, setDocumentDate] = useState("")
  const [sequentialNumber, setSequentialNumber] = useState("")
  const [driverName, setDriverName] = useState("")
  const [driverDocument, setDriverDocument] = useState("")
  const [vehicleName, setVehicleName] = useState("")
  const [vehiclePlate, setVehiclePlate] = useState("")
  const [notes, setNotes] = useState("")
  const [autoloadedFromQuery, setAutoloadedFromQuery] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [dateBlurredInvalid, setDateBlurredInvalid] = useState(false)
  const [driverBlurredInvalid, setDriverBlurredInvalid] = useState(false)
  const [driverDocBlurredInvalid, setDriverDocBlurredInvalid] = useState(false)
  const [vehicleBlurredInvalid, setVehicleBlurredInvalid] = useState(false)
  const [plateBlurredInvalid, setPlateBlurredInvalid] = useState(false)

  const dateRef = useRef<HTMLInputElement>(null)
  const driverRef = useRef<HTMLInputElement>(null)
  const driverDocRef = useRef<HTMLInputElement>(null)
  const vehicleRef = useRef<HTMLInputElement>(null)
  const plateRef = useRef<HTMLInputElement>(null)
  const paletasSectionRef = useRef<HTMLDivElement>(null)
  const dateBlurToastRef = useRef(false)
  const driverBlurToastRef = useRef(false)
  const driverDocBlurToastRef = useRef(false)
  const vehicleBlurToastRef = useRef(false)
  const plateBlurToastRef = useRef(false)

  const includedLines = useMemo(() => lines.filter((l) => l.include), [lines])
  const includedTotalKg = useMemo(
    () => sumDispatchSelectionKg(includedLines.map(lineToDispatchItem)),
    [includedLines],
  )
  const uniqueWorkOrderIds = useMemo(
    () =>
      Array.from(
        new Set(lines.map((l) => l.work_order_id).filter((id) => Number.isFinite(id) && id > 0)),
      ),
    [lines],
  )
  const [corteOpByWo, setCorteOpByWo] = useState<Record<number, CorteOperability>>({})

  const agregarPaletasTarget = useMemo(
    () => resolveAgregarPaletasDesdeNotaTarget(uniqueWorkOrderIds, corteOpByWo),
    [uniqueWorkOrderIds, corteOpByWo],
  )

  useEffect(() => {
    if (!fromDispatchSelection || !uniqueWorkOrderIds.length) {
      setCorteOpByWo({})
      return
    }
    let cancelled = false
    void (async () => {
      const pairs = await Promise.all(
        uniqueWorkOrderIds.map(async (woId) => {
          try {
            const payload = await apiFetch<{ form?: Record<string, unknown> }>(
              `work-orders/${woId}/orden-trabajo`,
            )
            return [woId, corteOperabilityFromForm(payload.form)] as const
          } catch {
            return [woId, corteOperabilityFromForm(null)] as const
          }
        }),
      )
      if (cancelled) return
      const next: Record<number, CorteOperability> = {}
      for (const [woId, op] of pairs) {
        next[woId] = op
      }
      setCorteOpByWo(next)
    })()
    return () => {
      cancelled = true
    }
  }, [fromDispatchSelection, uniqueWorkOrderIds.join(",")])

  function handleAgregarMasPaletas() {
    if (agregarPaletasTarget.kind === "corte") {
      const op = corteOpByWo[agregarPaletasTarget.workOrderId]
      if (op && !op.canAddPaleta) {
        toast.message(agregarPaletasTarget.label, {
          description: explainCannotAddPaleta(op),
          duration: 9000,
        })
      }
      navigate(corteProduccionTabPath(agregarPaletasTarget.workOrderId))
      return
    }
    if (agregarPaletasTarget.reason) {
      toast.message("Corte no disponible para nuevas paletas", {
        description: agregarPaletasTarget.reason,
        duration: 9000,
      })
    }
    navigate("/despacho-corte")
  }

  const loadPrefillById = useCallback(async (id: number) => {
    setLoading(true)
    setPrefill(null)
    try {
      const p = await apiFetch<Prefill>(`work-orders/${id}/nota-entrega/prefill`)
      setPrefill(p)
      setDocumentDate(p.suggested_document_date ?? todayLocalDateInput())
      setSequentialNumber(String(p.next_sequential_number ?? ""))
      setDriverName(p.transport?.driver_name ?? "")
      setDriverDocument("")
      setVehicleName(p.transport?.vehicle_notes ?? "")
      setVehiclePlate("")
      setLines(
        (p.suggested_lines ?? []).map((L) => ({
          ...L,
          include: Number(L.quantity_kg) > 0,
          work_order_code: undefined,
          client_name: undefined,
          product_name: undefined,
          product_cpe: undefined,
          quantity_finished_kg: String(L.quantity_kg),
          quantity_dispatched_kg: "0.000",
          quantity_remaining_kg: String(L.quantity_kg),
        })),
      )
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la información de la orden.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPrefill = useCallback(async () => {
    const id = Number(woId.trim())
    if (!Number.isFinite(id) || id < 1) {
      toast.error("Indique un ID de orden de trabajo válido.")
      return
    }
    await loadPrefillById(id)
  }, [woId, loadPrefillById])

  useEffect(() => {
    if (autoloadedFromQuery) return
    const queryWoId = searchParams.get("woId")?.trim() ?? ""
    const parsed = Number(queryWoId)
    if (!Number.isFinite(parsed) || parsed < 1) return
    setAutoloadedFromQuery(true)
    setWoId(String(parsed))
    void loadPrefillById(parsed)
  }, [searchParams, autoloadedFromQuery, loadPrefillById])

  useEffect(() => {
    if (autoloadedFromQuery && !searchParams.get("woId")) {
      setAutoloadedFromQuery(false)
    }
  }, [autoloadedFromQuery, searchParams])

  useEffect(() => {
    if (searchParams.get("source") !== "despacho-corte") return
    const stored = readDispatchSelection()
    if (!stored.length) return
    setPrefill(null)
    setWoId("")
    setLines((prev) => {
      const merged = mergeDispatchSelection(
        prev.map(lineToDispatchItem),
        stored,
      )
      return merged.map(dispatchItemToLine)
    })
    if (!documentDate.trim()) {
      setDocumentDate(todayLocalDateInput())
    }
  }, [location.key, searchParams])

  useEffect(() => {
    if (!fromDispatchSelection) return
    const included = lines.filter((l) => l.include).map(lineToDispatchItem)
    writeDispatchSelection(included)
  }, [fromDispatchSelection, lines])

  useEffect(() => {
    if (!fromDispatchSelection || !lines.length) return
    const needsRollos = lines.some(
      (l) => !l.rollos_kg?.some((v) => readRolloKg(v) > 0),
    )
    if (!needsRollos) return
    let cancelled = false
    void (async () => {
      try {
        const data = await apiFetch<{
          rows: { corte_bobina_usage_id?: number; rollos_kg?: string[] }[]
        }>("corte-dispatch/available")
        if (cancelled) return
        const byUsage = new Map(
          (data.rows ?? [])
            .filter((r) => r.corte_bobina_usage_id)
            .map((r) => [Number(r.corte_bobina_usage_id), r.rollos_kg ?? []]),
        )
        setLines((prev) =>
          prev.map((line) => {
            if (line.rollos_kg?.some((v) => readRolloKg(v) > 0)) return line
            const rollos = byUsage.get(line.corte_bobina_usage_id)
            return rollos?.length ? { ...line, rollos_kg: rollos } : line
          }),
        )
      } catch {
        /* sin grilla: se muestra resumen numérico */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fromDispatchSelection, location.key, lines.length])

  function updateLine(i: number, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  }

  const formValues = useMemo(
    () => ({
      documentDate,
      driverName,
      driverDocument,
      vehicleName,
      vehiclePlate,
      includedPaletaCount: includedLines.length,
    }),
    [
      documentDate,
      driverName,
      driverDocument,
      vehicleName,
      vehiclePlate,
      includedLines.length,
    ],
  )

  const showDateError =
    (attemptedSubmit && !documentDate.trim()) ||
    (dateBlurredInvalid && !documentDate.trim())
  const showDriverError =
    (attemptedSubmit && !driverName.trim()) ||
    (driverBlurredInvalid && !driverName.trim())
  const showDriverDocError =
    (attemptedSubmit && !driverDocument.trim()) ||
    (driverDocBlurredInvalid && !driverDocument.trim())
  const showVehicleError =
    (attemptedSubmit && !vehicleName.trim()) ||
    (vehicleBlurredInvalid && !vehicleName.trim())
  const showPlateError =
    (attemptedSubmit && !vehiclePlate.trim()) ||
    (plateBlurredInvalid && !vehiclePlate.trim())
  const showNoLinesError = attemptedSubmit && includedLines.length === 0

  function focusInvalidField(field: DeliveryNoteFormField | null) {
    const map: Record<DeliveryNoteFormField, React.RefObject<HTMLElement | null>> = {
      documentDate: dateRef,
      driverName: driverRef,
      driverDocument: driverDocRef,
      vehicleName: vehicleRef,
      vehiclePlate: plateRef,
      paletas: paletasSectionRef,
    }
    if (!field) return
    const el = map[field].current
    if (!el) return
    if ("focus" in el && typeof el.focus === "function") {
      el.focus({ preventScroll: true })
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  function handleRequiredBlur(
    value: string,
    setBlurred: (invalid: boolean) => void,
    toastIssuedRef: React.MutableRefObject<boolean>,
    toastMessage: string,
  ) {
    if (!value.trim()) {
      setBlurred(true)
      if (!toastIssuedRef.current) {
        toastIssuedRef.current = true
        toast.error(toastMessage)
      }
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setAttemptedSubmit(true)

    if (!lines.length) {
      toast.error("No hay líneas disponibles para crear la nota.")
      return
    }

    const errors = validateDeliveryNoteForm(formValues)
    if (hasDeliveryNoteFormErrors(errors)) {
      const first = firstDeliveryNoteFormErrorField(errors)
      if (first) toast.error(DN_FIELD_TOAST[first])
      focusInvalidField(first)
      return
    }

    const seq = sequentialNumber.trim() ? Number(sequentialNumber) : null
    if (seq !== null && (!Number.isFinite(seq) || seq < 1)) {
      toast.error("Número secuencial inválido.")
      return
    }

    const payloadLines = lines
      .filter((L) => L.include)
      .map((L) => ({
        corte_bobina_usage_id: L.corte_bobina_usage_id,
        work_order_id: L.work_order_id,
        product_id: L.product_id ?? undefined,
        description: L.description ?? undefined,
        quantity_kg: Number(L.quantity_kg),
        pallet_code: L.pallet_code || undefined,
        bobbin_count: L.bobbin_count ?? undefined,
      }))
      .filter((L) => Number.isFinite(L.quantity_kg) && L.quantity_kg > 0)

    if (!payloadLines.length) {
      toast.error(DN_PALETAS_REQUIRED_TOAST)
      focusInvalidField("paletas")
      return
    }

    const uniqueWorkOrders = Array.from(
      new Set(payloadLines.map((line) => line.work_order_id).filter(Boolean)),
    )
    const parentWorkOrderId =
      uniqueWorkOrders.length === 1 ? uniqueWorkOrders[0] : null

    const normalizedDriver = driverName.trim()
    const normalizedDocument = driverDocument.trim()
    const normalizedVehicleName = vehicleName.trim()
    const normalizedVehiclePlate = vehiclePlate.trim()
    const mergedDriver = [normalizedDriver, normalizedDocument ? `CI: ${normalizedDocument}` : null]
      .filter(Boolean)
      .join(" · ")
    const mergedVehicle = [normalizedVehicleName, normalizedVehiclePlate]
      .filter(Boolean)
      .join(" · ")

    setSaving(true)
    try {
      const created = await apiFetch<{ id?: number }>("delivery-notes", {
        method: "POST",
        body: JSON.stringify({
          work_order_id: parentWorkOrderId,
          sequential_number: seq,
          document_date: documentDate || null,
          driver_name: mergedDriver,
          vehicle_notes: mergedVehicle || null,
          notes: notes.trim() || null,
          lines: payloadLines,
        }),
      })
      toast.success("Nota de entrega creada.")
      clearDispatchSelection()
      const createdId = Number(created?.id)
      if (Number.isFinite(createdId) && createdId > 0) {
        navigate(`/notas-entrega/${createdId}/vista-previa?from=create`)
      } else {
        navigate("/notas-entrega")
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la nota.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <CatalogPageShell
      title="Nueva nota de entrega"
      subtitle="Genere la nota con el material pendiente de despacho."
      icon={ClipboardList}
      action={
        <Button type="button" variant="outline" asChild>
          <Link to="/notas-entrega" className="inline-flex items-center gap-2">
            <ScrollText className="h-4 w-4 shrink-0" aria-hidden />
            Historial
          </Link>
        </Button>
      }
    >
      {!fromDispatchSelection ? (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-2">
            <Label htmlFor="dn-wo">ID de orden de trabajo</Label>
            <Input
              id="dn-wo"
              inputMode="numeric"
              value={woId}
              onChange={(ev) => setWoId(ev.target.value)}
              placeholder="Ejemplo: 12"
            />
          </div>
          <Button type="button" onClick={() => void loadPrefill()} disabled={loading}>
            {loading ? "…" : "Cargar datos"}
          </Button>
        </div>
      ) : null}

      {prefill || lines.length ? (
        <form noValidate onSubmit={(ev) => void submit(ev)} className="space-y-6">
          <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label
                htmlFor="dn-date"
                className="flex items-center gap-2 text-sm font-medium leading-snug"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                Fecha documento *
              </Label>
              <div className="group/field relative">
                <CalendarDays
                  className={cn(
                    fieldIconClass,
                    showDateError
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={dateRef}
                  id="dn-date"
                  type="date"
                  required
                  aria-required="true"
                  aria-invalid={showDateError}
                  className={cn(inputWithIconClass, CO_FOCUS_RING, fieldErrorRing(showDateError))}
                  value={documentDate}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setDocumentDate(v)
                    if (v.trim()) {
                      setDateBlurredInvalid(false)
                      dateBlurToastRef.current = false
                    }
                  }}
                  onBlur={() =>
                    handleRequiredBlur(
                      documentDate,
                      setDateBlurredInvalid,
                      dateBlurToastRef,
                      DN_DATE_REQUIRED_TOAST,
                    )
                  }
                />
              </div>
              {showDateError ? (
                <p className="text-destructive text-xs">{DN_DATE_REQUIRED_HELPER}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="dn-driver"
                className="flex items-center gap-2 text-sm font-medium leading-snug"
              >
                <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                Conductor *
              </Label>
              <div className="group/field relative">
                <UserRound
                  className={cn(
                    fieldIconClass,
                    showDriverError
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={driverRef}
                  id="dn-driver"
                  aria-required="true"
                  aria-invalid={showDriverError}
                  className={cn(inputWithIconClass, CO_FOCUS_RING, fieldErrorRing(showDriverError))}
                  value={driverName}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setDriverName(v)
                    if (v.trim()) {
                      setDriverBlurredInvalid(false)
                      driverBlurToastRef.current = false
                    }
                  }}
                  onBlur={() =>
                    handleRequiredBlur(
                      driverName,
                      setDriverBlurredInvalid,
                      driverBlurToastRef,
                      DN_DRIVER_REQUIRED_TOAST,
                    )
                  }
                  placeholder="Nombre del conductor"
                />
              </div>
              {showDriverError ? (
                <p className="text-destructive text-xs">{DN_DRIVER_REQUIRED_HELPER}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="dn-driver-doc"
                className="flex items-center gap-2 text-sm font-medium leading-snug"
              >
                <Hash className="h-4 w-4 text-muted-foreground" aria-hidden />
                Cédula del conductor *
              </Label>
              <div className="group/field relative">
                <Hash
                  className={cn(
                    fieldIconClass,
                    showDriverDocError
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={driverDocRef}
                  id="dn-driver-doc"
                  aria-required="true"
                  aria-invalid={showDriverDocError}
                  className={cn(
                    inputWithIconClass,
                    CO_FOCUS_RING,
                    fieldErrorRing(showDriverDocError),
                  )}
                  value={driverDocument}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setDriverDocument(v)
                    if (v.trim()) {
                      setDriverDocBlurredInvalid(false)
                      driverDocBlurToastRef.current = false
                    }
                  }}
                  onBlur={() =>
                    handleRequiredBlur(
                      driverDocument,
                      setDriverDocBlurredInvalid,
                      driverDocBlurToastRef,
                      DN_DRIVER_DOC_REQUIRED_TOAST,
                    )
                  }
                  placeholder="Ej. V-12.345.678"
                />
              </div>
              {showDriverDocError ? (
                <p className="text-destructive text-xs">{DN_DRIVER_DOC_REQUIRED_HELPER}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="dn-vehicle"
                className="flex items-center gap-2 text-sm font-medium leading-snug"
              >
                <Truck className="h-4 w-4 text-muted-foreground" aria-hidden />
                Vehículo *
              </Label>
              <div className="group/field relative">
                <Truck
                  className={cn(
                    fieldIconClass,
                    showVehicleError
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={vehicleRef}
                  id="dn-vehicle"
                  aria-required="true"
                  aria-invalid={showVehicleError}
                  className={cn(inputWithIconClass, CO_FOCUS_RING, fieldErrorRing(showVehicleError))}
                  value={vehicleName}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setVehicleName(v)
                    if (v.trim()) {
                      setVehicleBlurredInvalid(false)
                      vehicleBlurToastRef.current = false
                    }
                  }}
                  onBlur={() =>
                    handleRequiredBlur(
                      vehicleName,
                      setVehicleBlurredInvalid,
                      vehicleBlurToastRef,
                      DN_VEHICLE_REQUIRED_TOAST,
                    )
                  }
                  placeholder="Marca, modelo o descripción"
                />
              </div>
              {showVehicleError ? (
                <p className="text-destructive text-xs">{DN_VEHICLE_REQUIRED_HELPER}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="dn-plate"
                className="flex items-center gap-2 text-sm font-medium leading-snug"
              >
                <Hash className="h-4 w-4 text-muted-foreground" aria-hidden />
                Placa *
              </Label>
              <div className="group/field relative">
                <Hash
                  className={cn(
                    fieldIconClass,
                    showPlateError
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={plateRef}
                  id="dn-plate"
                  aria-required="true"
                  aria-invalid={showPlateError}
                  className={cn(inputWithIconClass, CO_FOCUS_RING, fieldErrorRing(showPlateError))}
                  value={vehiclePlate}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setVehiclePlate(v)
                    if (v.trim()) {
                      setPlateBlurredInvalid(false)
                      plateBlurToastRef.current = false
                    }
                  }}
                  onBlur={() =>
                    handleRequiredBlur(
                      vehiclePlate,
                      setPlateBlurredInvalid,
                      plateBlurToastRef,
                      DN_PLATE_REQUIRED_TOAST,
                    )
                  }
                  placeholder="Ej. ABC-123"
                />
              </div>
              {showPlateError ? (
                <p className="text-destructive text-xs">{DN_PLATE_REQUIRED_HELPER}</p>
              ) : null}
            </div>
            <div className="grid gap-2 md:col-span-3">
              <Label htmlFor="dn-notes" className="text-sm font-medium leading-snug">
                Observaciones
              </Label>
              <div className="group/field relative">
                <StickyNote
                  className={cn(
                    notesFieldIconClass,
                    "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Textarea
                  id="dn-notes"
                  rows={3}
                  className={cn(
                    "min-h-[96px] resize-y bg-background pl-10 pt-2.5",
                    CO_FOCUS_RING,
                    "focus-visible:ring-primary/35",
                  )}
                  value={notes}
                  onChange={(ev) => setNotes(ev.target.value)}
                  placeholder="Notas adicionales para la nota de entrega (opcional)…"
                />
              </div>
            </div>
          </div>

          <div
            ref={paletasSectionRef}
            tabIndex={-1}
            className={cn(
              "rounded-xl border bg-card shadow-sm outline-none",
              showNoLinesError && "border-destructive ring-1 ring-destructive/30",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2.5 text-sm">
              <p>
                Paletas seleccionadas:{" "}
                <span className="font-medium">{includedLines.length}</span>
                {fromDispatchSelection ? (
                  <>
                    {" "}
                    · Total:{" "}
                    <span className="font-medium">{formatDispatchKg(includedTotalKg)}</span>
                  </>
                ) : null}
              </p>
              {fromDispatchSelection ? (
                <div className="flex max-w-md flex-col items-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-2"
                    onClick={handleAgregarMasPaletas}
                  >
                    <Layers className="h-4 w-4 shrink-0" aria-hidden />
                    {agregarPaletasTarget.label}
                  </Button>
                  {agregarPaletasTarget.kind === "despacho" && agregarPaletasTarget.reason ? (
                    <p className="text-muted-foreground text-right text-xs leading-snug">
                      {agregarPaletasTarget.reason}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="grid gap-4 p-2 sm:grid-cols-1 lg:grid-cols-2">
              {lines.map((L, i) => (
                <DeliveryNotePaletaCard
                  key={`${L.corte_bobina_usage_id}-${i}`}
                  paletaLabel={L.pallet_code || `Paleta ${String(i + 1).padStart(2, "0")}`}
                  workOrderCode={L.work_order_code ?? `OT-${L.work_order_id}`}
                  clientName={L.client_name ?? lineOriginLabel(L)}
                  productName={L.product_name}
                  productCpe={L.product_cpe}
                  rollosKg={L.rollos_kg}
                  quantityKg={L.quantity_remaining_kg ?? L.quantity_kg}
                  included={L.include}
                  onIncludeChange={(checked) => updateLine(i, { include: checked })}
                />
              ))}
            </div>
            {showNoLinesError ? (
              <p className="border-t px-4 py-2 text-destructive text-xs">
                {DN_PALETAS_REQUIRED_HELPER}
              </p>
            ) : null}
          </div>

          <Button type="submit" className="h-11" disabled={saving}>
            <LoadingButtonLabel
              loading={saving}
              loadingText="Creando…"
              idleText="Crear nota de entrega"
            />
          </Button>
        </form>
      ) : null}
    </CatalogPageShell>
  )
}
