"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { CheckCircle2, FileDown, Lock, RotateCcw, Truck } from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import { apiFetch, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import { getStoredUser } from "@/lib/auth-storage"

const AXONES_ADDRESS_LINE =
  "CALLE PARCELAMIENTO INDUSTRIAL GUERE, LOCAL 35, SECTOR LA JULIA. TURMERO-EDO ARAGUA, ZONA POSTAL 2115. TELFS: (0244) 663.53.76 – (0244) 663.50.60"

/**
 * Mismo logo que el PDF de orden de trabajo Laravel (`orden_trabajo_planilla.blade.php` → `logo-axones-var-01.png`).
 * Con `base: '/axones/'` en Vite, usar siempre BASE_URL.
 */
const REPORT_LOGO_VAR01 = `${import.meta.env.BASE_URL}brand/logo-axones-var-01.png`
const REPORT_LOGO_1 = `${import.meta.env.BASE_URL}brand/logo-axones-1.png`
const REPORT_LOGO_MAIN_SVG = `${import.meta.env.BASE_URL}brand/logo-axones-main.svg`

/** Solo PNG para jsPDF (mismo orden que la vista). */
const PDF_LOGO_TRY_PATHS = ["brand/logo-axones-var-01.png", "brand/logo-axones-1.png"] as const

const TABLE_HEADER_BG = "bg-[#b8d4e8]"

type PurchaseOrderPreviewDetail = {
  id: number
  code: string
  status: string
  supplier_id: number
  ordered_at: string | null
  created_at?: string | null
  notes: string | null
  tax_applies?: boolean
  manually_closed_at?: string | null
  manual_close_reason?: string | null
  manuallyClosedBy?: { id: number; name: string } | null
  supplier?: {
    id: number
    name: string
    rif?: string | null
    address?: string | null
  } | null
  lines?: Array<{
    id: number
    description?: string | null
    quantity_ordered: string | number
    quantity_received?: string | number
    unit?: string | null
    unit_price?: string | number | null
    material?: { name?: string | null; sku?: string | null } | null
  }>
}

type ConsumingWorkOrder = {
  id: number
  code: string
  client_name?: string | null
  product_name?: string | null
  product_cpe?: string | null
  dispatched_notes_count: number
  draft_notes_count: number
  has_dispatched_note: boolean
}

type ConsumingWorkOrdersResponse = {
  work_orders: ConsumingWorkOrder[]
  all_dispatched: boolean
  no_consumers: boolean
}

function formatDateDMY(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

function formatQuantityEs(value: string | number | null | undefined): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return "0,00"
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function lineDescription(ln: NonNullable<PurchaseOrderPreviewDetail["lines"]>[0]): string {
  const mat = ln.material?.name?.trim()
  const desc = ln.description?.trim()
  if (mat && desc && mat !== desc) return `${mat} — ${desc}`
  return mat ?? desc ?? "—"
}

function displayUnit(unit: string | null | undefined): string {
  const u = (unit ?? "").trim().toLowerCase()
  if (u === "kg" || u === "kilos" || u === "kilo") return "KILOS"
  return (unit ?? "").trim().toUpperCase() || "—"
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100
}

function moneyEsUsd(amount: number): string {
  return `${new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundMoney2(amount))} $`
}

function lineQty(ln: NonNullable<PurchaseOrderPreviewDetail["lines"]>[0]): number {
  const n = Number(ln.quantity_ordered ?? 0)
  return Number.isFinite(n) ? n : 0
}

function lineUnitPrice(ln: NonNullable<PurchaseOrderPreviewDetail["lines"]>[0]): number {
  const n = Number(ln.unit_price ?? 0)
  return Number.isFinite(n) ? n : 0
}

function lineAmount(ln: NonNullable<PurchaseOrderPreviewDetail["lines"]>[0]): number {
  return roundMoney2(lineQty(ln) * lineUnitPrice(ln))
}

function purchaseOrderTotals(detail: PurchaseOrderPreviewDetail): {
  subtotal: number
  tax: number
  total: number
  taxApplies: boolean
} {
  const rows = detail.lines ?? []
  let subtotal = 0
  for (const ln of rows) {
    subtotal += lineAmount(ln)
  }
  subtotal = roundMoney2(subtotal)
  const taxApplies = detail.tax_applies !== false
  const tax = taxApplies ? roundMoney2(subtotal * 0.16) : 0
  const total = roundMoney2(subtotal + tax)
  return { subtotal, tax, total, taxApplies }
}

function absoluteBrandAssetUrl(pathUnderBrand: string): string {
  const normalized = pathUnderBrand.replace(/^\/+/, "")
  return new URL(normalized, `${window.location.origin}${import.meta.env.BASE_URL}`).href
}

async function loadAxonesLogoForPdf(): Promise<{ dataUrl: string; aspect: number } | null> {
  for (const relativePath of PDF_LOGO_TRY_PATHS) {
    try {
      const res = await fetch(absoluteBrandAssetUrl(relativePath))
      if (!res.ok) continue
      const blob = await res.blob()
      const bmp = await createImageBitmap(blob)
      const aspect = bmp.height / bmp.width
      bmp.close()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onloadend = () => resolve(r.result as string)
        r.onerror = () => reject(new Error("read"))
        r.readAsDataURL(blob)
      })
      return { dataUrl, aspect }
    } catch {
      continue
    }
  }
  return null
}

async function downloadPurchaseOrderPdf(detail: PurchaseOrderPreviewDetail): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 12
  let y = margin

  const logo = await loadAxonesLogoForPdf()
  const logoWmm = 38
  const logoHmm = logo ? logoWmm * logo.aspect : 0
  const headerBlockH = Math.max(logoHmm, 24)

  if (logo) {
    const fmt = logo.dataUrl.includes("image/jpeg") || logo.dataUrl.includes("image/jpg")
      ? "JPEG"
      : "PNG"
    doc.addImage(logo.dataUrl, fmt, margin, y, logoWmm, logoHmm)
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.text("INVERSIONES AXONES 2008 C.A", pageW / 2, y + 6, { align: "center" })
  doc.setFontSize(9)
  doc.setTextColor(13, 110, 60)
  doc.text("J-400813417", pageW / 2, y + 11, { align: "center" })
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.text("PLÁSTICOS LA DINASTÍA", pageW - margin, y + 6, { align: "right" })

  y += headerBlockH + 4

  doc.setFontSize(7)
  const addrLines = doc.splitTextToSize(AXONES_ADDRESS_LINE, pageW - 2 * margin)
  doc.text(addrLines, pageW / 2, y, { align: "center" })
  y += addrLines.length * 3.6 + 4

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("ORDEN DE COMPRA", pageW / 2, y, { align: "center" })
  y += 9

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const docDate = formatDateDMY(detail.ordered_at ?? detail.created_at)
  doc.text(`N°: ${detail.code}`, pageW - margin, y, { align: "right" })
  y += 5
  doc.text(`FECHA: ${docDate}`, pageW - margin, y, { align: "right" })
  y += 9

  const supplier = detail.supplier
  doc.setFontSize(9)
  doc.text(`PROVEEDOR: ${supplier?.name ?? `#${detail.supplier_id}`}`, margin, y)
  y += 6
  doc.text(`RIF: ${supplier?.rif?.trim() ?? ""}`, margin, y)
  y += 6
  doc.text(`DIRECCIÓN: ${supplier?.address?.trim() ?? ""}`, margin, y)
  y += 10

  const totalsPdf = purchaseOrderTotals(detail)

  const body =
    (detail.lines ?? []).length > 0
      ? (detail.lines ?? []).map((ln, idx) => [
          String(idx + 1),
          lineDescription(ln),
          formatQuantityEs(ln.quantity_ordered),
          displayUnit(ln.unit ?? undefined),
          moneyEsUsd(lineUnitPrice(ln)),
          moneyEsUsd(lineAmount(ln)),
        ])
      : [["—", "Sin líneas en esta orden.", "—", "—", "—", "—"]]

  autoTable(doc, {
    startY: y,
    head: [["ITEM", "DESCRIPCIÓN", "CANTIDAD", "UNIDAD", "PRECIO UNITARIO", "TOTAL"]],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 1.2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [184, 212, 232],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      1: { cellWidth: "auto" },
      2: { halign: "right", cellWidth: 22 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "right", cellWidth: 26 },
      5: { halign: "right", cellWidth: 24 },
    },
    margin: { left: margin, right: margin },
  })

  const tableFinal = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
  let ty = (tableFinal?.finalY ?? y + 30) + 6

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text("SUBTOTAL", pageW - margin - 42, ty)
  doc.text(moneyEsUsd(totalsPdf.subtotal), pageW - margin, ty, { align: "right" })
  ty += 5
  doc.text(totalsPdf.taxApplies ? "IVA (16%)" : "Sin IVA", pageW - margin - 42, ty)
  doc.text(moneyEsUsd(totalsPdf.tax), pageW - margin, ty, { align: "right" })
  ty += 5
  doc.setFont("helvetica", "bold")
  doc.text("TOTAL", pageW - margin - 42, ty)
  doc.text(moneyEsUsd(totalsPdf.total), pageW - margin, ty, { align: "right" })
  doc.setFont("helvetica", "normal")
  ty += 10

  doc.text("OBSERVACIÓN:", margin, ty)
  ty += 5
  const obsLines = doc.splitTextToSize(detail.notes?.trim() || " ", pageW - 2 * margin)
  doc.text(obsLines, margin, ty)
  ty += obsLines.length * 4 + 12

  const sigY = Math.min(Math.max(ty, 240), 272)
  const sigW = 52
  doc.line(margin, sigY, margin + sigW, sigY)
  doc.line(pageW - margin - sigW, sigY, pageW - margin, sigY)
  doc.text("COMPRAS", margin + sigW / 2, sigY + 5, { align: "center" })
  doc.text("GERENCIA", pageW - margin - sigW / 2, sigY + 5, { align: "center" })

  const safeName = detail.code.replace(/[^\w.-]+/g, "_")
  doc.save(`OC-${safeName}.pdf`)
}

export default function PurchaseOrderPreviewPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const rawId = routeId ?? ""
  const id = Number(rawId)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<PurchaseOrderPreviewDetail | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [headerLogoSrc, setHeaderLogoSrc] = useState(REPORT_LOGO_VAR01)
  const [consuming, setConsuming] = useState<ConsumingWorkOrdersResponse | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeReason, setCloseReason] = useState("")
  const [closeBusy, setCloseBusy] = useState(false)
  const [reopenBusy, setReopenBusy] = useState(false)

  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()
  const isBoss =
    role === "boss" ||
    role === "admin" ||
    role === "jefe_supremo" ||
    role === "superadmin"

  useEffect(() => {
    setHeaderLogoSrc(REPORT_LOGO_VAR01)
  }, [id])

  const reloadConsuming = useCallback(async (poId: number, signal?: { cancelled: boolean }) => {
    try {
      const res = await apiFetch<ConsumingWorkOrdersResponse>(
        `purchase-orders/${poId}/consuming-work-orders`,
      )
      if (!signal?.cancelled) setConsuming(res)
    } catch (e) {
      if (!signal?.cancelled) setConsuming(null)
      if (e instanceof ApiError) toast.error(e.message)
    }
  }, [])

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) {
      setLoading(false)
      return
    }
    const signal = { cancelled: false }
    void (async () => {
      setLoading(true)
      try {
        const data = await apiFetch<PurchaseOrderPreviewDetail>(`purchase-orders/${id}`)
        if (!signal.cancelled) setDetail(data)
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo cargar la vista previa de la orden de compra.")
        if (!signal.cancelled) setDetail(null)
      } finally {
        if (!signal.cancelled) setLoading(false)
      }
    })()
    void reloadConsuming(id, signal)
    return () => {
      signal.cancelled = true
    }
  }, [id, reloadConsuming])

  const documentDate = useMemo(() => {
    if (!detail) return "—"
    return formatDateDMY(detail.ordered_at ?? detail.created_at)
  }, [detail])

  const totals = useMemo(() => (detail ? purchaseOrderTotals(detail) : null), [detail])

  const supplier = detail?.supplier
  const isManuallyClosed = Boolean(detail?.manually_closed_at)

  async function submitManualClose() {
    if (!detail) return
    const trimmed = closeReason.trim()
    if (trimmed.length < 5) {
      toast.error("El motivo debe tener al menos 5 caracteres.")
      return
    }
    setCloseBusy(true)
    try {
      const updated = await apiFetch<PurchaseOrderPreviewDetail>(
        `purchase-orders/${detail.id}/manual-close`,
        { method: "POST", body: JSON.stringify({ reason: trimmed }) },
      )
      setDetail(updated)
      setCloseOpen(false)
      setCloseReason("")
      toast.success("Orden cerrada manualmente.")
      void reloadConsuming(detail.id)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo cerrar la orden.")
    } finally {
      setCloseBusy(false)
    }
  }

  async function submitReopen() {
    if (!detail) return
    if (!confirm("¿Reabrir esta orden de compra? El estado se recalculará automáticamente.")) return
    setReopenBusy(true)
    try {
      const updated = await apiFetch<PurchaseOrderPreviewDetail>(
        `purchase-orders/${detail.id}/reopen`,
        { method: "POST" },
      )
      setDetail(updated)
      toast.success("Orden reabierta.")
      void reloadConsuming(detail.id)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo reabrir la orden.")
    } finally {
      setReopenBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 print:bg-white print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa — Orden de compra</h1>
          <p className="text-muted-foreground text-sm">
            Revise el formato y descargue el PDF para imprimir o archivar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/ordenes-compra">Volver al listado</Link>
          </Button>
          {isBoss && detail ? (
            isManuallyClosed ? (
              <Button
                type="button"
                variant="outline"
                disabled={reopenBusy}
                onClick={() => void submitReopen()}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                <LoadingButtonLabel loading={reopenBusy} loadingText="Reabriendo…" idleText="Reabrir orden" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCloseOpen(true)}
              >
                <Lock className="mr-2 h-4 w-4" />
                Cerrar manualmente
              </Button>
            )
          ) : null}
          <Button
            type="button"
            disabled={!detail || pdfBusy}
            onClick={() => {
              if (!detail) return
              setPdfBusy(true)
              void downloadPurchaseOrderPdf(detail)
                .then(() => toast.success("PDF descargado."))
                .catch(() => toast.error("No se pudo generar el PDF."))
                .finally(() => setPdfBusy(false))
            }}
          >
            <FileDown className="mr-2 h-4 w-4" />
            <LoadingButtonLabel loading={pdfBusy} loadingText="Generando…" idleText="Descargar PDF" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Cargando vista previa…</div>
      ) : !detail ? (
        <div className="text-muted-foreground">No se encontró la orden de compra solicitada.</div>
      ) : (
        <article className="mx-auto w-full max-w-[820px] rounded-xl border bg-white p-8 text-black shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {/* Cabecera: logos + empresa */}
          <header className="grid grid-cols-[minmax(5.5rem,8rem)_1fr_minmax(0,5.5rem)] items-center gap-3 border-b border-black/20 pb-4 sm:grid-cols-[minmax(6rem,8.5rem)_1fr_minmax(0,6rem)] sm:gap-4">
            <div className="flex h-[4.75rem] w-full max-w-[8.5rem] items-center justify-start sm:h-[5.25rem]">
              <img
                src={headerLogoSrc}
                alt="Inversiones Axones"
                className="max-h-full max-w-full object-contain object-left"
                loading="eager"
                onError={() => {
                  setHeaderLogoSrc((prev) => {
                    if (prev === REPORT_LOGO_VAR01) return REPORT_LOGO_1
                    if (prev === REPORT_LOGO_1) return REPORT_LOGO_MAIN_SVG
                    return prev
                  })
                }}
              />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold uppercase leading-tight">
                INVERSIONES AXONES 2008 C.A
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0d6e3c]">J-400813417</p>
            </div>
            <div className="flex flex-col items-end justify-center text-right text-[10px] font-medium uppercase leading-tight text-neutral-700">
              <span className="max-w-[140px]">PLÁSTICOS LA DINASTÍA</span>
            </div>
          </header>

          <p className="mt-3 text-center text-xs leading-snug text-black">{AXONES_ADDRESS_LINE}</p>

          <h2 className="mt-5 text-center text-lg font-bold uppercase tracking-wide underline decoration-1 underline-offset-4">
            ORDEN DE COMPRA
          </h2>

          <div className="mt-4 flex justify-end text-sm">
            <div className="min-w-[220px] space-y-1 text-right">
              <p>
                <span className="font-semibold">N°:</span>{" "}
                <span className="border-b border-black px-1 font-mono">{detail.code}</span>
              </p>
              <p>
                <span className="font-semibold">FECHA:</span>{" "}
                <span className="border-b border-black px-1">{documentDate}</span>
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex flex-wrap gap-2 border-b border-black pb-0.5">
              <span className="shrink-0 font-semibold">PROVEEDOR:</span>
              <span className="min-w-0 flex-1">{supplier?.name ?? `#${detail.supplier_id}`}</span>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-black pb-0.5">
              <span className="shrink-0 font-semibold">RIF:</span>
              <span className="min-w-0 flex-1">{supplier?.rif?.trim() || "\u00a0"}</span>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-black pb-0.5">
              <span className="shrink-0 font-semibold">DIRECCIÓN:</span>
              <span className="min-w-0 flex-1">{supplier?.address?.trim() || "\u00a0"}</span>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className={TABLE_HEADER_BG}>
                  <th className="border border-black px-1 py-2 text-center font-semibold sm:px-2">
                    ITEM
                  </th>
                  <th className="border border-black px-1 py-2 text-left font-semibold sm:px-2">
                    DESCRIPCIÓN
                  </th>
                  <th className="border border-black px-1 py-2 text-right font-semibold sm:px-2">
                    CANTIDAD
                  </th>
                  <th className="border border-black px-1 py-2 text-center font-semibold sm:px-2">
                    UNIDAD
                  </th>
                  <th className="border border-black px-1 py-2 text-right font-semibold sm:px-2">
                    PRECIO UNITARIO
                  </th>
                  <th className="border border-black px-1 py-2 text-right font-semibold sm:px-2">
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {(detail.lines ?? []).length ? (
                  (detail.lines ?? []).map((ln, idx) => (
                    <tr key={ln.id}>
                      <td className="border border-black px-1 py-2 text-center tabular-nums sm:px-2">
                        {idx + 1}
                      </td>
                      <td className="border border-black px-1 py-2 sm:px-2">
                        {lineDescription(ln)}
                      </td>
                      <td className="border border-black px-1 py-2 text-right tabular-nums sm:px-2">
                        {formatQuantityEs(ln.quantity_ordered)}
                      </td>
                      <td className="border border-black px-1 py-2 text-center sm:px-2">
                        {displayUnit(ln.unit ?? undefined)}
                      </td>
                      <td className="border border-black px-1 py-2 text-right tabular-nums sm:px-2">
                        {moneyEsUsd(lineUnitPrice(ln))}
                      </td>
                      <td className="border border-black px-1 py-2 text-right tabular-nums sm:px-2">
                        {moneyEsUsd(lineAmount(ln))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="border border-black px-2 py-4 text-center text-muted-foreground"
                    >
                      Sin líneas en esta orden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="min-w-[200px] space-y-1 text-sm tabular-nums">
              <div className="flex justify-between gap-8 border-b border-black/30 py-0.5">
                <span className="font-semibold">SUBTOTAL</span>
                <span>{totals ? moneyEsUsd(totals.subtotal) : "—"}</span>
              </div>
              <div className="flex justify-between gap-8 border-b border-black/30 py-0.5">
                <span className="font-semibold">
                  {totals?.taxApplies ? "IVA (16 %)" : "Sin IVA"}
                </span>
                <span>{totals ? moneyEsUsd(totals.tax) : "—"}</span>
              </div>
              <div className="flex justify-between gap-8 py-0.5 font-bold">
                <span>TOTAL</span>
                <span>{totals ? moneyEsUsd(totals.total) : "—"}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 text-sm">
            <p className="font-semibold">OBSERVACIÓN:</p>
            <p className="mt-1 min-h-[2rem] border-b border-black whitespace-pre-wrap">
              {detail.notes?.trim() || "\u00a0"}
            </p>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-12 text-center text-sm">
            <div>
              <div className="mb-2 border-t border-black pt-2" />
              <p className="font-semibold">COMPRAS</p>
            </div>
            <div>
              <div className="mb-2 border-t border-black pt-2" />
              <p className="font-semibold">GERENCIA</p>
            </div>
          </div>
        </article>
      )}

      {detail ? (
        <section className="mx-auto w-full max-w-[820px] space-y-3 rounded-xl border bg-white p-6 shadow-sm print:hidden">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Estado de cierre · órdenes de trabajo consumidoras
              </h2>
              <p className="text-muted-foreground text-xs">
                La OC pasa a <span className="font-medium">Completada</span> cuando todas las OTs que usaron material
                de esta orden tienen al menos una nota de entrega despachada.
              </p>
            </div>
            {isManuallyClosed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Lock className="h-3.5 w-3.5" />
                Cerrada manualmente
              </span>
            ) : null}
          </header>

          {isManuallyClosed && detail.manual_close_reason ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p>
                <span className="font-semibold">Motivo:</span> {detail.manual_close_reason}
              </p>
              {detail.manuallyClosedBy?.name ? (
                <p className="mt-1 text-emerald-800">
                  Por {detail.manuallyClosedBy.name}
                  {detail.manually_closed_at ? ` · ${formatDateDMY(detail.manually_closed_at)}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {!consuming ? (
            <div className="text-muted-foreground text-sm">Cargando órdenes de trabajo…</div>
          ) : consuming.no_consumers ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              No se detectaron órdenes de trabajo que hayan consumido material trazable a esta OC. La OC permanecerá
              en <span className="font-medium">Parcial</span> hasta que jefatura la cierre manualmente.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold">OT</th>
                    <th className="px-2 py-2 text-left font-semibold">Cliente</th>
                    <th className="px-2 py-2 text-left font-semibold">Producto</th>
                    <th className="px-2 py-2 text-center font-semibold">Notas borrador</th>
                    <th className="px-2 py-2 text-center font-semibold">Notas despachadas</th>
                    <th className="px-2 py-2 text-center font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {consuming.work_orders.map((wo) => (
                    <tr key={wo.id} className="border-t">
                      <td className="px-2 py-2 font-mono">{wo.code}</td>
                      <td className="px-2 py-2">{wo.client_name ?? "—"}</td>
                      <td className="px-2 py-2">
                        {wo.product_name ?? wo.product_cpe ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">{wo.draft_notes_count}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{wo.dispatched_notes_count}</td>
                      <td className="px-2 py-2 text-center">
                        {wo.has_dispatched_note ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" /> Despachada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Truck className="h-4 w-4" /> Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {consuming.all_dispatched && !isManuallyClosed ? (
                <p className="bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Todas las OTs tienen al menos una nota despachada — la OC ya debería figurar como Completada.
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <Dialog open={closeOpen} onOpenChange={(open) => { if (!closeBusy) setCloseOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar manualmente la orden</DialogTitle>
            <DialogDescription>
              Esta acción marca la OC como Completada aunque queden recepciones o despachos pendientes. Se registrará
              el motivo y el usuario que la cierra.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="po-close-reason">Motivo del cierre</Label>
            <Textarea
              id="po-close-reason"
              value={closeReason}
              onChange={(ev) => setCloseReason(ev.target.value)}
              placeholder="Ej. proveedor desistió, sobrante quedará en stock, etc."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseOpen(false)}
              disabled={closeBusy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void submitManualClose()}
              disabled={closeBusy}
            >
              <LoadingButtonLabel loading={closeBusy} loadingText="Cerrando…" idleText="Cerrar OC" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
