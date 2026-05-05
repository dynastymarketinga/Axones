"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
type DispatchSelectionItem = {
  corte_bobina_usage_id: number
  work_order_id: number
  work_order_code?: string
  client_name?: string
  product_id: number | null
  product_name?: string
  product_cpe?: string
  description: string
  quantity_finished_kg?: string
  quantity_dispatched_kg?: string
  quantity_remaining_kg?: string
  quantity_kg: string
  pallet_code: string
  bobbin_count: number
}

type EditableLineWithSource = EditableLine & {
  work_order_code?: string
  client_name?: string
  product_name?: string
  product_cpe?: string
  quantity_finished_kg?: string
  quantity_dispatched_kg?: string
  quantity_remaining_kg?: string
}

const DISPATCH_SELECTION_KEY = "axones.dispatch.selection.v1"

function lineOriginLabel(line: EditableLineWithSource): string {
  if (line.description && line.description.trim() !== "") {
    return line.description
  }
  if (line.work_order_id) {
    return `OT #${line.work_order_id}`
  }
  return "—"
}

export default function DeliveryNoteCreatePage() {
  const navigate = useNavigate()
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
  const [loadedFromDispatchSelection, setLoadedFromDispatchSelection] =
    useState(false)

  const loadPrefillById = useCallback(async (id: number) => {
    setLoading(true)
    setPrefill(null)
    try {
      const p = await apiFetch<Prefill>(`work-orders/${id}/nota-entrega/prefill`)
      setPrefill(p)
      setDocumentDate(p.suggested_document_date ?? "")
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
    if (loadedFromDispatchSelection) return
    if (searchParams.get("source") !== "despacho-corte") return
    const raw = sessionStorage.getItem(DISPATCH_SELECTION_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as DispatchSelectionItem[]
      if (!Array.isArray(parsed) || !parsed.length) return
      setLoadedFromDispatchSelection(true)
      setPrefill(null)
      setLines(
        parsed.map((line) => ({
          pallet_code: line.pallet_code ?? "",
          bobbin_count: Number(line.bobbin_count ?? 1),
          quantity_kg: String(line.quantity_kg ?? "0.000"),
          corte_bobina_usage_id: Number(line.corte_bobina_usage_id),
          work_order_id: Number(line.work_order_id),
          product_id: line.product_id ? Number(line.product_id) : null,
          description: line.description ?? null,
          work_order_code: line.work_order_code ?? undefined,
          client_name: line.client_name ?? undefined,
          product_name: line.product_name ?? undefined,
          product_cpe: line.product_cpe ?? undefined,
          quantity_finished_kg: line.quantity_finished_kg ?? undefined,
          quantity_dispatched_kg: line.quantity_dispatched_kg ?? undefined,
          quantity_remaining_kg: line.quantity_remaining_kg ?? undefined,
          include: Number(line.quantity_kg) > 0,
        })),
      )
      setWoId("")
      toast.success("Selección de despacho cargada para crear la nota.")
      sessionStorage.removeItem(DISPATCH_SELECTION_KEY)
    } catch {
      sessionStorage.removeItem(DISPATCH_SELECTION_KEY)
    }
  }, [loadedFromDispatchSelection, searchParams])

  function updateLine(i: number, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!lines.length) {
      toast.error("No hay líneas disponibles para crear la nota.")
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
      toast.error("Seleccione al menos una línea con cantidad mayor a cero.")
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
    const mergedDriver =
      normalizedDriver || normalizedDocument
        ? [normalizedDriver, normalizedDocument ? `CI: ${normalizedDocument}` : null]
            .filter(Boolean)
            .join(" · ")
        : null
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
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nueva nota de entrega
          </h1>
          <p className="text-muted-foreground text-sm">
            Genere la nota con el material pendiente de despacho.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/prefill-nota-entrega">Vista previa de datos</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/notas-entrega">Historial</Link>
          </Button>
        </div>
      </div>

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
        <form onSubmit={(ev) => void submit(ev)} className="space-y-6">
          <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="dn-seq" className="text-sm font-medium">
                Número secuencial (automático)
              </Label>
              <Input
                id="dn-seq"
                className="h-10"
                value={sequentialNumber || "Se asigna automáticamente al crear"}
                readOnly
                disabled
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dn-date" className="text-sm font-medium">
                Fecha documento
              </Label>
              <Input
                id="dn-date"
                type="date"
                className="h-10"
                value={documentDate}
                onChange={(ev) => setDocumentDate(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dn-driver" className="text-sm font-medium">
                Conductor
              </Label>
              <Input
                id="dn-driver"
                className="h-10"
                value={driverName}
                onChange={(ev) => setDriverName(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dn-driver-doc" className="text-sm font-medium">
                Cédula del conductor
              </Label>
              <Input
                id="dn-driver-doc"
                className="h-10"
                value={driverDocument}
                onChange={(ev) => setDriverDocument(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dn-vehicle" className="text-sm font-medium">
                Vehículo
              </Label>
              <Input
                id="dn-vehicle"
                className="h-10"
                value={vehicleName}
                onChange={(ev) => setVehicleName(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dn-plate" className="text-sm font-medium">
                Placa
              </Label>
              <Input
                id="dn-plate"
                className="h-10"
                value={vehiclePlate}
                onChange={(ev) => setVehiclePlate(ev.target.value)}
              />
            </div>
            <div className="grid gap-2 md:col-span-3">
              <Label htmlFor="dn-notes" className="text-sm font-medium">
                Observaciones
              </Label>
              <Textarea
                id="dn-notes"
                rows={3}
                className="min-h-[96px]"
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
            <div className="border-b bg-muted/30 px-4 py-2 text-sm">
              Paletas seleccionadas: <span className="font-medium">{lines.filter((l) => l.include).length}</span>
            </div>
            {!fromDispatchSelection ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">OK</TableHead>
                    <TableHead>OT de producción</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Terminado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((L, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={L.include}
                          onChange={(ev) =>
                            updateLine(i, { include: ev.target.checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {L.work_order_code ?? `OT-${L.work_order_id ?? "-"}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {L.client_name ?? lineOriginLabel(L)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {L.product_name ?? "Producto"}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {L.product_cpe ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {L.quantity_finished_kg ?? String(L.quantity_kg)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </div>

          <Button type="submit" className="h-10" disabled={saving}>
            {saving ? "Creando…" : "Crear nota de entrega"}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
