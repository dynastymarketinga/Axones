"use client"

import { useState } from "react"
import { Link } from "react-router-dom"
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

export default function DeliveryNoteCreatePage() {
  const [woId, setWoId] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [lines, setLines] = useState<EditableLine[]>([])
  const [documentDate, setDocumentDate] = useState("")
  const [sequentialNumber, setSequentialNumber] = useState("")
  const [driverName, setDriverName] = useState("")
  const [vehicleNotes, setVehicleNotes] = useState("")
  const [notes, setNotes] = useState("")

  async function loadPrefill() {
    const id = Number(woId)
    if (!Number.isFinite(id) || id < 1) {
      toast.error("Indique un ID de orden de trabajo válido.")
      return
    }
    setLoading(true)
    setPrefill(null)
    try {
      const p = await apiFetch<Prefill>(`work-orders/${id}/nota-entrega/prefill`)
      setPrefill(p)
      setDocumentDate(p.suggested_document_date ?? "")
      setSequentialNumber(String(p.next_sequential_number ?? ""))
      setDriverName(p.transport?.driver_name ?? "")
      setVehicleNotes(p.transport?.vehicle_notes ?? "")
      setLines(
        (p.suggested_lines ?? []).map((L) => ({
          ...L,
          include: Number(L.quantity_kg) > 0,
        })),
      )
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el prefill.")
    } finally {
      setLoading(false)
    }
  }

  function updateLine(i: number, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!prefill) {
      toast.error("Cargue primero el prefill de una OT.")
      return
    }
    const seq = Number(sequentialNumber)
    if (!Number.isFinite(seq) || seq < 1) {
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

    setSaving(true)
    try {
      await apiFetch("delivery-notes", {
        method: "POST",
        body: JSON.stringify({
          work_order_id: prefill.work_order.id,
          sequential_number: seq,
          document_date: documentDate || null,
          driver_name: driverName.trim() || null,
          vehicle_notes: vehicleNotes.trim() || null,
          notes: notes.trim() || null,
          lines: payloadLines,
        }),
      })
      toast.success("Nota de entrega creada.")
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
            Desde saldos de corte · <code className="text-xs">POST /delivery-notes</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/axones/prefill-nota-entrega">Solo JSON (prefill)</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/axones/notas-entrega">Historial</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid gap-2">
          <Label htmlFor="dn-wo">work_order_id</Label>
          <Input
            id="dn-wo"
            inputMode="numeric"
            value={woId}
            onChange={(ev) => setWoId(ev.target.value)}
            placeholder="ej. 12"
          />
        </div>
        <Button type="button" onClick={() => void loadPrefill()} disabled={loading}>
          {loading ? "…" : "Cargar prefill"}
        </Button>
      </div>

      {prefill ? (
        <form onSubmit={(ev) => void submit(ev)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="dn-seq">Número secuencial *</Label>
              <Input
                id="dn-seq"
                inputMode="numeric"
                value={sequentialNumber}
                onChange={(ev) => setSequentialNumber(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dn-date">Fecha documento</Label>
              <Input
                id="dn-date"
                type="date"
                value={documentDate}
                onChange={(ev) => setDocumentDate(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dn-driver">Conductor</Label>
              <Input
                id="dn-driver"
                value={driverName}
                onChange={(ev) => setDriverName(ev.target.value)}
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="dn-veh">Vehículo / placas</Label>
              <Input
                id="dn-veh"
                value={vehicleNotes}
                onChange={(ev) => setVehicleNotes(ev.target.value)}
              />
            </div>
            <div className="grid gap-2 md:col-span-3">
              <Label htmlFor="dn-notes">Notas</Label>
              <Textarea
                id="dn-notes"
                rows={2}
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">OK</TableHead>
                  <TableHead>Paleta</TableHead>
                  <TableHead>Bobinas</TableHead>
                  <TableHead>Kg</TableHead>
                  <TableHead>Uso corte #</TableHead>
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
                      <Input
                        value={L.pallet_code}
                        onChange={(ev) =>
                          updateLine(i, { pallet_code: ev.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell className="w-28">
                      <Input
                        inputMode="numeric"
                        value={String(L.bobbin_count)}
                        onChange={(ev) =>
                          updateLine(i, {
                            bobbin_count: Number(ev.target.value) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="w-32">
                      <Input
                        inputMode="decimal"
                        value={String(L.quantity_kg)}
                        onChange={(ev) =>
                          updateLine(i, { quantity_kg: ev.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {L.corte_bobina_usage_id}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Creando…" : "Crear nota de entrega"}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
