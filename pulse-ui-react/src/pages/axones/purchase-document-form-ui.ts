import { toast } from "sonner"

import { cn } from "@/lib/utils"

export const DOCUMENT_FORM_VALIDATION_TOAST_MS = 3000
export const DOCUMENT_FORM_FIELD_ERRORS_AUTO_CLEAR_MS = 3000
export const DOCUMENT_LINES_PAGE_SIZE = 8
export const DOCUMENT_ROW_FIELD_CLASS = "border-white/60 bg-background/90 shadow-sm"

export function parseDecimalInput(raw: string): number {
  const t = raw.trim().replace(/\s+/g, "").replace(",", ".")
  if (!t) return Number.NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

/** Fecha local en formato `YYYY-MM-DD`. */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function parseDateInputValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return undefined
  }
  return parsed
}

export function formatDateInputDisplay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return "Seleccione fecha…"
  return `${match[3]}/${match[2]}/${match[1]}`
}

/** Solo dígitos y un separador decimal (`.` o `,` → `.` en estado). */
export function sanitizePositiveDecimalInput(raw: string, maxFracDigits: number): string {
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

export function documentInvalidHighlightClass(hasError: boolean) {
  return hasError
    ? "border-destructive/80 bg-destructive/[0.06] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.35),0_0_0_3px_rgba(239,68,68,0.12)]"
    : ""
}

export function documentToastError(message: string) {
  toast.error(message, { duration: DOCUMENT_FORM_VALIDATION_TOAST_MS })
}

export function documentFieldIconClass(hasError: boolean, disabled?: boolean) {
  return cn(
    "pointer-events-none absolute left-3 h-4 w-4 transition-colors",
    hasError
      ? "text-red-500"
      : disabled
        ? "text-muted-foreground/50"
        : "text-muted-foreground group-focus-within/field:text-primary",
  )
}

export function formatLinesCount(n: number, singular = "línea", plural = "líneas"): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`
}
