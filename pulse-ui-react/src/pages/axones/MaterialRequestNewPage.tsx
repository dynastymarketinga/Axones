"use client"

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Hash,
  Loader2,
  Package,
  PackageCheck,
  Plus,
  Ruler,
  SendHorizonal,
  Trash2,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Misma plantilla en encabezado y filas para evitar solapamiento. */
const DESKTOP_LINE_GRID =
  "grid grid-cols-[3rem_minmax(0,1fr)_9rem_9rem_3.5rem] items-center gap-x-5"

const MAX_ITEM_LINES = 10
const ITEMS_PAGE_SIZE = 5

const ROLE_LABELS: Record<string, string> = {
  boss: "Jefe / gerencia",
  admin: "Administrador",
  jefe_supremo: "Jefe supremo",
  superadmin: "Superadministrador",
  jefe_operaciones: "Jefe de operaciones",
  desarrollo: "Desarrollo",
  desarrollador: "Desarrollo",
  inventario: "Inventario",
  impresion: "Impresión",
  printing: "Impresión",
  laminacion: "Laminación",
  corte: "Corte",
  tintas: "Tintas",
  produccion: "Producción",
  calidad: "Calidad",
  vigilancia: "Vigilancia",
  solicitudes_area: "Solicitudes entre áreas",
}

type FieldTone = "violet" | "amber" | "emerald" | "sky"

const TONE_STYLES: Record<
  FieldTone,
  {
    filled: string
    focus: string
    iconFilled: string
    iconFocus: string
    label: string
  }
> = {
  violet: {
    filled:
      "border-violet-300/70 bg-violet-50/60 shadow-sm shadow-violet-500/5 dark:border-violet-700/55 dark:bg-violet-950/30",
    focus: "focus-visible:border-violet-400 focus-visible:ring-violet-500/30",
    iconFilled: "text-violet-600 dark:text-violet-400",
    iconFocus: "group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400",
    label: "text-violet-700 dark:text-violet-300",
  },
  amber: {
    filled:
      "border-amber-300/70 bg-amber-50/60 shadow-sm shadow-amber-500/5 dark:border-amber-700/55 dark:bg-amber-950/30",
    focus: "focus-visible:border-amber-400 focus-visible:ring-amber-500/30",
    iconFilled: "text-amber-600 dark:text-amber-400",
    iconFocus: "group-focus-within:text-amber-600 dark:group-focus-within:text-amber-400",
    label: "text-amber-800 dark:text-amber-300",
  },
  emerald: {
    filled:
      "border-emerald-300/70 bg-emerald-50/60 shadow-sm shadow-emerald-500/5 dark:border-emerald-700/55 dark:bg-emerald-950/30",
    focus: "focus-visible:border-emerald-400 focus-visible:ring-emerald-500/30",
    iconFilled: "text-emerald-600 dark:text-emerald-400",
    iconFocus: "group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400",
    label: "text-emerald-800 dark:text-emerald-300",
  },
  sky: {
    filled:
      "border-sky-300/70 bg-sky-50/60 shadow-sm shadow-sky-500/5 dark:border-sky-700/55 dark:bg-sky-950/30",
    focus: "focus-visible:border-sky-400 focus-visible:ring-sky-500/30",
    iconFilled: "text-sky-600 dark:text-sky-400",
    iconFocus: "group-focus-within:text-sky-600 dark:group-focus-within:text-sky-400",
    label: "text-sky-800 dark:text-sky-300",
  },
}

function formatRoleLabel(role?: string | null): string {
  const r = (role ?? "").toLowerCase().trim()
  if (!r) return "Usuario"
  return (
    ROLE_LABELS[r] ??
    r
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  )
}

type DraftLine = {
  key: string
  description: string
  quantity_requested: string
  unit: string
}

function newLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: "",
    quantity_requested: "",
    unit: "",
  }
}

function parseRequiredQty(raw: string): string | null {
  const qty = raw.trim().replace(",", ".")
  if (!qty) return null
  const n = Number(qty)
  if (!Number.isFinite(n) || n <= 0) return null
  return qty
}

type LineFieldErrors = {
  description?: boolean
  quantity?: boolean
}

type ConfirmSummary = {
  requesterName: string
  requesterRoleLabel: string
  notes: string
  lines: Array<{
    description: string
    quantity_requested: string
    unit?: string
  }>
}

type ToneInputProps = {
  tone: FieldTone
  icon: LucideIcon
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: "decimal" | "text"
  hasError?: boolean
  "aria-invalid"?: boolean
  className?: string
}

function ToneInput({
  tone,
  icon: Icon,
  value,
  onChange,
  placeholder,
  inputMode,
  hasError,
  "aria-invalid": ariaInvalid,
  className,
}: ToneInputProps) {
  const filled = value.trim().length > 0
  const s = TONE_STYLES[tone]

  return (
    <div className={cn("group relative min-w-0", className)}>
      <Icon
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200",
          hasError ? "text-destructive" : filled ? s.iconFilled : cn("text-muted-foreground/70", s.iconFocus),
        )}
        aria-hidden
      />
      <Input
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 w-full min-w-0 border-border/70 bg-background/80 pl-10 text-base transition-all duration-200 md:text-sm",
          s.focus,
          filled && !hasError && s.filled,
          hasError && "border-destructive focus-visible:ring-destructive/30",
        )}
      />
    </div>
  )
}

function ColumnHeader({
  tone,
  icon: Icon,
  label,
  align = "start",
}: {
  tone: FieldTone
  icon: LucideIcon
  label: string
  align?: "start" | "center" | "end"
}) {
  const s = TONE_STYLES[tone]
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm font-semibold",
        align === "center" && "justify-center",
        align === "end" && "justify-end",
        s.label,
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}

type LineRowProps = {
  index: number
  line: DraftLine
  descError: boolean
  qtyError: boolean
  canRemove: boolean
  onUpdate: (patch: Partial<DraftLine>) => void
  onRemove: () => void
  layout: "desktop" | "mobile"
}

function LineRow({ index, line, descError, qtyError, canRemove, onUpdate, onRemove, layout }: LineRowProps) {
  const rowHasError = descError || qtyError

  if (layout === "mobile") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-4 shadow-sm",
          rowHasError && "border-destructive/50 ring-1 ring-destructive/25",
        )}
      >
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-violet-500/80 via-primary/60 to-emerald-500/70" />
        <div className="flex items-center justify-between gap-2 pl-2">
          <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-primary/10 px-2.5 text-sm font-bold tabular-nums text-primary ring-1 ring-primary/20">
            {index + 1}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-10 w-10"
                disabled={!canRemove}
                aria-label={`Eliminar ítem ${index + 1}`}
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar ítem</TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-3 space-y-3 pl-2">
          <div className="grid gap-1.5">
            <span className={cn("flex items-center gap-2 text-sm font-semibold", TONE_STYLES.violet.label)}>
              <ClipboardList className="h-4 w-4" aria-hidden />
              Descripción *
            </span>
            <ToneInput
              tone="violet"
              icon={ClipboardList}
              value={line.description}
              placeholder="Qué necesita — ej. litro de jabón"
              hasError={descError}
              aria-invalid={descError || undefined}
              onChange={(v) => onUpdate({ description: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid min-w-0 gap-1.5">
              <span className={cn("flex items-center gap-2 text-sm font-semibold", TONE_STYLES.amber.label)}>
                <Hash className="h-4 w-4" aria-hidden />
                Cant. *
              </span>
              <ToneInput
                tone="amber"
                icon={Hash}
                value={line.quantity_requested}
                placeholder="Cantidad"
                inputMode="decimal"
                hasError={qtyError}
                aria-invalid={qtyError || undefined}
                onChange={(v) => onUpdate({ quantity_requested: v })}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <span className={cn("flex items-center gap-2 text-sm font-semibold", TONE_STYLES.emerald.label)}>
                <Ruler className="h-4 w-4" aria-hidden />
                Unid.
              </span>
              <ToneInput
                tone="emerald"
                icon={Ruler}
                value={line.unit}
                placeholder="kg, litro…"
                onChange={(v) => onUpdate({ unit: v })}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        DESKTOP_LINE_GRID,
        "group/row rounded-xl border border-border/50 bg-gradient-to-r from-muted/15 via-card to-card px-3 py-3 transition-all duration-200 hover:border-primary/20 hover:shadow-sm",
        rowHasError && "border-destructive/45 ring-1 ring-destructive/20",
      )}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold tabular-nums text-primary ring-1 ring-primary/15">
        {index + 1}
      </span>
      <ToneInput
        tone="violet"
        icon={ClipboardList}
        value={line.description}
        placeholder="Ej. litro de jabón, cloro…"
        hasError={descError}
        aria-invalid={descError || undefined}
        onChange={(v) => onUpdate({ description: v })}
      />
      <ToneInput
        tone="amber"
        icon={Hash}
        value={line.quantity_requested}
        placeholder="Cantidad"
        inputMode="decimal"
        hasError={qtyError}
        aria-invalid={qtyError || undefined}
        onChange={(v) => onUpdate({ quantity_requested: v })}
      />
      <ToneInput
        tone="emerald"
        icon={Ruler}
        value={line.unit}
        placeholder="kg"
        onChange={(v) => onUpdate({ unit: v })}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-10 w-10 justify-self-end opacity-70 transition-opacity group-hover/row:opacity-100"
            disabled={!canRemove}
            aria-label={`Eliminar ítem ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Eliminar ítem</TooltipContent>
      </Tooltip>
    </div>
  )
}

function ItemsLinesPaginator({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const from = (page - 1) * ITEMS_PAGE_SIZE + 1
  const to = Math.min(page * ITEMS_PAGE_SIZE, totalItems)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2.5">
      <p className="text-muted-foreground text-sm tabular-nums">
        Ítems <span className="text-foreground font-medium">{from}–{to}</span> de{" "}
        <span className="text-foreground font-medium">{totalItems}</span>
        <span className="mx-2 text-border">·</span>
        Página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          disabled={page <= 1}
          aria-label="Página anterior"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function MaterialRequestNewPage() {
  const navigate = useNavigate()
  const session = useMemo(() => getStoredUser(), [])
  const requesterName = session?.name?.trim() || "Usuario"
  const requesterRoleLabel = formatRoleLabel(session?.role)

  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine()])
  const [notesError, setNotesError] = useState(false)
  const [lineErrorsByKey, setLineErrorsByKey] = useState<Record<string, LineFieldErrors>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmSummary, setConfirmSummary] = useState<ConfirmSummary | null>(null)
  const [linesPage, setLinesPage] = useState(1)

  const notesFilled = notes.trim().length > 0
  const skyNotes = TONE_STYLES.sky

  const itemLinesTotalPages = Math.max(1, Math.ceil(lines.length / ITEMS_PAGE_SIZE))

  const visibleLines = useMemo(() => {
    const start = (linesPage - 1) * ITEMS_PAGE_SIZE
    return lines.slice(start, start + ITEMS_PAGE_SIZE).map((line, offset) => ({
      line,
      globalIndex: start + offset,
    }))
  }, [lines, linesPage])

  useEffect(() => {
    setLinesPage((p) => Math.min(p, itemLinesTotalPages))
  }, [itemLinesTotalPages])

  const canAddLine = lines.length < MAX_ITEM_LINES

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
    if (patch.description !== undefined || patch.quantity_requested !== undefined) {
      setLineErrorsByKey((prev) => {
        const cur = prev[key]
        if (!cur) return prev
        const next = { ...cur }
        if (patch.description !== undefined) delete next.description
        if (patch.quantity_requested !== undefined) delete next.quantity
        if (Object.keys(next).length === 0) {
          const { [key]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [key]: next }
      })
    }
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((x) => x.key !== key))
    setLineErrorsByKey((prev) => {
      const { [key]: _, ...rest } = prev
      return rest
    })
  }

  function addLine() {
    if (!canAddLine) {
      toast.error(`Máximo ${MAX_ITEM_LINES} ítems por solicitud.`)
      return
    }
    const nextCount = lines.length + 1
    setLines((prev) => [...prev, newLine()])
    setLinesPage(Math.ceil(nextCount / ITEMS_PAGE_SIZE))
  }

  function goToLinePageForIndex(lineIndex: number) {
    setLinesPage(Math.floor(lineIndex / ITEMS_PAGE_SIZE) + 1)
  }

  function buildPayloadLines(): ConfirmSummary["lines"] {
    return lines
      .map((ln) => {
        const desc = ln.description.trim()
        const qty = parseRequiredQty(ln.quantity_requested)
        if (!desc || !qty) return null
        return {
          description: desc,
          quantity_requested: qty,
          ...(ln.unit.trim() ? { unit: ln.unit.trim() } : {}),
        }
      })
      .filter(Boolean) as ConfirmSummary["lines"]
  }

  function validateForm(): boolean {
    let ok = true
    const lineErrs: Record<string, LineFieldErrors> = {}

    if (!notes.trim()) {
      setNotesError(true)
      ok = false
    } else {
      setNotesError(false)
    }

    let firstErrorLineIndex: number | null = null

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]
      const e: LineFieldErrors = {}
      const desc = ln.description.trim()
      const qty = parseRequiredQty(ln.quantity_requested)

      if (!desc) {
        e.description = true
        ok = false
      }
      if (!qty) {
        e.quantity = true
        ok = false
      }
      if (Object.keys(e).length) {
        lineErrs[ln.key] = e
        if (firstErrorLineIndex === null) firstErrorLineIndex = i
      }
    }

    if (firstErrorLineIndex !== null) {
      goToLinePageForIndex(firstErrorLineIndex)
    }

    setLineErrorsByKey(lineErrs)

    if (!ok) {
      toast.error("Complete observaciones, descripción y cantidad en cada ítem. Unidad es opcional.")
      return false
    }

    return true
  }

  function openConfirmModal() {
    if (!validateForm()) return

    setConfirmSummary({
      requesterName,
      requesterRoleLabel,
      notes: notes.trim(),
      lines: buildPayloadLines(),
    })
    setConfirmOpen(true)
  }

  async function executeCreate() {
    const payloadLines = buildPayloadLines()
    if (payloadLines.length === 0) {
      toast.error("Agregue al menos un ítem completo.")
      return
    }

    try {
      setSubmitting(true)
      await apiFetch<{ id: number }>("material-requests", {
        method: "POST",
        body: JSON.stringify({
          notes: notes.trim(),
          lines: payloadLines,
        }),
      })
      setConfirmOpen(false)
      toast.success("Solicitud de insumos enviada.")
      navigate("/solicitudes-material", { replace: true })
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la solicitud.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 via-primary/15 to-emerald-500/15 ring-1 ring-primary/20 shadow-sm">
                <Package className="text-primary h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Nueva solicitud de insumos</h1>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed md:text-base">
                  Describa lo que necesita del almacén. El encargado revisará stock al despachar.
                </p>
              </div>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 shadow-sm" asChild>
                <Link to="/solicitudes-material" aria-label="Volver a solicitudes">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Volver a solicitudes</TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[0.06] via-violet-500/[0.04] to-emerald-500/[0.05] px-4 py-3 text-base shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/80 ring-1 ring-primary/15">
              <User className="text-primary h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="text-foreground font-semibold">{requesterName}</span>
              <span className="text-muted-foreground mx-2">·</span>
              <span className="text-muted-foreground">{requesterRoleLabel}</span>
            </span>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-md shadow-primary/5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

            <div className="space-y-6 p-5 md:p-7">
              <div className="grid gap-2">
                <Label htmlFor="mr-notes" className="flex items-center gap-2 text-base font-medium">
                  <FileText className="text-muted-foreground h-5 w-5" aria-hidden />
                  Observaciones *
                </Label>
                <div className="group relative">
                  <FileText
                    className={cn(
                      "pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 transition-colors duration-200",
                      notesError
                        ? "text-destructive"
                        : notesFilled
                          ? skyNotes.iconFilled
                          : cn("text-muted-foreground/60", skyNotes.iconFocus),
                    )}
                    aria-hidden
                  />
                  <Textarea
                    id="mr-notes"
                    rows={3}
                    placeholder="Motivo, máquina, urgencia, etc."
                    value={notes}
                    aria-invalid={notesError || undefined}
                    onChange={(e) => {
                      setNotes(e.target.value)
                      if (notesError && e.target.value.trim()) setNotesError(false)
                    }}
                    className={cn(
                      "min-h-[5.5rem] resize-y border-border/70 bg-background/80 pl-12 text-base transition-all duration-200 md:text-sm",
                      skyNotes.focus,
                      notesFilled && !notesError && skyNotes.filled,
                      notesError && "border-destructive focus-visible:ring-destructive/30",
                    )}
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Label className="flex items-center gap-2 text-base font-medium">
                      <ClipboardList className="text-primary h-5 w-5" aria-hidden />
                      Ítems solicitados
                    </Label>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Descripción y cantidad obligatorias. Unidad opcional. Máximo {MAX_ITEM_LINES} ítems
                      {ITEMS_PAGE_SIZE < MAX_ITEM_LINES ? ` (${ITEMS_PAGE_SIZE} por página)` : ""}.
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                      {lines.length} / {MAX_ITEM_LINES} ítems
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        disabled={!canAddLine}
                        className="h-11 w-11 shrink-0 rounded-full bg-primary shadow-lg shadow-primary/30 transition-transform hover:scale-105 hover:bg-primary/90 disabled:opacity-40 disabled:hover:scale-100"
                        aria-label="Añadir ítem"
                        onClick={addLine}
                      >
                        <Plus className="h-5 w-5" strokeWidth={2.5} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {canAddLine ? "Añadir ítem" : `Límite de ${MAX_ITEM_LINES} ítems alcanzado`}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="hidden md:flex md:flex-col md:gap-3">
                  <div
                    className={cn(
                      DESKTOP_LINE_GRID,
                      "border-border/60 border-b px-3 pb-3",
                    )}
                  >
                    <span className="text-muted-foreground text-center text-sm font-semibold">#</span>
                    <ColumnHeader tone="violet" icon={ClipboardList} label="Descripción *" />
                    <ColumnHeader tone="amber" icon={Hash} label="Cant. *" align="center" />
                    <ColumnHeader tone="emerald" icon={Ruler} label="Unid." align="center" />
                    <span className="sr-only">Eliminar</span>
                  </div>

                  {visibleLines.map(({ line: ln, globalIndex }) => {
                    const le = lineErrorsByKey[ln.key]
                    return (
                      <LineRow
                        key={ln.key}
                        index={globalIndex}
                        line={ln}
                        descError={Boolean(le?.description)}
                        qtyError={Boolean(le?.quantity)}
                        canRemove={lines.length > 1}
                        layout="desktop"
                        onUpdate={(patch) => updateLine(ln.key, patch)}
                        onRemove={() => removeLine(ln.key)}
                      />
                    )
                  })}

                  <ItemsLinesPaginator
                    page={linesPage}
                    totalPages={itemLinesTotalPages}
                    totalItems={lines.length}
                    onPageChange={setLinesPage}
                  />
                </div>

                <div className="space-y-3 md:hidden">
                  {visibleLines.map(({ line: ln, globalIndex }) => {
                    const le = lineErrorsByKey[ln.key]
                    return (
                      <LineRow
                        key={ln.key}
                        index={globalIndex}
                        line={ln}
                        descError={Boolean(le?.description)}
                        qtyError={Boolean(le?.quantity)}
                        canRemove={lines.length > 1}
                        layout="mobile"
                        onUpdate={(patch) => updateLine(ln.key, patch)}
                        onRemove={() => removeLine(ln.key)}
                      />
                    )
                  })}

                  <ItemsLinesPaginator
                    page={linesPage}
                    totalPages={itemLinesTotalPages}
                    totalItems={lines.length}
                    onPageChange={setLinesPage}
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-border/60 pt-5">
                <Button type="button" variant="outline" asChild>
                  <Link to="/solicitudes-material">Cancelar</Link>
                </Button>
                <Button
                  type="button"
                  disabled={submitting}
                  className="gap-2 px-6 shadow-md shadow-primary/20"
                  onClick={() => openConfirmModal()}
                >
                  <SendHorizonal className="h-4 w-4" aria-hidden />
                  Crear solicitud
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!submitting) {
            setConfirmOpen(open)
            if (!open) setConfirmSummary(null)
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border-primary/15 p-0 shadow-xl shadow-primary/10 sm:max-w-xl">
          <div className="relative bg-gradient-to-br from-violet-500/15 via-primary/10 to-emerald-500/10 px-6 pb-5 pt-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/90 shadow-sm ring-1 ring-primary/20">
                  <PackageCheck className="text-primary h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1.5">
                  <DialogTitle className="text-xl leading-snug">¿Crear esta solicitud de insumos?</DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed">
                    Revise la información antes de enviarla al encargado de inventario.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {confirmSummary ? (
            <div className="space-y-3 px-6 py-5">
              <div className="flex gap-3 rounded-2xl bg-violet-500/[0.07] px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
                  <User className="text-violet-600 h-4 w-4 dark:text-violet-400" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-violet-800 text-xs font-semibold dark:text-violet-300">Solicitante</p>
                  <p className="text-foreground mt-0.5 text-sm font-medium leading-snug">
                    {confirmSummary.requesterName}
                  </p>
                  <p className="text-muted-foreground text-sm">{confirmSummary.requesterRoleLabel}</p>
                </div>
              </div>

              <div className="flex gap-3 rounded-2xl bg-sky-500/[0.07] px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                  <FileText className="text-sky-600 h-4 w-4 dark:text-sky-400" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sky-800 text-xs font-semibold dark:text-sky-300">Observaciones</p>
                  <p className="text-foreground mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">
                    {confirmSummary.notes}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-semibold">
                  <ClipboardList className="text-primary h-4 w-4" aria-hidden />
                  Ítems solicitados
                </p>
                <ul className="space-y-2">
                  {confirmSummary.lines.map((ln, idx) => (
                    <li
                      key={idx}
                      className="flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-muted/40 via-background to-muted/20 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground font-medium leading-snug">{ln.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-sm tabular-nums text-amber-950 dark:text-amber-100">
                          <Hash className="h-3.5 w-3.5 opacity-80" aria-hidden />
                          {ln.quantity_requested}
                        </span>
                        {ln.unit ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1 text-sm text-emerald-950 dark:text-emerald-100">
                            <Ruler className="h-3.5 w-3.5 opacity-80" aria-hidden />
                            {ln.unit}
                          </span>
                        ) : (
                          <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs">
                            <Ruler className="h-3.5 w-3.5 opacity-60" aria-hidden />
                            Sin unidad
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-3 border-0 bg-muted/20 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              className="rounded-full px-5"
              onClick={() => setConfirmOpen(false)}
            >
              No, volver
            </Button>
            <Button
              type="button"
              disabled={submitting || !confirmSummary}
              className="rounded-full px-6 shadow-md shadow-primary/25"
              onClick={() => void executeCreate()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : (
                <>
                  <SendHorizonal className="mr-2 h-4 w-4" aria-hidden />
                  Sí, crear solicitud
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
