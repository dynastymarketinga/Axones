import { priorityCardClass } from "@/components/axones/programacion/programacion-kanban-config"
import type { WorkOrderListRow } from "@/types/api"

export type BandejaProgramacionPriority = "normal" | "alta" | "urgente"

export type BandejaProgramacion = {
  priority: BandejaProgramacionPriority
  fechaInicio: string
  fechaEntrega: string
  motivo: string
}

function readString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function technicalForm(row: WorkOrderListRow): Record<string, unknown> | null {
  const f = row.technical_document?.form
  if (!f || typeof f !== "object" || Array.isArray(f)) return null
  return f as Record<string, unknown>
}

export function normalizeBandejaPriority(value: unknown): BandejaProgramacionPriority {
  const p = readString(value).toLowerCase()
  if (p === "urgente") return "urgente"
  if (p === "alta") return "alta"
  return "normal"
}

export function bandejaPriorityLabel(priority: BandejaProgramacionPriority): string {
  if (priority === "urgente") return "Urgente"
  if (priority === "alta") return "Alta"
  return "Normal"
}

export function bandejaPriorityBadgeClass(priority: BandejaProgramacionPriority): string {
  if (priority === "urgente") {
    return "border-red-500/40 bg-red-500/12 text-red-950 dark:text-red-50"
  }
  if (priority === "alta") {
    return "border-orange-500/40 bg-orange-500/12 text-orange-950 dark:text-orange-50"
  }
  return "border-primary/25 bg-primary/10 text-foreground"
}

export function bandejaProgramacionRowAccentClass(priority: BandejaProgramacionPriority): string {
  return priorityCardClass(priority)
}

/** ISO `YYYY-MM-DD` o texto vacío → `dd/mm/aaaa` o em dash. */
export function formatBandejaIsoDate(value: unknown): string {
  const raw = readString(value)
  if (!raw) return "—"
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (iso) {
    const [, y, m, d] = iso
    return `${d}/${m}/${y}`
  }
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
  if (slash) return raw
  return raw
}

export function readBandejaProgramacion(row: WorkOrderListRow): BandejaProgramacion {
  const form = technicalForm(row)
  const fromRow = normalizeBandejaPriority(row.priority)
  const fromForm = form ? normalizeBandejaPriority(form.priority) : "normal"
  const priority = row.priority != null && readString(row.priority) !== "" ? fromRow : fromForm

  return {
    priority,
    fechaInicio: readString(form?.fechaInicio),
    fechaEntrega: readString(form?.fechaEntrega),
    motivo: readString(form?.programacionMotivo),
  }
}
