"use client"

import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Printer } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"

type DeliveryNotePreviewLine = {
  id: number
  pallet_code: string | null
  bobbin_count: number
  quantity_kg: string
}

type DeliveryNotePreviewRecord = {
  id: number
  code: string | null
  sequential_number: number | null
  document_date: string | null
  driver_name: string | null
  vehicle_notes: string | null
  notes: string | null
  work_order?: {
    code: string
    client?: {
      name: string
      rif: string | null
      address: string | null
    } | null
    product?: {
      name: string
    } | null
  } | null
  lines: DeliveryNotePreviewLine[]
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—"
  try {
    const value = new Date(isoDate)
    if (Number.isNaN(value.getTime())) return isoDate
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value)
  } catch {
    return isoDate
  }
}

function formatKg(value: string | number | null | undefined): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return "0.000"
  return n.toFixed(3)
}

export default function DeliveryNotePreviewPage() {
  const { noteId } = useParams()
  const numericId = Number(noteId ?? "")
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState<DeliveryNotePreviewRecord | null>(null)

  useEffect(() => {
    if (!Number.isFinite(numericId) || numericId < 1) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await apiFetch<DeliveryNotePreviewRecord>(`delivery-notes/${numericId}`)
        if (!cancelled) setNote(data)
      } catch (error) {
        if (error instanceof ApiError) toast.error(error.message)
        else toast.error("No se pudo cargar la vista previa de la nota.")
        if (!cancelled) setNote(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [numericId])

  const totalBobbins = useMemo(
    () => (note?.lines ?? []).reduce((acc, line) => acc + Number(line.bobbin_count ?? 0), 0),
    [note],
  )
  const totalKg = useMemo(
    () => (note?.lines ?? []).reduce((acc, line) => acc + Number(line.quantity_kg ?? 0), 0),
    [note],
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa de nota de entrega</h1>
          <p className="text-muted-foreground text-sm">Revise el formato antes de imprimir.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/notas-entrega">Volver al historial</Link>
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Cargando vista previa…</div>
      ) : !note ? (
        <div className="text-muted-foreground">No se encontro la nota de entrega solicitada.</div>
      ) : (
        <div className="mx-auto w-full max-w-[960px] rounded-xl border bg-white p-6 text-black print:max-w-none print:rounded-none print:border-0 print:p-0">
          <div className="border-b border-black pb-3 text-center">
            <p className="text-xs font-medium tracking-wide">INVERSIONES AXONES 2008 C.A</p>
            <h2 className="mt-1 text-xl font-bold tracking-wide">NOTA DE ENTREGA</h2>
          </div>

          <div className="mt-4 grid gap-3 text-sm">
            <div className="grid grid-cols-[140px_1fr_80px_1fr] gap-x-3">
              <p className="font-semibold">CLIENTE:</p>
              <p className="border-b border-black">{note.work_order?.client?.name ?? "—"}</p>
              <p className="font-semibold">N°:</p>
              <p className="border-b border-black">{note.sequential_number ?? "—"}</p>
            </div>
            <div className="grid grid-cols-[140px_1fr_80px_1fr] gap-x-3">
              <p className="font-semibold">RIF:</p>
              <p className="border-b border-black">{note.work_order?.client?.rif ?? "—"}</p>
              <p className="font-semibold">FECHA:</p>
              <p className="border-b border-black">{formatDate(note.document_date)}</p>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-3">
              <p className="font-semibold">DIRECCION:</p>
              <p className="border-b border-black">{note.work_order?.client?.address ?? "—"}</p>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-3">
              <p className="font-semibold">TIPO DE MATERIAL:</p>
              <p className="border-b border-black">{note.work_order?.product?.name ?? "—"}</p>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-3">
              <p className="font-semibold">REFERENCIA OT:</p>
              <p className="border-b border-black">{note.work_order?.code ?? "—"}</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-center text-sm font-semibold">DESCRIPCION DEL MATERIAL</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-1 text-left">PALETA N°</th>
                  <th className="border border-black px-2 py-1 text-left">CANTIDAD DE BOBINAS</th>
                  <th className="border border-black px-2 py-1 text-left">KILOS</th>
                </tr>
              </thead>
              <tbody>
                {(note.lines ?? []).map((line, index) => (
                  <tr key={line.id ?? index}>
                    <td className="border border-black px-2 py-1">{line.pallet_code || index + 1}</td>
                    <td className="border border-black px-2 py-1">{line.bobbin_count ?? 0}</td>
                    <td className="border border-black px-2 py-1">{formatKg(line.quantity_kg)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="border border-black px-2 py-1 font-semibold">TOTAL</td>
                  <td className="border border-black px-2 py-1 font-semibold">{totalBobbins}</td>
                  <td className="border border-black px-2 py-1 font-semibold">{formatKg(totalKg)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 text-sm">
            <div className="grid grid-cols-[140px_1fr] gap-x-3">
              <p className="font-semibold">VEHICULO:</p>
              <p className="border-b border-black">{note.vehicle_notes ?? "—"}</p>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-3">
              <p className="font-semibold">CONDUCTOR:</p>
              <p className="border-b border-black">{note.driver_name ?? "—"}</p>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-3">
              <p className="font-semibold">OBSERVACIONES:</p>
              <p className="border-b border-black">{note.notes ?? "—"}</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 text-center text-sm">
            <div>
              <p className="mb-10 font-semibold">AUTORIZADO POR:</p>
              <p className="border-t border-black pt-2"> </p>
            </div>
            <div>
              <p className="mb-10 font-semibold">DESPACHADO POR:</p>
              <p className="border-t border-black pt-2"> </p>
            </div>
            <div>
              <p className="mb-10 font-semibold">RECIBIDO POR:</p>
              <p className="border-t border-black pt-2"> </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
