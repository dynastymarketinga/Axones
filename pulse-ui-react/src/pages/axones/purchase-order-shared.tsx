"use client"

/* eslint-disable react-refresh/only-export-components -- utilidades compartidas del módulo OC */

import { CheckCircle2, Droplet, FlaskConical, Layers, Loader2, Package } from "lucide-react"
import { cn } from "@/lib/utils"

export type PoItemType = "sustrato" | "tinta" | "quimico" | "otros"

export const PURCHASE_ORDER_STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  partial: "Parcial",
  completed: "Completada",
  cancelled: "Completada",
}

export function purchaseOrderStatusLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return PURCHASE_ORDER_STATUS_LABELS[value] ?? value
}

export function formatDateDMY(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function formatQuantityEs(value: string | number | null | undefined): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return "0,000"
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n)
}

export const PO_ITEM_TYPE_DISPLAY: Record<
  PoItemType,
  { label: string; icon: typeof Layers; badgeClass: string; rowAccent: string }
> = {
  sustrato: {
    label: "Sustrato",
    icon: Layers,
    badgeClass: "border-emerald-500/35 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    rowAccent: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
  },
  tinta: {
    label: "Tinta",
    icon: Droplet,
    badgeClass: "border-violet-500/35 bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100",
    rowAccent: "border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/20",
  },
  quimico: {
    label: "Químico",
    icon: FlaskConical,
    badgeClass: "border-sky-500/35 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
    rowAccent: "border-l-sky-500 bg-sky-50/50 dark:bg-sky-950/20",
  },
  otros: {
    label: "Otros",
    icon: Package,
    badgeClass: "border-amber-500/35 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    rowAccent: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
  },
}

export function parsePoLineItemType(description: string | null | undefined): PoItemType {
  const text = (description ?? "").toLowerCase()
  const match = /tipo:\s*(sustrato|tinta|qu[ií]mico|otros)/i.exec(text)
  if (!match) return "otros"
  const raw = match[1].toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
  if (raw === "sustrato") return "sustrato"
  if (raw === "tinta") return "tinta"
  if (raw === "quimico") return "quimico"
  return "otros"
}

export function poLinePrimaryLabel(line: {
  description?: string | null
  material?: { name?: string | null } | null
}): string {
  const desc = line.description?.trim()
  if (desc) {
    const pipe = desc.split("|")[0]?.trim()
    return pipe || desc
  }
  return line.material?.name?.trim() || "—"
}

export function PoLineTypeBadge({ type }: { type: PoItemType }) {
  const meta = PO_ITEM_TYPE_DISPLAY[type]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        meta.badgeClass,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {meta.label}
    </span>
  )
}

export function PurchaseOrderStatusBadge({
  status,
  manuallyClosedAt,
  compact,
  prominent,
}: {
  status: string
  manuallyClosedAt?: string | null
  compact?: boolean
  prominent?: boolean
}) {
  const normalized = status === "cancelled" ? "completed" : status
  const label = purchaseOrderStatusLabel(status)
  const wasManualClose = normalized === "completed" && Boolean(manuallyClosedAt)

  const shellClass = cn(
    "inline-flex items-center gap-2 rounded-full border font-medium",
    prominent
      ? "min-w-[7.5rem] justify-center px-3.5 py-1.5 text-sm shadow-sm"
      : compact
        ? "gap-1.5 px-2 py-0 text-xs"
        : "px-2.5 py-0.5 text-sm",
  )

  if (normalized === "completed") {
    return (
      <span
        className={cn(
          shellClass,
          "border-emerald-500/35 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        )}
        title={
          wasManualClose
            ? "Cerrada manualmente por jefatura"
            : "Cerrada al despachar todas las OTs"
        }
      >
        <CheckCircle2 className={cn("shrink-0", prominent ? "size-4" : compact ? "size-3" : "size-3.5")} aria-hidden />
        <span>{label}</span>
        {wasManualClose ? (
          <span className="rounded bg-emerald-200/80 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/60">
            manual
          </span>
        ) : null}
      </span>
    )
  }

  if (normalized === "partial") {
    return (
      <span
        className={cn(
          shellClass,
          "border-amber-500/35 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
        )}
      >
        <Loader2 className={cn("shrink-0 animate-spin", prominent ? "size-4" : compact ? "size-3" : "size-3.5")} aria-hidden />
        <span>{label}</span>
      </span>
    )
  }

  if (normalized === "open") {
    return (
      <span
        className={cn(
          shellClass,
          "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
        )}
      >
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.55)]",
            prominent ? "size-2.5" : "size-2",
          )}
          aria-hidden
        />
        <span>{label}</span>
      </span>
    )
  }

  return <span className="text-muted-foreground text-sm">{label}</span>
}
