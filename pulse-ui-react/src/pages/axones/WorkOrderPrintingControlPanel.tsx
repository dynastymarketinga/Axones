"use client"

import { createElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  MesGuardarChoiceDialog,
  MES_GUARDAR_AREA_LABELS,
  MesOperativoEstadoCard,
  MesSectionShell,
  mesGuardarChoiceHint,
} from "@/components/axones/mes"
import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow, SupplierRecord } from "@/types/api"
import { showAxonesSuccessSwal, type AxonesSwalTone } from "@/lib/axones-success-swal"
import { appAbsoluteUrl } from "@/lib/app-base-path"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import WorkOrderPrintingOpsSection, {
  type BobinaLabelMeta,
  type DraftPerson,
  type DraftPersonRole,
  stringsFromActivePersonnel,
} from "./WorkOrderPrintingOpsSection"
import { applyMesPhaseConfirmToTimer } from "@/lib/mes-multi-phase-timer-exec"
import {
  cumulativeDeadSeconds,
  cumulativeEffectiveSeconds,
  cumulativeTotalPersistedSeconds,
  deadAccSecAfterResume,
  formatHmsFromSeconds,
  formatHoraArranqueFromMs,
  horaArranqueMsFromTimer,
} from "@/lib/mes-timer-band-shared"
import {
  buildMesTimerActionFlags,
  getMesTimerConfirm,
  mesTimerConfirmNeedsActiveTurno,
  type MesTimerConfirmKey,
} from "./mes-timer-actions"
import {
  derivePrintingOperativoEstado,
  PRINTING_CONTROL_SAVED_EVENT,
} from "@/lib/printing-mes-band-status"
import { openPrintingPlanillaPreviewFromSource } from "@/lib/printing-planilla-preview"
import {
  canSaveProductionAreaForm,
  hasProductionTimerStarted,
  mesTimerFieldsFromForm,
  MES_PRODUCTION_SAVE_CONFIG,
  MES_SAVE_BLOCKED_MESSAGE,
} from "@/lib/mes-timer-guards"
import {
  IMP_ACTUAL_KEY,
  IMP_ESTADO_KEY,
  IMP_TURNOS_KEY,
  accumulatePrintingFromJson,
  bootstrapPrintingFormState,
  cumulativeDemountSeconds,
  buildPrintingTurnoResumenCierre,
  countDevolucionRechazadaBobinas,
  clearPrintingMirrorKeys,
  createNewPrintingTurno,
  getLastClosedPrintingTurno,
  finalizeTurnTimerNow,
  flushPrintingTurnoOperativoToCapturas,
  printingAggregatedTimerMirrorFromTurnos,
  IMP_BOBINAS_SLOTS,
  parsePrintingTurnoActual,
  parsePrintingTurnos,
  printingTurnoToMirror,
  readEstadoArea,
  syncPrintingTurnoFromFormMirror,
  turnoProduccionTotals,
  type PrintingTurnoEntry,
  type PrintingTurnTimer,
  allRejectedEntriesHaveMotivo,
  countRejectedEntryKg,
  newWarehouseRejectedEntry,
  normalizeSalidaBobinaLabelMeta,
  rejectedEntriesWithBobinas,
  sanitizeBobinaKgSlotInput,
  parseBobinaKgSlotNumber,
  sumRejectedEntryBobinas,
  sumRejectedEntryKg,
  type WarehouseRejectedEntry,
  type WarehouseReturnDraft,
} from "./printing-turnos"
import {
  buildGoodReturnReason,
  buildRejectedReturnReason,
  materialSpecificationsLabel,
  rejectReasonLabel,
  todayIsoDate,
} from "./warehouse-return-helpers"
import "./work-order-planilla.css"
import { AlertCircle, CheckCircle2, CirclePlay, FileSearch, Flag, LogOut, NotebookPen, Save, Sparkles, Users } from "lucide-react"

import { getStoredUser } from "@/lib/auth-storage"
import { navigateToMesBandeja } from "@/lib/mes-bandeja-navigation"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  product_id?: number | null
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

type PrintingPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }
type ProductionSummaryPayload = {
  printing?: {
    open_time_segment?: {
      segment_type?: string | null
      ended_at?: string | null
    } | null
    time_segments_recent?: Array<{
      segment_type?: string | null
      ended_at?: string | null
    }>
    bobina_usages?: Array<{
      quantity_used_kg?: number | string | null
      quantity_finished_kg?: number | string | null
    }>
  } | null
}

type InventoryReturnCreated = { id: number }

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumberString(v: unknown): string {
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v
  return ""
}

function readNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function toFiniteOrNull(v: unknown): number | null {
  const raw = readNumberString(v).trim().replace(",", ".")
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function normalizeNumericString(v: unknown): string {
  const n = toFiniteOrNull(v)
  if (n === null) return ""
  return String(n)
}

/** Borrador legacy del panel (solo se purga al cargar; ya no se escribe). */
const LEGACY_PRINTING_DRAFT_KEY = "axones.printing.control.draft."

/** Tonos visuales para confirmaciones del panel de impresión (alineados a cada acción). */
type MesPrintingConfirmTone =
  | "emerald"
  | "sky"
  | "indigo"
  | "violet"
  | "amber"
  | "orange"
  | "rose"
  | "red"

const MES_PRINTING_CONFIRM: Record<MesPrintingConfirmTone, { panel: string; iconBox: string }> = {
  emerald: {
    panel:
      "border-emerald-200/80 bg-gradient-to-b from-emerald-50/55 to-background sm:max-w-md sm:rounded-lg dark:from-emerald-950/35 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-300",
  },
  sky: {
    panel:
      "border-sky-200/80 bg-gradient-to-b from-sky-50/55 to-background sm:max-w-md sm:rounded-lg dark:from-sky-950/35 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-100/80 text-sky-800 dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-300",
  },
  indigo: {
    panel:
      "border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-indigo-950/35 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-100/80 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/45 dark:text-indigo-300",
  },
  violet: {
    panel:
      "border-violet-200/70 bg-gradient-to-b from-violet-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-violet-950/30 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-100/80 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  },
  amber: {
    panel:
      "border-amber-200/85 bg-gradient-to-b from-amber-50/55 to-background sm:max-w-md sm:rounded-lg dark:from-amber-950/30 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-100/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-300",
  },
  orange: {
    panel:
      "border-orange-200/85 bg-gradient-to-b from-orange-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-orange-950/28 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-100/80 text-orange-900 dark:border-orange-800 dark:bg-orange-950/45 dark:text-orange-300",
  },
  rose: {
    panel:
      "border-rose-200/80 bg-gradient-to-b from-rose-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-rose-950/28 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-100/80 text-rose-800 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-300",
  },
  red: {
    panel:
      "border-red-300/70 bg-gradient-to-b from-red-50/55 to-background sm:max-w-md sm:rounded-lg dark:from-red-950/40 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-100/80 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
  },
}

type MesPrintingConfirmDialogProps = {
  tone: MesPrintingConfirmTone
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  confirmVariant?: "default" | "destructive"
}

function MesPrintingConfirmDialog(props: MesPrintingConfirmDialogProps) {
  const skin = MES_PRINTING_CONFIRM[props.tone]
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={skin.panel}>
        <DialogHeader className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className={skin.iconBox}>{props.icon}</div>
            <div className="min-w-0 space-y-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">{props.title}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">{props.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant={props.confirmVariant ?? "default"} onClick={() => props.onConfirm()}>
            {props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const MES_PRINTING_WARNING_TOAST_CLASSNAMES = {
  toast:
    "!border !border-amber-200 !bg-white !text-slate-900 shadow-md [&_[data-description]]:!text-slate-600",
  title: "!text-slate-900 text-sm font-medium",
  warning: "!bg-white !border-amber-200 !text-slate-900",
  description: "!text-slate-600 text-sm leading-snug",
  icon: "text-amber-600",
} as const

function mesPrintingShowSwal(
  tone: AxonesSwalTone,
  title: string,
  text?: string,
  options?: { html?: string },
) {
  void showAxonesSuccessSwal(title, text, { ...options, tone })
}

function mesPrintingToastWarning(message: string) {
  toast.warning(message, {
    richColors: false,
    classNames: MES_PRINTING_WARNING_TOAST_CLASSNAMES,
    icon: createElement(AlertCircle, { className: "h-4 w-4 shrink-0 text-amber-600", "aria-hidden": true }),
  })
}

/** Texto del modal «Guardado» según estado MES y permisos. */
function printingGuardadoSwalContent(
  formSnapshot: Record<string, unknown>,
  canFinalizeArea: boolean,
): { text?: string; html?: string } {
  const op = derivePrintingOperativoEstado(formSnapshot)
  const wf = op.workflow

  if (wf === "entre_turnos") {
    const finalizeAreaLine = canFinalizeArea
      ? `<li><span class="font-semibold">Finalizar cierre</span>: si ya no queda impresión en esta OT, pulse <span class="font-semibold">Guardar</span> y elija esta opción del área Impresión.</li>`
      : `<li><span class="font-semibold">Finalizar cierre</span>: avise a jefatura cuando la impresión de la OT esté completa.</li>`
    return {
      html: `<p class="text-sm leading-relaxed">Estado: <span class="font-semibold">Entre turnos</span> — datos guardados en el servidor.</p>
<p class="mt-3 text-sm font-semibold">Próximo paso</p>
<ul class="mt-1 list-disc space-y-2 pl-5 text-left text-sm leading-relaxed">
<li><span class="font-semibold">Finalizar turno</span> (siguiente cuadrilla): abra un <span class="font-semibold">turno nuevo</span> arriba; al terminar la jornada, <span class="font-semibold">Guardar → Finalizar turno</span>.</li>
${finalizeAreaLine}
</ul>`,
    }
  }

  if (wf === "turno_abierto") {
    const finalizeAreaHint = canFinalizeArea
      ? ' o <span class="font-semibold">Finalizar cierre</span> del área Impresión'
      : ""
    return {
      html: `<p class="text-sm leading-relaxed">Turno de planta abierto y guardado. Use play en «Cronómetro de producción» para iniciar tiempos.</p>
<p class="mt-2 text-sm leading-relaxed">Al terminar la jornada: <span class="font-semibold">Guardar → Finalizar turno</span>${finalizeAreaHint}.</p>`,
    }
  }

  const text = op.title.trim()
  return text ? { text } : {}
}

/** Modal breve: título + detalle opcional (estado en bandeja). */
function mesPrintingSwalWithBandeja(
  formSnapshot: Record<string, unknown>,
  title: string,
  detail?: string,
  canFinalizeArea = false,
  tone: AxonesSwalTone = "guardado",
) {
  if (detail?.trim()) {
    void showAxonesSuccessSwal(title, detail.trim(), { tone })
    return
  }
  if (title === "Guardado") {
    const content = printingGuardadoSwalContent(formSnapshot, canFinalizeArea)
    void showAxonesSuccessSwal(title, content.text, { html: content.html, tone: "guardado" })
    return
  }
  const op = derivePrintingOperativoEstado(formSnapshot)
  const text = op.title.trim()
  void showAxonesSuccessSwal(title, text && text !== title ? text : undefined, { tone })
}

function purgeLegacyPrintingControlDraft(workOrderId: number) {
  try {
    localStorage.removeItem(`${LEGACY_PRINTING_DRAFT_KEY}${workOrderId}`)
  } catch {
    // ignore
  }
}

function clearPrintingBrowserCache(workOrderId: number) {
  purgeLegacyPrintingControlDraft(workOrderId)
  try {
    localStorage.removeItem(`axones.printing.timer-preview.${workOrderId}`)
    localStorage.removeItem(`axones.printing.wastage-preview.${workOrderId}`)
  } catch {
    // ignore
  }
}

function mergePrefill(prefill: Record<string, unknown>, form?: Record<string, unknown> | null) {
  return { ...prefill, ...(form ?? {}) }
}

function getNumericSeries(form: Record<string, unknown>, key: string, size: number): string[] {
  const raw = form[key]
  if (!Array.isArray(raw)) return Array.from({ length: size }, () => "")
  const out = raw.slice(0, size).map((v) => readNumberString(v))
  while (out.length < size) out.push("")
  return out
}

function todayBobinaLabelFecha(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yyyy = String(now.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function labelEditorDraftFromMeta(
  meta: BobinaLabelMeta | undefined,
  mode: "entrada" | "salida",
): BobinaLabelMeta {
  if (mode === "salida") {
    const draft = normalizeSalidaBobinaLabelMeta(meta ?? {})
    if (!draft.fecha.trim()) draft.fecha = todayBobinaLabelFecha()
    return draft
  }
  const draft = meta ? { ...meta } : emptyBobinaLabelMeta()
  if (!draft.fecha.trim()) draft.fecha = todayBobinaLabelFecha()
  return draft
}

function emptyBobinaLabelMeta(): BobinaLabelMeta {
  return {
    fecha: "",
    hora: "",
    referencia: "",
    lote: "",
    proveedor: "",
    operador: "",
    metraje: "",
    peso: "",
    medida_ancho: "",
    tratamiento_interno: "",
    tratamiento_externo: "",
    maquina_origen: "",
    pedido_lote: "",
    empalmes: "",
  }
}

function normalizeBobinaLabelMeta(meta: BobinaLabelMeta): BobinaLabelMeta {
  return {
    fecha: readString(meta.fecha).trim(),
    hora: readString(meta.hora).trim(),
    referencia: readString(meta.referencia).trim(),
    lote: readString(meta.lote).trim(),
    proveedor: readString(meta.proveedor).trim(),
    operador: readString(meta.operador).trim(),
    metraje: readString(meta.metraje).trim(),
    peso: readString(meta.peso).trim(),
    medida_ancho: readString(meta.medida_ancho).trim(),
    tratamiento_interno: readString(meta.tratamiento_interno).trim(),
    tratamiento_externo: readString(meta.tratamiento_externo).trim(),
    maquina_origen: readString(meta.maquina_origen).trim(),
    pedido_lote: readString(meta.pedido_lote).trim(),
    empalmes: readString(meta.empalmes).trim(),
  }
}

function getMetaSeries(form: Record<string, unknown>, key: string, size: number): BobinaLabelMeta[] {
  const raw = form[key]
  const out: BobinaLabelMeta[] = []
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, size)) {
      if (item && typeof item === "object") {
        out.push(
          normalizeBobinaLabelMeta({
            ...emptyBobinaLabelMeta(),
            ...(item as Record<string, unknown>),
          } as BobinaLabelMeta),
        )
      } else {
        out.push(emptyBobinaLabelMeta())
      }
    }
  }
  while (out.length < size) out.push(emptyBobinaLabelMeta())
  return out
}

function formatTimerHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, "0")
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

export default function WorkOrderPrintingControlPanel({
  workOrderId,
  canFinalizeOrder = false,
}: {
  workOrderId: number
  /** Solo jefe/admin puede finalizar el área de impresión (impEstadoArea). */
  canFinalizeOrder?: boolean
}) {
  const navigate = useNavigate()
  const impObsTextareaId = useId().replace(/:/g, "")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [productionSummary, setProductionSummary] = useState<ProductionSummaryPayload | null>(null)

  /** Borrador para iniciar turno (sin turno activo). */
  const [draftTurno, setDraftTurno] = useState<"diurno" | "nocturno">("diurno")
  const [draftGrupo, setDraftGrupo] = useState<"A" | "B" | "C">("A")
  const [draftPeople, setDraftPeople] = useState<DraftPerson[]>([])
  const [draftStaging, setDraftStaging] = useState<{ name: string; role: DraftPersonRole }>({
    name: "",
    role: "operador",
  })
  const draftPeopleRef = useRef<DraftPerson[]>([])
  draftPeopleRef.current = draftPeople

  const draftOperadorName = useMemo(
    () => draftPeople.find((p) => p.role === "operador")?.name.trim() ?? "",
    [draftPeople],
  )
  const draftSupervisorName = useMemo(
    () => draftPeople.find((p) => p.role === "supervisor")?.name.trim() ?? "",
    [draftPeople],
  )
  const draftAyudantesLabel = useMemo(() => {
    const names = draftPeople
      .filter((p) => p.role === "ayudante")
      .map((p) => p.name.trim())
      .filter(Boolean)
    return names.join("; ")
  }, [draftPeople])
  const draftOperadorMissing = useMemo(() => !draftOperadorName, [draftOperadorName])

  const onDraftStagingName = useCallback((v: string) => {
    setDraftStaging((s) => ({ ...s, name: v }))
  }, [])

  const onDraftStagingRole = useCallback((v: DraftPersonRole) => {
    setDraftStaging((s) => ({ ...s, role: v }))
  }, [])

  const guardarDraftPerson = useCallback((name: string, role: DraftPersonRole) => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Escriba el nombre antes de guardar.")
      return
    }
    const prev = draftPeopleRef.current
    if (role === "supervisor" && prev.some((p) => p.role === "supervisor")) {
      mesPrintingToastWarning("Solo puede haber un Supervisor en el turno.")
      return
    }
    if (role === "operador" && prev.some((p) => p.role === "operador")) {
      mesPrintingToastWarning("Solo puede haber un Operador principal en el turno.")
      return
    }
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setDraftPeople((p) => [...p, { id, role, name: trimmed, grupo: draftGrupo, turno: draftTurno }])
    setDraftStaging((s) => ({ ...s, name: "" }))
  }, [draftGrupo, draftTurno])

  const removeDraftPerson = useCallback((id: string) => {
    setDraftPeople((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      setPrefill(payload.prefill ?? {})
      const mergedForm = mergePrefill(payload.prefill ?? {}, payload.form)
      const boot = bootstrapPrintingFormState(mergedForm)
      const areaEstadoOnLoad = readEstadoArea(boot[IMP_ESTADO_KEY])
      purgeLegacyPrintingControlDraft(workOrderId)
      setForm(boot)
      if (areaEstadoOnLoad === "finalizada") {
        try {
          localStorage.removeItem(`axones.printing.timer-preview.${workOrderId}`)
          localStorage.removeItem(`axones.printing.wastage-preview.${workOrderId}`)
        } catch {
          // ignore
        }
      }
      try {
        const summary = await apiFetch<ProductionSummaryPayload>(
          `work-orders/${workOrderId}/production-summary`,
        )
        setProductionSummary(summary)
      } catch {
        setProductionSummary(null)
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT para impresión.")
      setPrefill({})
      setForm({})
      setProductionSummary(null)
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  const formRef = useRef(form)
  formRef.current = form
  const canFinalizeOrderRef = useRef(canFinalizeOrder)
  canFinalizeOrderRef.current = canFinalizeOrder

  const closedTurnos = useMemo(() => parsePrintingTurnos(form[IMP_TURNOS_KEY]), [form])
  const lastClosedTurno = useMemo(() => getLastClosedPrintingTurno(closedTurnos), [closedTurnos])
  const activeTurno = useMemo(() => parsePrintingTurnoActual(form[IMP_ACTUAL_KEY]), [form])
  const areaEstado = readEstadoArea(form[IMP_ESTADO_KEY])
  const areaFinalizada = areaEstado === "finalizada"
  const readOnlyOps = areaFinalizada && !canFinalizeOrder
  const hasActiveTurno = activeTurno !== null
  const jsonAccum = useMemo(
    () => accumulatePrintingFromJson(closedTurnos, activeTurno),
    [closedTurnos, activeTurno],
  )

  const patchActiveTurn = useCallback((updater: (t: PrintingTurnoEntry) => PrintingTurnoEntry) => {
    setForm((prev) => {
      const cur = parsePrintingTurnoActual(prev[IMP_ACTUAL_KEY])
      if (!cur) return prev
      const nextTurn = updater(cur)
      return {
        ...prev,
        [IMP_ACTUAL_KEY]: nextTurn,
        ...printingTurnoToMirror(nextTurn),
      }
    })
  }, [])

  const entradaBobinas = useMemo(() => getNumericSeries(form, "impEntradaBobinasKg", IMP_BOBINAS_SLOTS), [form])
  const salidaBobinas = useMemo(() => getNumericSeries(form, "impSalidaBobinasKg", IMP_BOBINAS_SLOTS), [form])
  const entradaBobinasMeta = useMemo(() => getMetaSeries(form, "impEntradaBobinasMeta", IMP_BOBINAS_SLOTS), [form])
  const salidaBobinasMeta = useMemo(() => getMetaSeries(form, "impSalidaBobinasMeta", IMP_BOBINAS_SLOTS), [form])
  const totalEntradaTurnoActual = useMemo(
    () => entradaBobinas.reduce((acc, v) => acc + parseBobinaKgSlotNumber(v), 0),
    [entradaBobinas],
  )
  const totalSalida = useMemo(
    () => salidaBobinas.reduce((acc, v) => acc + parseBobinaKgSlotNumber(v), 0),
    [salidaBobinas],
  )
  const scrapTransparente = readNumber(form.impScrapTransparenteKg)
  const scrapImpreso = readNumber(form.impScrapImpresoKg)
  const totalScrap = scrapTransparente + scrapImpreso
  const devolucionBuena = readNumber(form.impDevolucionBuenaKg)
  const devolucionRechazadaKg = readNumber(form.impDevolucionRechazadaKg)
  const devolucionRechazadaBobinas = countDevolucionRechazadaBobinas(
    form.impDevolucionRechazadaBobinas,
    form.impDevolucionRechazadaKg,
  )
  const devolucionesPendienteAlmacen = useMemo(() => {
    const b = toFiniteOrNull(form.impDevolucionBuenaKg) ?? 0
    const rKg = readNumber(form.impDevolucionRechazadaKg)
    const r =
      rKg > 0
        ? rKg
        : countDevolucionRechazadaBobinas(
            form.impDevolucionRechazadaBobinas,
            form.impDevolucionRechazadaKg,
          )
    if (b <= 0 && r <= 0) return false
    const envioMs = readNumber(form.impDevolucionesAlmacenUltimoEnvioMs)
    const snapB = readString(form.impDevolucionesAlmacenSnapBuena)
    const snapR = readString(form.impDevolucionesAlmacenSnapRech)
    const curB = normalizeNumericString(form.impDevolucionBuenaKg)
    const curR = normalizeNumericString(
      readNumberString(form.impDevolucionRechazadaKg) || String(r),
    )
    if (envioMs <= 0) return true
    return curB !== snapB || curR !== snapR
  }, [
    form.impDevolucionBuenaKg,
    form.impDevolucionRechazadaBobinas,
    form.impDevolucionRechazadaKg,
    form.impDevolucionesAlmacenUltimoEnvioMs,
    form.impDevolucionesAlmacenSnapBuena,
    form.impDevolucionesAlmacenSnapRech,
  ])
  const pedidoTotalKg = readNumber(form.pedidoKg ?? prefill.pedidoKg)
  const summaryPrinting = productionSummary?.printing
  const historicalBobinaUsages = summaryPrinting?.bobina_usages ?? []
  const historicalSegments = summaryPrinting?.time_segments_recent ?? []
  const historicalEntrada = historicalBobinaUsages.reduce(
    (acc, row) => acc + readNumber(row.quantity_used_kg),
    0,
  )
  const historicalSalida = historicalBobinaUsages.reduce(
    (acc, row) => acc + readNumber(row.quantity_finished_kg),
    0,
  )
  const historicalTurns = historicalSegments.filter(
    (seg) => seg.segment_type === "production" && !!seg.ended_at,
  ).length
  const inferredHistoricalTurns =
    historicalTurns > 0 ? historicalTurns : historicalEntrada > 0 || historicalSalida > 0 ? 1 : 0
  const planillaProducidoKg = readNumber(form.kgSalidaImp ?? prefill.kgSalidaImp)
  const planillaEntradaKg = readNumber(form.kgIngresadoImp ?? prefill.kgIngresadoImp)
  const formProducedBaseline = readNumber(form.impAcumuladoProducidoKg)
  const mesProducidoKg = Math.max(formProducedBaseline, jsonAccum.producidoKg)
  const mesEntradaKg = jsonAccum.entradaKg
  const producidoAcumuladoKg = Math.max(mesProducidoKg, historicalSalida, planillaProducidoKg)
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = Math.max(
    jsonAccum.turnosRegistrados,
    inferredHistoricalTurns,
    planillaProducidoKg > 0 || planillaEntradaKg > 0 ? 1 : 0,
  )
  const totalEntradaAcumulada = Math.max(mesEntradaKg, historicalEntrada, planillaEntradaKg)
  const formScrapAcumulado = readNumber(form.impScrapAcumuladoKg)
  const totalScrapAcumulado = Math.max(formScrapAcumulado, jsonAccum.scrapKg, totalScrap)
  const hasOpenHistoricalProductionSegment =
    summaryPrinting?.open_time_segment?.segment_type === "production" &&
    !summaryPrinting?.open_time_segment?.ended_at
  const formUltimoTurnoLabel = hasActiveTurno
    ? "Turno en curso"
    : jsonAccum.ultimoCierreLabel
  const ultimoTurnoLabel = hasActiveTurno
    ? formUltimoTurnoLabel
    : hasOpenHistoricalProductionSegment
      ? "Turno en ejecución"
      : inferredHistoricalTurns > 0
        ? "Turno cerrado"
        : planillaProducidoKg > 0 || planillaEntradaKg > 0
          ? "Datos de planilla"
          : formUltimoTurnoLabel

  const [timerTick, setTimerTick] = useState(0)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [labelEditorOpen, setLabelEditorOpen] = useState(false)
  const [labelEditorMode, setLabelEditorMode] = useState<"entrada" | "salida">("entrada")
  const [labelEditorIndex, setLabelEditorIndex] = useState(0)
  const [labelEditorDraft, setLabelEditorDraft] = useState<BobinaLabelMeta>(emptyBobinaLabelMeta())
  const [labelEditorError, setLabelEditorError] = useState("")
  const [returnWarehouseOpen, setReturnWarehouseOpen] = useState(false)
  const [startTurnConfirmOpen, setStartTurnConfirmOpen] = useState(false)
  const [timerConfirm, setTimerConfirm] = useState<MesTimerConfirmKey | null>(null)
  const [takeoverConfirmOpen, setTakeoverConfirmOpen] = useState(false)
  const [previewTimerConfirmOpen, setPreviewTimerConfirmOpen] = useState(false)
  const [guardarChoiceOpen, setGuardarChoiceOpen] = useState(false)
  const [closeTurnConfirmOpen, setCloseTurnConfirmOpen] = useState(false)
  const [finalizeOtConfirmOpen, setFinalizeOtConfirmOpen] = useState(false)
  const [emptyShiftCloseDialogOpen, setEmptyShiftCloseDialogOpen] = useState(false)
  const pendingEmptyShiftCloseRef = useRef<{
    cur: PrintingTurnoEntry
    finalizedTimer: PrintingTurnTimer
    notifyProductionSave?: boolean
  } | null>(null)
  const [returnLoadingMaterialsGood, setReturnLoadingMaterialsGood] = useState(false)
  const [returnLoadingMaterialsBad, setReturnLoadingMaterialsBad] = useState(false)
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnMaterialOptionsGood, setReturnMaterialOptionsGood] = useState<MaterialRow[]>([])
  const [returnMaterialOptionsBad, setReturnMaterialOptionsBad] = useState<MaterialRow[]>([])
  const [returnSupplierOptions, setReturnSupplierOptions] = useState<SupplierRecord[]>([])
  const [returnLoadingSuppliers, setReturnLoadingSuppliers] = useState(false)
  const [returnDraft, setReturnDraft] = useState<WarehouseReturnDraft>(() => ({
    buenaMaterialId: "",
    buenaEspecificaciones: "",
    buenaMotivo: "",
    bobinaCode: "",
    rechazadaEntries: [newWarehouseRejectedEntry()],
  }))

  function syncRejectedEntriesToTurn(entries: WarehouseRejectedEntry[]) {
    const totalKg = sumRejectedEntryKg(entries)
    const motivoOk = allRejectedEntriesHaveMotivo(entries)
    const firstMotivo =
      rejectedEntriesWithBobinas(entries).find((e) => e.motivo.trim())?.motivo.trim() ?? ""
    patchActiveTurn((t) => ({
      ...t,
      devolucionRechazadaKg: totalKg > 0 ? normalizeNumericString(totalKg) : "",
      devolucionRechazadaBobinas: "",
      devolucionRechazadaMotivo: totalKg > 0 && motivoOk ? firstMotivo : "",
    }))
  }

  function patchReturnDraft(patch: Partial<WarehouseReturnDraft>) {
    setReturnDraft((prev) => {
      const next = { ...prev, ...patch }
      if (patch.rechazadaEntries) {
        syncRejectedEntriesToTurn(next.rechazadaEntries)
      }
      return next
    })
  }

  function patchRejectedEntry(id: string, entryPatch: Partial<WarehouseRejectedEntry>) {
    setReturnDraft((prev) => {
      const nextEntries = prev.rechazadaEntries.map((e) =>
        e.id === id ? { ...e, ...entryPatch } : e,
      )
      syncRejectedEntriesToTurn(nextEntries)
      return { ...prev, rechazadaEntries: nextEntries }
    })
  }

  function addRejectedEntry() {
    const operador = readString(form.impOperador)
    setReturnDraft((prev) => ({
      ...prev,
      rechazadaEntries: [
        ...prev.rechazadaEntries,
        newWarehouseRejectedEntry({
          operador,
          creadaFecha: todayIsoDate(),
        }),
      ],
    }))
  }

  function removeRejectedEntry(id: string) {
    setReturnDraft((prev) => {
      if (prev.rechazadaEntries.length <= 1) return prev
      const nextEntries = prev.rechazadaEntries.filter((e) => e.id !== id)
      syncRejectedEntriesToTurn(nextEntries)
      return { ...prev, rechazadaEntries: nextEntries }
    })
  }
  const pauseReasons = [
    "Cambio de bobina",
    "Ajuste de máquina",
    "Falla mecánica",
    "Falla eléctrica",
    "Cambio de tinta",
    "Limpieza de rodillos",
    "Problema de calidad",
    "Falta de material",
    "Almuerzo/Descanso",
    "Otro",
  ]

  const timerState = readString(form.impTimerState) || "pending"
  const arranqueState = readString(form.impTimerArranqueState) || "idle"
  const demountState = readString(form.impTimerDemountState) || "idle"
  const arranqueRunning = arranqueState === "running"
  const demountRunning = demountState === "running"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const effectiveAcc = readNumber(form.impTimerEffectiveAccSec)
  const deadAcc = readNumber(form.impTimerDeadAccSec)
  const lastResumeAt = readNumber(form.impTimerLastResumeAtMs)
  const pauseAt = readNumber(form.impTimerPauseAtMs)
  const pauseEntries = useMemo<PrintingPauseEntry[]>(() => {
    const raw = form.impTimerPauses
    if (!Array.isArray(raw)) return []
    return raw
      .map((x) => x as Partial<PrintingPauseEntry>)
      .map((x) => ({
        at: readString(x.at),
        reason: readString(x.reason),
        obs: readString(x.obs),
        duration_sec: readNumber(x.duration_sec),
      }))
      .filter((x) => x.reason)
  }, [form.impTimerPauses])

  const nowMs = Date.now() + timerTick * 0
  const operativoEstado = useMemo(
    () => derivePrintingOperativoEstado(form, nowMs),
    [form, timerTick],
  )
  const otEffectiveAccSec = useMemo(
    () => cumulativeEffectiveSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const otDeadAccSec = useMemo(
    () => cumulativeDeadSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const otTotalAccSec = useMemo(
    () => cumulativeTotalPersistedSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const otDemountAccSec = useMemo(
    () => cumulativeDemountSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const displayEffectiveSec = otEffectiveAccSec
  const displayDeadSec = otDeadAccSec
  const displayTotalSec = otTotalAccSec
  const displayDemountSec = otDemountAccSec
  const kgHora =
    displayEffectiveSec > 0.01
      ? (producidoAcumuladoKg / (displayEffectiveSec / 3600)).toFixed(2)
      : "0.00"
  const displayHoraArranque = useMemo(() => {
    if (!activeTurno) return "—"
    const t = activeTurno.timer
    if (t.arranqueStartedAtMs > 0) {
      return formatHoraArranqueFromMs(t.arranqueStartedAtMs)
    }
    return formatHoraArranqueFromMs(horaArranqueMsFromTimer(t))
  }, [activeTurno])

  const sessionUser = useMemo(() => getStoredUser(), [])
  const isBossLike = canFinalizeOrder
  const activeOwnerId = activeTurno?.control_owner_user_id ?? null
  const activeOwnerName = activeTurno?.control_owner_name ?? null
  const canEditByControl = useMemo(() => {
    if (!hasActiveTurno) return true
    if (isBossLike) return true
    if (!activeOwnerId || !sessionUser?.id) return true
    return activeOwnerId === sessionUser.id
  }, [activeOwnerId, hasActiveTurno, isBossLike, sessionUser?.id])

  const controlReadOnly = readOnlyOps || !canEditByControl

  const [pauseMotivoModalOpen, setPauseMotivoModalOpen] = useState(false)
  const wasTimerPausedRef = useRef(false)

  useEffect(() => {
    if (wasTimerPausedRef.current && !timerPaused) {
      setPauseMotivoModalOpen(false)
    }
    wasTimerPausedRef.current = timerPaused
  }, [timerPaused])

  const canPreviewDesperdicioReport = useMemo(() => {
    return hasActiveTurno && !controlReadOnly && !areaFinalizada
  }, [areaFinalizada, controlReadOnly, hasActiveTurno])

  const canPreviewPlanillaReport = areaFinalizada

  const timerEverStarted = useMemo(
    () => hasProductionTimerStarted(mesTimerFieldsFromForm(form, "imp")),
    [form],
  )

  const canSaveProduction = useMemo(() => {
    if (controlReadOnly) return false
    return canSaveProductionAreaForm(form, MES_PRODUCTION_SAVE_CONFIG.impresion)
  }, [controlReadOnly, form])

  const canPersistShiftOpen = useMemo(() => {
    if (controlReadOnly) return false
    return hasActiveTurno
  }, [controlReadOnly, hasActiveTurno])

  const canPersistEntreTurnos = useMemo(() => {
    if (controlReadOnly || areaFinalizada) return false
    if (hasActiveTurno) return false
    return closedTurnos.length > 0
  }, [areaFinalizada, closedTurnos.length, controlReadOnly, hasActiveTurno])

  const canClickGuardar = canSaveProduction || canPersistShiftOpen || canPersistEntreTurnos

  const guardarHint = useMemo(
    () =>
      mesGuardarChoiceHint({
        areaLabel: MES_GUARDAR_AREA_LABELS.printing,
        controlReadOnly,
        hasActiveTurno,
        canSaveProduction,
        canPersistShiftOpen,
        canPersistBetweenShifts: canPersistEntreTurnos,
        closedTurnosCount: closedTurnos.length,
        blockedMessage: MES_SAVE_BLOCKED_MESSAGE,
      }),
    [
      canPersistEntreTurnos,
      canPersistShiftOpen,
      canSaveProduction,
      closedTurnos.length,
      controlReadOnly,
      hasActiveTurno,
    ],
  )

  const canPreviewTimerReport = useMemo(() => {
    if (!hasActiveTurno) return false
    if (controlReadOnly) return false
    if (areaFinalizada) return false
    return timerEverStarted
  }, [hasActiveTurno, controlReadOnly, areaFinalizada, timerEverStarted])

  const timerActionFlags = useMemo(
    () =>
      buildMesTimerActionFlags({
        base: !controlReadOnly && hasActiveTurno && !areaFinalizada,
        arranqueRunning,
        demountRunning,
        timerRunning,
        timerPaused,
        canFinalizeOrder,
        areaFinalizada,
        controlReadOnly,
        timerState,
        canPreview: canPreviewTimerReport,
      }),
    [
      areaFinalizada,
      arranqueRunning,
      canFinalizeOrder,
      canPreviewTimerReport,
      controlReadOnly,
      demountRunning,
      hasActiveTurno,
      timerPaused,
      timerRunning,
      timerState,
    ],
  )

  function requestTakeover() {
    if (readOnlyOps) return
    if (!hasActiveTurno) return
    if (isBossLike) {
      confirmTakeover()
      return
    }
    setTakeoverConfirmOpen(true)
  }

  function confirmTakeover() {
    if (readOnlyOps) return
    if (!hasActiveTurno) return
    const u = getStoredUser()
    if (!u) {
      toast.error("Sesión inválida. Vuelva a iniciar sesión.")
      return
    }
    const cur = activeTurno
    if (!cur) return
    const nextTurn: PrintingTurnoEntry = {
      ...cur,
      control_owner_user_id: u.id,
      control_owner_name: u.name,
      control_taken_at: new Date().toISOString(),
    }
    patchActiveTurn(() => nextTurn)
    setTakeoverConfirmOpen(false)
    mesPrintingShowSwal("control", "Control tomado", "Puede editar el turno.")
    void persistPrintingForm(
      {
        ...form,
        [IMP_ACTUAL_KEY]: nextTurn,
        ...printingTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: timerEverStarted,
      },
    )
  }

  function runOpenTimerReportPreview() {
    const previewNow = Date.now()
    const shiftEffectiveSec =
      effectiveAcc + (timerRunning && lastResumeAt > 0 ? (previewNow - lastResumeAt) / 1000 : 0)
    const shiftDeadSec = deadAcc + (timerPaused && pauseAt > 0 ? (previewNow - pauseAt) / 1000 : 0)
    const shiftTotalSec = shiftEffectiveSec + shiftDeadSec
    const previewKgHora =
      shiftEffectiveSec > 0.01 ? (totalSalida / (shiftEffectiveSec / 3600)).toFixed(2) : "0.00"
    const payload = {
      generated_at: new Date().toISOString(),
      work_order_id: workOrderId,
      work_order_code: readString(prefill.code) || `OT-${workOrderId}`,
      product: readString((prefill as Record<string, unknown>).productName) || null,
      client: readString((prefill as Record<string, unknown>).clientName) || null,
      turno: {
        turno: readString(form.impTurno),
        grupo: readString(form.impGrupo),
        operador: readString(form.impOperador),
        ayudante: readString(form.impAyudante),
        supervisor: readString(form.impSupervisor),
      },
      timer: {
        state: timerState,
        total_hms: formatTimerHms(shiftTotalSec),
        dead_hms: formatTimerHms(shiftDeadSec),
        effective_hms: formatTimerHms(shiftEffectiveSec),
        kg_hora: previewKgHora,
      },
      pauses: pauseEntries.map((p) => ({
        at: p.at,
        reason: p.reason,
        obs: p.obs,
        duration_hms: formatTimerHms(p.duration_sec),
      })),
    }
    try {
      localStorage.setItem(
        `axones.printing.timer-preview.${workOrderId}`,
        JSON.stringify(payload),
      )
    } catch {
      toast.error("No se pudo guardar la vista previa en el navegador.")
      return
    }
    const url = appAbsoluteUrl(
      `/ordenes-trabajo/${encodeURIComponent(String(workOrderId))}/impresion/temporizador/vista-previa`,
    )
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function requestOpenTimerReportPreview() {
    if (!canPreviewTimerReport) {
      toast.error("Inicie el cronómetro para habilitar la vista previa.")
      return
    }
    setPreviewTimerConfirmOpen(true)
  }

  function confirmOpenTimerReportPreview() {
    setPreviewTimerConfirmOpen(false)
    runOpenTimerReportPreview()
  }

  function openDesperdicioPreview() {
    if (!canPreviewDesperdicioReport) {
      toast.error("Active un turno editable para habilitar la vista previa de desperdicio.")
      return
    }
    const payload = {
      generated_at: new Date().toISOString(),
      work_order_id: workOrderId,
      work_order_code: readString(prefill.code) || `OT-${workOrderId}`,
      product: readString((prefill as Record<string, unknown>).productName) || null,
      client: readString((prefill as Record<string, unknown>).clientName) || null,
      turno: {
        turno: readString(form.impTurno),
        grupo: readString(form.impGrupo),
        operador: readString(form.impOperador),
        ayudante: readString(form.impAyudante),
        supervisor: readString(form.impSupervisor),
      },
      metrics: {
        total_entrada_kg: totalEntradaTurnoActual,
        salida_kg: totalSalida,
        scrap_kg: totalScrap,
        devolucion_buena_kg: devolucionBuena,
        devolucion_rechazada_bobinas: devolucionRechazadaBobinas,
      },
    }
    try {
      localStorage.setItem(
        `axones.printing.wastage-preview.${workOrderId}`,
        JSON.stringify(payload),
      )
    } catch {
      toast.error("No se pudo guardar la vista previa en el navegador.")
      return
    }
    const url = appAbsoluteUrl(
      `/ordenes-trabajo/${encodeURIComponent(String(workOrderId))}/impresion/desperdicio/vista-previa`,
    )
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function openPlanillaPreview() {
    if (!areaFinalizada) {
      toast.error("Finalice el área de impresión para ver la planilla.")
      return
    }
    const ok = openPrintingPlanillaPreviewFromSource({
      work_order_id: workOrderId,
      work_order_code: readString(prefill.code) || `OT-${workOrderId}`,
      client: readString((prefill as Record<string, unknown>).clientName) || null,
      product: readString((prefill as Record<string, unknown>).productName) || null,
      form: form as Record<string, unknown>,
      board_stage: "impresion",
    })
    if (!ok) {
      toast.error("No se pudo abrir la vista previa de planilla.")
    }
  }

  function requestCerrarTurnoActual() {
    if (controlReadOnly) return
    const cur = parsePrintingTurnoActual(form[IMP_ACTUAL_KEY])
    if (!cur) return
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador.")
      return
    }
    const rechCierre = countDevolucionRechazadaBobinas(
      cur.devolucionRechazadaBobinas,
      cur.devolucionRechazadaKg,
    )
    if (rechCierre > 0 && !readString(cur.devolucionRechazadaMotivo).trim()) {
      toast.error("Devolución rechazada: indique un motivo antes de cerrar el turno.")
      return
    }
    setCloseTurnConfirmOpen(true)
  }

  function confirmCloseTurnFirstStep() {
    setCloseTurnConfirmOpen(false)
    cerrarTurnoActual()
  }

  function requestFinalizarAreaImpresion() {
    if (!canFinalizeOrder) return
    setFinalizeOtConfirmOpen(true)
  }

  function confirmFinalizarAreaImpresion() {
    setFinalizeOtConfirmOpen(false)
    void finalizarAreaImpresion()
  }

  const outlierWarnings = useMemo(() => {
    const warnings: string[] = []
    const MAX_BOBINA_KG = 5000
    const MAX_DEVOLUCION_KG = 10000
    const MAX_TOTAL_ENTRADA = 50000

    if (totalEntradaTurnoActual > MAX_TOTAL_ENTRADA) {
      warnings.push(
        `Total entrada elevado (${totalEntradaTurnoActual.toFixed(2)} Kg). Verifique unidad y captura.`,
      )
    }
    if (devolucionBuena > MAX_DEVOLUCION_KG) {
      warnings.push(`Devolución buena alta (${devolucionBuena.toFixed(2)} Kg).`)
    }
    if (devolucionRechazadaBobinas > IMP_BOBINAS_SLOTS) {
      warnings.push(
        `Muchas bobinas rechazadas (${devolucionRechazadaBobinas}). Verifique el conteo (máx. ${IMP_BOBINAS_SLOTS}).`,
      )
    }
    entradaBobinas.forEach((v, idx) => {
      const n = parseBobinaKgSlotNumber(v)
      if (n > MAX_BOBINA_KG) warnings.push(`Entrada bobina ${idx + 1} fuera de rango (${n.toFixed(2)} Kg).`)
    })
    salidaBobinas.forEach((v, idx) => {
      const n = parseBobinaKgSlotNumber(v)
      if (n > MAX_BOBINA_KG) warnings.push(`Salida bobina ${idx + 1} fuera de rango (${n.toFixed(2)} Kg).`)
    })
    if (pedidoTotalKg > 0 && producidoAcumuladoKg > pedidoTotalKg + 0.01) {
      warnings.push(
        `Producido acumulado (${producidoAcumuladoKg.toFixed(2)} Kg) supera el pedido (${pedidoTotalKg.toFixed(2)} Kg). Verifique unidades o captura.`,
      )
    }
    return warnings
  }, [
    totalEntradaTurnoActual,
    devolucionBuena,
    devolucionRechazadaBobinas,
    entradaBobinas,
    salidaBobinas,
    pedidoTotalKg,
    producidoAcumuladoKg,
  ])

  const persistPrintingForm = useCallback(
    async (
      srcBase?: Record<string, unknown>,
      options?: {
        skipProductionSaveGuard?: boolean
        notifyProductionSave?: boolean
        successMessage?: string
        successTone?: AxonesSwalTone
        /** Evita aviso por defecto cuando el llamador muestra SweetAlert propio. */
        suppressSuccessToast?: boolean
      },
    ): Promise<boolean> => {
      const src = srcBase ?? formRef.current
      if (!Number.isFinite(workOrderId) || workOrderId < 1) return false
      const notifyProductionSave = options?.notifyProductionSave !== false

      if (
        notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !canSaveProductionAreaForm(src, MES_PRODUCTION_SAVE_CONFIG.impresion)
      ) {
        toast.error(MES_SAVE_BLOCKED_MESSAGE)
        return false
      }

      if (
        !notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !parsePrintingTurnoActual(src[IMP_ACTUAL_KEY])
      ) {
        toast.error("Abra un turno de planta antes de guardar.")
        return false
      }

      const act = parsePrintingTurnoActual(src[IMP_ACTUAL_KEY])
      if (act) {
        const operador = act.operador.trim()
        const turno = act.turno
        const grupo = act.grupo
        if (!operador || !turno || !grupo) {
          toast.error("Impresión: complete turno, grupo y operador antes de guardar.")
          return false
        }
      }

      const rechKgValidar = act
        ? countDevolucionRechazadaBobinas(act.devolucionRechazadaBobinas, act.devolucionRechazadaKg)
        : countDevolucionRechazadaBobinas(
            src.impDevolucionRechazadaBobinas,
            src.impDevolucionRechazadaKg,
          )
      const motivoRechValidar = act
        ? readString(act.devolucionRechazadaMotivo).trim()
        : readString(src.impDevolucionRechazadaMotivo).trim()
      if (rechKgValidar > 0 && !motivoRechValidar) {
        toast.error("Devolución rechazada: indique un motivo antes de guardar.")
        return false
      }

      if (outlierWarnings.length > 0) {
        mesPrintingToastWarning(`Se detectaron ${outlierWarnings.length} valores atípicos. Se guardará de todas formas.`)
      }

      const closedP = parsePrintingTurnos(src[IMP_TURNOS_KEY])
      let actualP = parsePrintingTurnoActual(src[IMP_ACTUAL_KEY])
      if (actualP) {
        actualP = syncPrintingTurnoFromFormMirror(src, actualP)
      }

      const shouldFlushCaptura =
        notifyProductionSave && !options?.skipProductionSaveGuard && actualP !== null
      if (shouldFlushCaptura && actualP) {
        actualP = flushPrintingTurnoOperativoToCapturas(actualP)
      }

      const accFromJson = accumulatePrintingFromJson(closedP, actualP)
      const closedTimerMirror =
        actualP === null && closedP.length > 0 ? printingAggregatedTimerMirrorFromTurnos(closedP) : null

      const ebAfter =
        actualP?.entradaBobinasKg ?? getNumericSeries(src, "impEntradaBobinasKg", IMP_BOBINAS_SLOTS)
      const sbAfter =
        actualP?.salidaBobinasKg ?? getNumericSeries(src, "impSalidaBobinasKg", IMP_BOBINAS_SLOTS)
      const emAfter =
        actualP?.entradaBobinasMeta ?? getMetaSeries(src, "impEntradaBobinasMeta", IMP_BOBINAS_SLOTS)
      const smAfter =
        actualP?.salidaBobinasMeta ?? getMetaSeries(src, "impSalidaBobinasMeta", IMP_BOBINAS_SLOTS)

      const normalizedForm: Record<string, unknown> = {
        ...src,
        [IMP_TURNOS_KEY]: closedP,
        [IMP_ACTUAL_KEY]: actualP,
        [IMP_ESTADO_KEY]: readEstadoArea(src[IMP_ESTADO_KEY]),
        impEntradaBobinasKg: ebAfter.map((v) => normalizeNumericString(v)),
        impSalidaBobinasKg: sbAfter.map((v) => normalizeNumericString(v)),
        impEntradaBobinasMeta: emAfter.map((m) => normalizeBobinaLabelMeta(m)),
        impSalidaBobinasMeta: smAfter.map((m) => normalizeBobinaLabelMeta(m)),
        impDevolucionBuenaKg: normalizeNumericString(
          actualP?.devolucionBuenaKg ?? src.impDevolucionBuenaKg,
        ),
        impDevolucionRechazadaKg: "",
        impDevolucionRechazadaBobinas: normalizeNumericString(
          actualP?.devolucionRechazadaBobinas ?? readNumberString(src.impDevolucionRechazadaBobinas),
        ),
        impScrapTransparenteKg: normalizeNumericString(
          actualP?.scrapTransparenteKg ?? src.impScrapTransparenteKg,
        ),
        impScrapImpresoKg: normalizeNumericString(actualP?.scrapImpresoKg ?? src.impScrapImpresoKg),
        impScrapImpresoDestino: (() => {
          const d = readString(src.impScrapImpresoDestino).toLowerCase()
          if (d === "bopp" || d === "polietileno" || d === "politerlero" || d === "poliestireno") {
            return d === "polietileno" || d === "politerlero" || d === "poliestireno"
              ? "polietileno"
              : "bopp"
          }
          return "bopp"
        })(),
        impScrapAcumuladoKg: normalizeNumericString(accFromJson.scrapKg),
        impTimerEffectiveAccSec: normalizeNumericString(
          closedTimerMirror?.impTimerEffectiveAccSec ?? src.impTimerEffectiveAccSec,
        ),
        impTimerDeadAccSec: normalizeNumericString(
          closedTimerMirror?.impTimerDeadAccSec ?? src.impTimerDeadAccSec,
        ),
        impTimerState: readString(closedTimerMirror?.impTimerState ?? src.impTimerState) || "pending",
        impTimerLastResumeAtMs: normalizeNumericString(
          closedTimerMirror?.impTimerLastResumeAtMs ?? src.impTimerLastResumeAtMs,
        ),
        impTimerPauseAtMs: normalizeNumericString(
          closedTimerMirror?.impTimerPauseAtMs ?? src.impTimerPauseAtMs,
        ),
        impRegistrosTurnos: String(accFromJson.turnosRegistrados),
        impAcumuladoProducidoKg: normalizeNumericString(accFromJson.producidoKg),
      }
      delete normalizedForm.impMermaKg
      delete normalizedForm.impMetrajeProduccion

      if (shouldFlushCaptura) {
        for (const k of Object.keys(normalizedForm)) {
          if (k.startsWith("impBlockDone.")) delete normalizedForm[k]
        }
      }

      const printingOnlyForm: Record<string, unknown> = Object.fromEntries(
        Object.entries(normalizedForm).filter(([k]) => k && k.startsWith("imp")),
      )

      setSaving(true)
      try {
        await apiFetch(`work-orders/${workOrderId}/orden-trabajo/printing-control`, {
          method: "PATCH",
          body: JSON.stringify({
            form: printingOnlyForm,
            origin_area: "impresion",
            notify_on_production_save: notifyProductionSave,
          }),
        })
        setForm(bootstrapPrintingFormState(normalizedForm))
        if (!options?.suppressSuccessToast) {
          if (options?.successMessage) {
            mesPrintingShowSwal(
              options.successTone ?? "guardado",
              options.successMessage,
            )
          } else if (shouldFlushCaptura) {
            mesPrintingShowSwal(
              "guardado",
              "Producción guardada",
              "Bobinas y desperdicio del turno quedaron en cero para un nuevo registro.",
            )
          } else {
            mesPrintingSwalWithBandeja(
              normalizedForm,
              "Guardado",
              undefined,
              canFinalizeOrderRef.current,
            )
          }
        }
        window.dispatchEvent(
          new CustomEvent(PRINTING_CONTROL_SAVED_EVENT, { detail: { workOrderId } }),
        )
        window.dispatchEvent(new Event("alerts:refresh"))
        return true
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo guardar control de impresión.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [form, outlierWarnings.length, workOrderId],
  )

  useEffect(() => {
    if (!timerRunning && !timerPaused && !arranqueRunning && !demountRunning) return
    const id = window.setInterval(() => setTimerTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [timerPaused, timerRunning, arranqueRunning, demountRunning])

  function patchAndPersistTimer(
    updater: (timer: PrintingTurnTimer) => PrintingTurnTimer,
    successMessage?: string,
  ) {
    const cur = activeTurno
    if (!cur) return
    const nextTurn: PrintingTurnoEntry = { ...cur, timer: updater(cur.timer) }
    patchActiveTurn(() => nextTurn)
    void persistPrintingForm(
      {
        ...form,
        [IMP_ACTUAL_KEY]: nextTurn,
        ...printingTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage,
        successTone: "timer",
      },
    )
  }

  function requestTimerConfirm(key: MesTimerConfirmKey) {
    if (controlReadOnly) return
    setTimerConfirm(key)
  }

  function executeTimerConfirm(key: MesTimerConfirmKey) {
    if (!mesTimerConfirmNeedsActiveTurno(key)) {
      requestFinalizarAreaImpresion()
      return
    }
    const cur = activeTurno
    if (!cur) return
    const phase = applyMesPhaseConfirmToTimer(key, cur.timer)
    if (phase) {
      patchAndPersistTimer(() => phase.timer, phase.message)
      return
    }
    switch (key) {
      case "startProduction":
        confirmStartProductionTimer()
        break
      case "startDeadTime":
        executePauseProductionTimer()
        break
      case "endDeadTime":
        confirmResumeProductionAfterDeadTime()
        break
      case "cerrarTurno":
        requestCerrarTurnoActual()
        break
      default:
        break
    }
  }

  function confirmStartProductionTimer() {
    if (!hasActiveTurno || controlReadOnly) return
    const now = Date.now()
    const cur = activeTurno
    if (!cur) return
    const nextTurn: PrintingTurnoEntry = {
      ...cur,
      timer: {
        ...cur.timer,
        state: "running",
        startedAtMs: cur.timer.startedAtMs || now,
        deadAccSec: deadAccSecAfterResume(cur.timer, now),
        lastResumeAtMs: now,
        pauseAtMs: 0,
      },
    }
    patchActiveTurn(() => nextTurn)
    void persistPrintingForm(
      {
        ...form,
        [IMP_ACTUAL_KEY]: nextTurn,
        ...printingTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        suppressSuccessToast: true,
      },
    )
  }

  function confirmResumeProductionAfterDeadTime() {
    if (!hasActiveTurno || controlReadOnly || !timerPaused) return
    const now = Date.now()
    const cur = activeTurno
    if (!cur) return
    const nextTurn: PrintingTurnoEntry = {
      ...cur,
      timer: {
        ...cur.timer,
        state: "running",
        deadAccSec: deadAccSecAfterResume(cur.timer, now),
        lastResumeAtMs: now,
        pauseAtMs: 0,
      },
    }
    patchActiveTurn(() => nextTurn)
    void persistPrintingForm(
      {
        ...form,
        [IMP_ACTUAL_KEY]: nextTurn,
        ...printingTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage: "Producción reanudada.",
        successTone: "timer",
      },
    )
  }

  /** Pausa atómica: un solo setForm + persist con el mismo snapshot (evita desincronía mirror / turno anidado). */
  function executePauseProductionTimer() {
    if (!timerRunning || controlReadOnly) return
    const now = Date.now()
    setForm((prev) => {
      const cur = parsePrintingTurnoActual(prev[IMP_ACTUAL_KEY])
      if (!cur || cur.timer.state !== "running") return prev
      const last = cur.timer.lastResumeAtMs
      const nextTurn: PrintingTurnoEntry = {
        ...cur,
        timer: {
          ...cur.timer,
          state: "paused",
          effectiveAccSec: cur.timer.effectiveAccSec + (last > 0 ? (now - last) / 1000 : 0),
          pauseAtMs: now,
          lastResumeAtMs: 0,
        },
      }
      const nextForm: Record<string, unknown> = {
        ...prev,
        [IMP_ACTUAL_KEY]: nextTurn,
        ...printingTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => {
        void persistPrintingForm(nextForm, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          suppressSuccessToast: true,
        })
      })
      return nextForm
    })
    setPauseMotivoModalOpen(true)
  }

  function confirmPauseAndResume() {
    const reason = pauseReason.trim()
    if (!reason) {
      toast.error("Seleccione el motivo de parada.")
      return
    }
    const obs = pauseObs.trim()
    setForm((prev) => {
      const cur = parsePrintingTurnoActual(prev[IMP_ACTUAL_KEY])
      if (!cur || cur.timer.state !== "paused") return prev
      const now = Date.now()
      const pauseStart = cur.timer.pauseAtMs
      const pauseDurationSec = pauseStart > 0 ? (now - pauseStart) / 1000 : 0
      const nextTurn: PrintingTurnoEntry = {
        ...cur,
        timer: {
          ...cur.timer,
          state: "paused",
          deadAccSec: cur.timer.deadAccSec + pauseDurationSec,
          pauseAtMs: now,
          lastResumeAtMs: 0,
          pauses: [
            ...cur.timer.pauses,
            {
              at: new Date(now).toISOString(),
              reason,
              obs,
              duration_sec: pauseDurationSec,
            },
          ],
        },
      }
      const nextForm: Record<string, unknown> = {
        ...prev,
        [IMP_ACTUAL_KEY]: nextTurn,
        ...printingTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => {
        void persistPrintingForm(nextForm, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          suppressSuccessToast: true,
        }).then((ok) => {
          if (ok) {
            mesPrintingSwalWithBandeja(
              nextForm,
              "Parada guardada",
              "El cronómetro sigue en pausa; use play para reanudar el tiempo efectivo.",
              false,
              "timer",
            )
          }
        })
      })
      return nextForm
    })
    setPauseReason("")
    setPauseObs("")
    setPauseMotivoModalOpen(false)
  }

  function requestIniciarTurno() {
    if (readOnlyOps) return
    if (hasActiveTurno) return
    if (!draftOperadorName) {
      toast.error("Indique el operador antes de iniciar el turno.")
      return
    }
    setStartTurnConfirmOpen(true)
  }

  function confirmIniciarTurno() {
    if (readOnlyOps) return
    if (hasActiveTurno) return
    if (!draftOperadorName) {
      setStartTurnConfirmOpen(false)
      toast.error("Indique el operador antes de iniciar el turno.")
      return
    }
    const u = getStoredUser()
    const t = createNewPrintingTurno({
      turno: draftTurno,
      grupo: draftGrupo,
      operador: draftOperadorName,
      controlOwner: u ? { id: u.id, name: u.name } : null,
    })
    const turnoWithPeople: PrintingTurnoEntry = {
      ...t,
      ayudante: draftAyudantesLabel,
      supervisor: draftSupervisorName,
    }
    const nextForm: Record<string, unknown> = {
      ...form,
      [IMP_ACTUAL_KEY]: turnoWithPeople,
      ...printingTurnoToMirror(turnoWithPeople),
      [IMP_TURNOS_KEY]: parsePrintingTurnos(form[IMP_TURNOS_KEY]),
    }
    setForm(nextForm)
    setDraftPeople([])
    setDraftStaging({ name: "", role: "operador" })
    setStartTurnConfirmOpen(false)
    void (async () => {
      const ok = await persistPrintingForm(nextForm, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        suppressSuccessToast: true,
      })
      if (ok) {
        mesPrintingSwalWithBandeja(nextForm, "Guardado", undefined, canFinalizeOrder)
      }
      await tryAdvanceBoardStageToImpresion()
    })()
  }

  async function tryAdvanceBoardStageToImpresion() {
    const stageOrder: Record<string, number> = {
      nueva: 0,
      pendiente: 1,
      montaje: 2,
      impresion: 3,
      laminacion: 4,
      corte: 5,
      completada: 6,
    }
    try {
      const wo = await apiFetch<{ board_stage?: string | null }>(`work-orders/${workOrderId}`)
      const bs = (wo.board_stage ?? "nueva").toLowerCase()
      if ((stageOrder[bs] ?? -1) >= stageOrder.impresion) return
      await apiFetch(`work-orders/${workOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: "impresion" }),
      })
    } catch {
      /* sin permiso o red */
    }
  }

  async function applyCerrarTurno(
    cur: PrintingTurnoEntry,
    finalizedTimer: PrintingTurnTimer,
    options?: { notifyProductionSave?: boolean; successMessage?: string },
  ): Promise<boolean> {
    const latestForm = formRef.current
    const syncedCur = syncPrintingTurnoFromFormMirror(latestForm, cur)
    const u = getStoredUser()
    const closedAt = new Date().toISOString()
    const curFlushed = flushPrintingTurnoOperativoToCapturas({ ...syncedCur, timer: finalizedTimer })
    const closed: PrintingTurnoEntry = {
      ...curFlushed,
      timer: finalizedTimer,
      closed_at: closedAt,
      closed_by: u ? { id: u.id, name: u.name } : null,
      resumenCierre: buildPrintingTurnoResumenCierre(curFlushed),
    }
    const turnos = [...parsePrintingTurnos(latestForm[IMP_TURNOS_KEY]), closed]
    const acc = accumulatePrintingFromJson(turnos, null)
    const nextForm: Record<string, unknown> = {
      ...latestForm,
      [IMP_TURNOS_KEY]: turnos,
      [IMP_ACTUAL_KEY]: null,
      ...clearPrintingMirrorKeys(),
      ...printingAggregatedTimerMirrorFromTurnos(turnos),
      impAcumuladoProducidoKg: normalizeNumericString(acc.producidoKg),
      impRegistrosTurnos: String(acc.turnosRegistrados),
      impScrapAcumuladoKg: normalizeNumericString(acc.scrapKg),
    }
    for (const k of Object.keys(nextForm)) {
      if (k.startsWith("impBlockDone.")) delete nextForm[k]
    }
    const ok = await persistPrintingForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: options?.notifyProductionSave === true,
      suppressSuccessToast: true,
    })
    if (ok) {
      mesPrintingShowSwal(
        "turno",
        "Turno cerrado",
        options?.successMessage ??
          "Turno guardado en el historial. Elija Turno, Grupo y Personal para iniciar el siguiente.",
      )
      navigateToMesBandeja(navigate, "printing", "produccion")
    } else {
      toast.error("No se pudo guardar el cierre del turno en el servidor. Se restauraron los datos del servidor.")
      await load()
    }
    return ok
  }

  async function cerrarTurnoYGuardarHistorial(options?: {
    notifyProductionSave?: boolean
  }): Promise<boolean> {
    if (controlReadOnly) return false
    const latestForm = formRef.current
    const curRaw = parsePrintingTurnoActual(latestForm[IMP_ACTUAL_KEY])
    if (!curRaw) {
      toast.error("No hay turno de planta abierto.")
      return false
    }
    const cur = syncPrintingTurnoFromFormMirror(latestForm, curRaw)
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador antes de guardar.")
      return false
    }
    const rechCierre = countDevolucionRechazadaBobinas(
      cur.devolucionRechazadaBobinas,
      cur.devolucionRechazadaKg,
    )
    if (rechCierre > 0 && !readString(cur.devolucionRechazadaMotivo).trim()) {
      toast.error("Devolución rechazada: indique un motivo antes de cerrar el turno.")
      return false
    }
    const finalizedTimer = finalizeTurnTimerNow(cur.timer)
    const totCierre = turnoProduccionTotals({ ...cur, timer: finalizedTimer })
    if (
      finalizedTimer.effectiveAccSec < 0.01 &&
      totCierre.salidaKg < 0.005 &&
      totCierre.entradaKg < 0.005
    ) {
      pendingEmptyShiftCloseRef.current = {
        cur,
        finalizedTimer,
        notifyProductionSave: options?.notifyProductionSave,
      }
      setEmptyShiftCloseDialogOpen(true)
      return false
    }
    return applyCerrarTurno(cur, finalizedTimer, {
      notifyProductionSave: options?.notifyProductionSave,
    })
  }

  function confirmEmptyShiftClose() {
    const p = pendingEmptyShiftCloseRef.current
    pendingEmptyShiftCloseRef.current = null
    setEmptyShiftCloseDialogOpen(false)
    if (!p) return
    void applyCerrarTurno(p.cur, p.finalizedTimer, {
      notifyProductionSave: p.notifyProductionSave,
    })
  }

  function cerrarTurnoActual() {
    void cerrarTurnoYGuardarHistorial({ notifyProductionSave: true })
  }

  async function finalizarAreaImpresion() {
    if (!canFinalizeOrder) return
    const prev = form
    let turnos = parsePrintingTurnos(prev[IMP_TURNOS_KEY])
    const cur = parsePrintingTurnoActual(prev[IMP_ACTUAL_KEY])
    const u = getStoredUser()
    if (cur) {
      const rechFin = countDevolucionRechazadaBobinas(
        cur.devolucionRechazadaBobinas,
        cur.devolucionRechazadaKg,
      )
      if (rechFin > 0 && !readString(cur.devolucionRechazadaMotivo).trim()) {
        toast.error("Devolución rechazada: indique un motivo antes de finalizar el área.")
        return
      }
      const finalizedTimer = finalizeTurnTimerNow(cur.timer)
      const syncedCur = syncPrintingTurnoFromFormMirror(prev, cur)
      const curFlushed = flushPrintingTurnoOperativoToCapturas({ ...syncedCur, timer: finalizedTimer })
      const closed: PrintingTurnoEntry = {
        ...curFlushed,
        timer: finalizedTimer,
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
        resumenCierre: buildPrintingTurnoResumenCierre(curFlushed),
      }
      turnos = [...turnos, closed]
    }
    const acc = accumulatePrintingFromJson(turnos, null)
    const nextForm: Record<string, unknown> = {
      ...prev,
      [IMP_TURNOS_KEY]: turnos,
      [IMP_ACTUAL_KEY]: null,
      [IMP_ESTADO_KEY]: "finalizada",
      ...clearPrintingMirrorKeys(),
      ...printingAggregatedTimerMirrorFromTurnos(turnos),
      impAcumuladoProducidoKg: normalizeNumericString(acc.producidoKg),
      impRegistrosTurnos: String(acc.turnosRegistrados),
      impScrapAcumuladoKg: normalizeNumericString(acc.scrapKg),
    }
    clearPrintingBrowserCache(workOrderId)
    setForm(bootstrapPrintingFormState(nextForm))
    const ok = await persistPrintingForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      mesPrintingShowSwal(
        "finalizado",
        "Área finalizada",
        "El área de impresión quedó cerrada en el sistema.",
      )
      navigateToMesBandeja(navigate, "printing", "finalizadas")
    }
  }

  function openLabelEditor(mode: "entrada" | "salida", idx: number) {
    const meta = mode === "entrada" ? entradaBobinasMeta[idx] : salidaBobinasMeta[idx]
    setLabelEditorMode(mode)
    setLabelEditorIndex(idx)
    setLabelEditorDraft(labelEditorDraftFromMeta(meta, mode))
    setLabelEditorError("")
    setLabelEditorOpen(true)
  }

  function updateLabelDraft(key: keyof BobinaLabelMeta, value: string) {
    setLabelEditorDraft((prev) => ({ ...prev, [key]: value }))
  }

  function clearLabelEditor() {
    if (labelEditorMode === "salida") {
      setLabelEditorDraft({ ...normalizeSalidaBobinaLabelMeta({}), fecha: todayBobinaLabelFecha() })
    } else {
      setLabelEditorDraft({ ...emptyBobinaLabelMeta(), fecha: todayBobinaLabelFecha() })
    }
    setLabelEditorError("")
  }

  function saveLabelEditor() {
    const normalized =
      labelEditorMode === "salida"
        ? normalizeSalidaBobinaLabelMeta(labelEditorDraft)
        : normalizeBobinaLabelMeta(labelEditorDraft)

    const size = IMP_BOBINAS_SLOTS
    patchActiveTurn((t) => {
      if (labelEditorMode === "entrada") {
        const next = [...t.entradaBobinasMeta]
        next[labelEditorIndex] = normalized
        while (next.length < size) next.push(emptyBobinaLabelMeta())
        return { ...t, entradaBobinasMeta: next.slice(0, size) }
      }
      const next = [...t.salidaBobinasMeta]
      next[labelEditorIndex] = normalized
      while (next.length < size) next.push(emptyBobinaLabelMeta())
      const nextSalidaKg = [...t.salidaBobinasKg]
      while (nextSalidaKg.length < size) nextSalidaKg.push("")
      const pesoLabel = readNumber(normalized.peso)
      if (pesoLabel > 0.005 && readNumber(nextSalidaKg[labelEditorIndex]) < 0.005) {
        nextSalidaKg[labelEditorIndex] = normalizeNumericString(pesoLabel)
      }
      return {
        ...t,
        salidaBobinasMeta: next.slice(0, size),
        salidaBobinasKg: nextSalidaKg.slice(0, size),
      }
    })
    setLabelEditorOpen(false)
    setLabelEditorError("")
  }

  const loadReturnMaterials = useCallback(async (inventoryArea: "material" | "bobinas_rechazadas") => {
    const setLoading = inventoryArea === "material" ? setReturnLoadingMaterialsGood : setReturnLoadingMaterialsBad
    const setOptions = inventoryArea === "material" ? setReturnMaterialOptionsGood : setReturnMaterialOptionsBad
    setLoading(true)
    try {
      const res = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { inventory_area: inventoryArea, per_page: 200, page: 1 },
      })
      setOptions(res.data ?? [])
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadReturnSuppliers = useCallback(async () => {
    setReturnLoadingSuppliers(true)
    try {
      const res = await apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
        query: { per_page: 200, page: 1 },
      })
      setReturnSupplierOptions(res.data ?? [])
    } catch {
      setReturnSupplierOptions([])
    } finally {
      setReturnLoadingSuppliers(false)
    }
  }, [])

  const devolucionesPendientePrevRef = useRef(false)
  useEffect(() => {
    if (devolucionesPendienteAlmacen && !devolucionesPendientePrevRef.current) {
      setReturnWarehouseOpen(true)
      void loadReturnMaterials("material")
      void loadReturnMaterials("bobinas_rechazadas")
      void loadReturnSuppliers()
      const turnKg = readNumberString(form.impDevolucionRechazadaKg)
      const turnMotivo = readString(form.impDevolucionRechazadaMotivo)
      const operador = readString(form.impOperador)
      if (turnKg.trim()) {
        setReturnDraft((prev) => {
          const entries =
            prev.rechazadaEntries.length > 0 ? prev.rechazadaEntries : [newWarehouseRejectedEntry()]
          if (entries.length === 1 && !entries[0].kg.trim()) {
            return {
              ...prev,
              rechazadaEntries: [
                {
                  ...entries[0],
                  kg: turnKg,
                  motivo: turnMotivo,
                  operador: entries[0].operador.trim() || operador,
                  creadaFecha: entries[0].creadaFecha.trim() || todayIsoDate(),
                },
              ],
            }
          }
          return prev
        })
      }
    }
    devolucionesPendientePrevRef.current = devolucionesPendienteAlmacen
  }, [devolucionesPendienteAlmacen, form.impDevolucionRechazadaKg, form.impDevolucionRechazadaMotivo, form.impOperador, loadReturnMaterials, loadReturnSuppliers])

  function handleReturnWarehouseOpenChange(open: boolean) {
    setReturnWarehouseOpen(open)
    if (open) {
      void loadReturnMaterials("material")
      void loadReturnMaterials("bobinas_rechazadas")
      void loadReturnSuppliers()
      setReturnDraft((prev) => {
        const turnKg = readNumberString(form.impDevolucionRechazadaKg)
        const turnMotivo = readString(form.impDevolucionRechazadaMotivo)
        const operador = readString(form.impOperador)
        const entries =
          prev.rechazadaEntries.length > 0 ? prev.rechazadaEntries : [newWarehouseRejectedEntry()]
        if (entries.length === 1 && !entries[0].kg.trim() && turnKg.trim()) {
          return {
            ...prev,
            buenaMaterialId: prev.buenaMaterialId,
            rechazadaEntries: [
              {
                ...entries[0],
                kg: turnKg,
                motivo: turnMotivo,
                operador: entries[0].operador.trim() || operador,
                creadaFecha: entries[0].creadaFecha.trim() || todayIsoDate(),
              },
            ],
          }
        }
        return prev
      })
    }
  }

  async function submitReturn() {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return

    const buenaKg = Number(readString(readNumberString(form.impDevolucionBuenaKg)).trim().replace(",", "."))
    const activeRejected = rejectedEntriesWithBobinas(returnDraft.rechazadaEntries)
    const rechKg = sumRejectedEntryKg(returnDraft.rechazadaEntries)
    const rechBobinas = sumRejectedEntryBobinas(returnDraft.rechazadaEntries)
    const hasBuena = Number.isFinite(buenaKg) && buenaKg > 0
    const hasRech = rechKg > 0
    if (!hasBuena && !hasRech) {
      toast.error("Indique kilos en devolución buena y/o en devolución mala (rechazada).")
      return
    }

    const buenaMaterialId = Number(returnDraft.buenaMaterialId)
    if (hasBuena && (!Number.isFinite(buenaMaterialId) || buenaMaterialId < 1)) {
      toast.error("Seleccione el material de la devolución buena.")
      return
    }
    if (hasBuena && !returnDraft.buenaMotivo.trim()) {
      toast.error("Indique el motivo de la devolución buena.")
      return
    }
    if (hasRech) {
      for (let i = 0; i < activeRejected.length; i++) {
        const entry = activeRejected[i]
        const lineN = i + 1
        const entryKg = countRejectedEntryKg(entry.kg)
        if (!entry.motivo.trim()) {
          toast.error(`Devolución mala ${lineN}: seleccione un motivo.`)
          return
        }
        if (entryKg < 0.001) {
          toast.error(`Devolución mala ${lineN}: indique los kilos rechazados.`)
          return
        }
      }
    }

    const bobinaRef = returnDraft.bobinaCode.trim()
    const firstMotivo = activeRejected[0]?.motivo.trim() ?? ""
    const supplierLabel = (id: string) =>
      returnSupplierOptions.find((s) => String(s.id) === id.trim())?.name?.trim() ?? ""

    setReturnSubmitting(true)
    try {
      const createdIds: number[] = []
      let createdBuenaId: number | null = null
      const createdRechIds: number[] = []

      const buenaMaterial = returnMaterialOptionsGood.find((m) => m.id === buenaMaterialId)
      const buenaSpecs =
        returnDraft.buenaEspecificaciones.trim() ||
        materialSpecificationsLabel(buenaMaterial)

      if (hasBuena) {
        const created = await apiFetch<InventoryReturnCreated>("inventory-returns", {
          method: "POST",
          body: JSON.stringify({
            material_id: buenaMaterialId,
            work_order_id: workOrderId,
            destination_area: "material",
            quantity: buenaKg.toFixed(3),
            reason: buildGoodReturnReason({
              motivo: returnDraft.buenaMotivo,
              especificaciones: buenaSpecs,
              bobinaRef,
            }),
          }),
        })
        createdBuenaId = created.id
        createdIds.push(created.id)
      }

      for (const entry of activeRejected) {
        const entryKg = countRejectedEntryKg(entry.kg)
        const rejectLabel = rejectReasonLabel(entry.motivo)
        const provName = supplierLabel(entry.proveedorId) || entry.proveedorId.trim()
        const materialLabel =
          returnMaterialOptionsBad.find((m) => String(m.id) === entry.materialId.trim())?.name?.trim() ||
          entry.materialId.trim()
        const materialIdRaw = entry.materialId.trim()
        const materialIdNum = materialIdRaw ? Number(materialIdRaw) : null
        const materialId =
          materialIdNum !== null && Number.isFinite(materialIdNum) && materialIdNum > 0 ? materialIdNum : null
        const created = await apiFetch<InventoryReturnCreated>("inventory-returns", {
          method: "POST",
          body: JSON.stringify({
            material_id: materialId,
            work_order_id: workOrderId,
            destination_area: "bobinas_rechazadas",
            quantity: entryKg.toFixed(3),
            reason: buildRejectedReturnReason(entry, {
              rejectReasonLabel: rejectLabel,
              proveedorName: provName,
              materialLabel,
              bobinaRef,
              operador: entry.operador.trim() || readString(form.impOperador),
            }),
          }),
        })
        createdRechIds.push(created.id)
        createdIds.push(created.id)
      }

      const titleBase = readString(prefill.code) || `OT-${workOrderId}`
      const rechSummaryLines = activeRejected.map((entry, i) => {
        const entryKg = countRejectedEntryKg(entry.kg)
        const rejectLabel = rejectReasonLabel(entry.motivo)
        const provName = supplierLabel(entry.proveedorId) || entry.proveedorId.trim()
        const materialLabel =
          returnMaterialOptionsBad.find((m) => String(m.id) === entry.materialId.trim())?.name?.trim() ||
          entry.materialId.trim()
        const returnId = createdRechIds[i] ?? "—"
        const provPart = provName ? ` · Proveedor: ${provName}` : ""
        const materialPart = materialLabel ? ` · Material: ${materialLabel}` : ""
        const opPart = entry.operador.trim() ? ` · Operador: ${entry.operador.trim()}` : ""
        return `Devolución mala ${activeRejected.length > 1 ? `#${i + 1} ` : ""}${entryKg.toFixed(3)} Kg · Motivo: ${rejectLabel}${provPart}${materialPart}${opPart} (return_id=${returnId})`
      })
      const bodyLines = [
        `Origen: Impresión`,
        `OT: ${titleBase}`,
        hasBuena
          ? `Devolución buena: ${buenaKg.toFixed(3)} Kg · ${buenaSpecs || "—"} · Motivo: ${returnDraft.buenaMotivo.trim()} (return_id=${createdBuenaId ?? "—"})`
          : null,
        ...rechSummaryLines,
        bobinaRef ? `Bobina/Ref: ${bobinaRef}` : null,
        createdIds.length ? `IDs devoluciones: ${createdIds.join(", ")}` : null,
      ].filter(Boolean)

      await apiFetch("area-requests", {
        method: "POST",
        body: JSON.stringify({
          area: "almacen",
          title: `Devolución desde Impresión · ${titleBase}`,
          body: bodyLines.join("\n"),
          work_order_id: workOrderId,
        }),
      })

      const patchDev = (prev: Record<string, unknown>): Record<string, unknown> => {
        const cur = parsePrintingTurnoActual(prev[IMP_ACTUAL_KEY])
        if (!cur) {
          const nextBuena = hasBuena
            ? normalizeNumericString(buenaKg)
            : normalizeNumericString(prev.impDevolucionBuenaKg)
          const nextRech = hasRech
            ? normalizeNumericString(rechKg)
            : normalizeNumericString(prev.impDevolucionRechazadaKg)
          return {
            ...prev,
            ...(hasBuena ? { impDevolucionBuenaKg: normalizeNumericString(buenaKg) } : null),
            ...(hasRech
              ? {
                  impDevolucionRechazadaKg: normalizeNumericString(rechKg),
                  impDevolucionRechazadaBobinas: "",
                  impDevolucionRechazadaMotivo: firstMotivo,
                }
              : null),
            impDevolucionesAlmacenUltimoEnvioMs: Date.now(),
            impDevolucionesAlmacenSnapBuena: nextBuena,
            impDevolucionesAlmacenSnapRech: nextRech,
          }
        }
        const nextTurn: PrintingTurnoEntry = {
          ...cur,
          devolucionBuenaKg: hasBuena
            ? normalizeNumericString(buenaKg)
            : cur.devolucionBuenaKg,
          devolucionRechazadaKg: hasRech
            ? normalizeNumericString(rechKg)
            : cur.devolucionRechazadaKg,
          devolucionRechazadaBobinas: hasRech ? "" : cur.devolucionRechazadaBobinas,
          devolucionRechazadaMotivo: hasRech
            ? firstMotivo
            : cur.devolucionRechazadaMotivo,
        }
        return {
          ...prev,
          [IMP_ACTUAL_KEY]: nextTurn,
          ...printingTurnoToMirror(nextTurn),
          impDevolucionesAlmacenUltimoEnvioMs: Date.now(),
          impDevolucionesAlmacenSnapBuena: normalizeNumericString(nextTurn.devolucionBuenaKg),
          impDevolucionesAlmacenSnapRech: normalizeNumericString(
            nextTurn.devolucionRechazadaKg || nextTurn.devolucionRechazadaBobinas,
          ),
        }
      }
      setForm((prev) => patchDev(prev))
      setReturnDraft({
        buenaMaterialId: "",
        buenaEspecificaciones: "",
        buenaMotivo: "",
        bobinaCode: "",
        rechazadaEntries: [newWarehouseRejectedEntry()],
      })
      setReturnWarehouseOpen(false)
      mesPrintingShowSwal(
        "warehouse",
        hasBuena ? "Devolución registrada" : "Solicitud enviada",
        hasBuena
          ? "Devolución buena registrada: el stock de sustrato se actualizó en Materiales."
          : "Solicitud enviada a almacén. Devoluciones registradas.",
      )
      window.dispatchEvent(new Event("alerts:refresh"))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la devolución / solicitud.")
    } finally {
      setReturnSubmitting(false)
    }
  }

  async function handleGuardarSesion() {
    await persistPrintingForm(undefined, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      successMessage: "Producción acumulada sincronizada con el servidor.",
      successTone: "sync",
    })
  }

  function requestGuardar() {
    if (saving || !canClickGuardar) {
      if (!canClickGuardar) {
        toast.error(
          !hasActiveTurno && closedTurnos.length === 0
            ? "Inicie un turno de planta antes de guardar."
            : MES_SAVE_BLOCKED_MESSAGE,
        )
      }
      return
    }
    if (hasActiveTurno) {
      const cur = parsePrintingTurnoActual(form[IMP_ACTUAL_KEY])
      if (cur && (!cur.operador.trim() || !cur.turno || !cur.grupo)) {
        toast.error("Complete turno, grupo y operador antes de guardar.")
        return
      }
      setGuardarChoiceOpen(true)
      return
    }
    if (canPersistEntreTurnos) {
      setGuardarChoiceOpen(true)
      return
    }
    if (canFinalizeOrder) {
      setGuardarChoiceOpen(true)
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de impresión…</p>

  return (
    <div className="ax-mes space-y-4">
      <MesOperativoEstadoCard
        areaLabel="Impresión"
        estado={operativoEstado}
        producidoKg={producidoAcumuladoKg}
      />
      {hasActiveTurno && !readOnlyOps && !canEditByControl ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">Turno en control de otro usuario</div>
              <div className="text-amber-950/80">
                Control actual: <span className="font-semibold">{activeOwnerName ?? "—"}</span>
                <span className="mt-1 block font-mono tabular-nums">
                  Tiempo efectivo acumulado (OT): {formatHmsFromSeconds(otEffectiveAccSec)}
                </span>
              </div>
            </div>
            <Button type="button" variant="outline" className="border-amber-300" onClick={requestTakeover}>
              Tomar control
            </Button>
          </div>
        </div>
      ) : null}
      {outlierWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="mb-1 font-semibold">Advertencias de captura (no bloqueantes)</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {outlierWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <WorkOrderPrintingOpsSection
        pedidoTotalKg={pedidoTotalKg}
        producidoAcumuladoKg={producidoAcumuladoKg}
        faltanteKg={faltanteKg}
        turnosRegistrados={turnosRegistrados}
        totalEntradaAcumulada={totalEntradaAcumulada}
        totalEntradaTurno={totalEntradaTurnoActual}
        totalScrapAcumulado={totalScrapAcumulado}
        ultimoTurnoLabel={ultimoTurnoLabel}
        timerState={timerState}
        totalSec={displayTotalSec}
        deadSec={displayDeadSec}
        effectiveSec={displayEffectiveSec}
        timerShowsOtAccumulated={closedTurnos.length > 0 || hasActiveTurno}
        kgHora={kgHora}
        horaArranque={displayHoraArranque}
        demountSec={displayDemountSec}
        arranqueRunning={arranqueRunning}
        demountRunning={demountRunning}
        timerRunning={timerRunning}
        timerPaused={timerPaused}
        timerActionFlags={timerActionFlags}
        onRequestTimerConfirm={requestTimerConfirm}
        pauseReasons={pauseReasons}
        pauseReason={pauseReason}
        pauseObs={pauseObs}
        pauseMotivoDialogOpen={pauseMotivoModalOpen}
        onPauseMotivoDialogOpenChange={setPauseMotivoModalOpen}
        pauseEntries={pauseEntries}
        impTurno={readString(form.impTurno)}
        impGrupo={readString(form.impGrupo)}
        impOperador={readString(form.impOperador)}
        impAyudante={readString(form.impAyudante)}
        impSupervisor={readString(form.impSupervisor)}
        entradaBobinas={entradaBobinas}
        entradaMeta={entradaBobinasMeta}
        devolucionBuenaRaw={readNumberString(form.impDevolucionBuenaKg)}
        devolucionRechazadaRaw={readNumberString(form.impDevolucionRechazadaBobinas)}
        devolucionRechazadaMotivoRaw={readString(form.impDevolucionRechazadaMotivo)}
        salidaBobinas={salidaBobinas}
        salidaMeta={salidaBobinasMeta}
        scrapTransparenteRaw={readNumberString(form.impScrapTransparenteKg)}
        scrapImpresoRaw={readNumberString(form.impScrapImpresoKg)}
        scrapImpresoDestinoRaw={readString(form.impScrapImpresoDestino) || "bopp"}
        onSetScrapImpresoDestino={(v) =>
          setForm((prev) => ({ ...prev, impScrapImpresoDestino: v }))
        }
        devolucionBuena={devolucionBuena}
        devolucionRechazadaKg={devolucionRechazadaKg}
        devolucionRechazada={devolucionRechazadaBobinas}
        totalSalida={totalSalida}
        formatTimerHms={formatTimerHms}
        setPauseReason={setPauseReason}
        setPauseObs={setPauseObs}
        confirmPauseAndResume={confirmPauseAndResume}
        hasActiveTurno={hasActiveTurno}
        areaFinalizada={areaFinalizada}
        readOnlyOps={controlReadOnly}
        canFinalizeOrder={canFinalizeOrder}
        draftTurno={draftTurno}
        draftGrupo={draftGrupo}
        draftPeople={draftPeople}
        draftOperadorMissing={draftOperadorMissing}
        draftStagingName={draftStaging.name}
        draftStagingRole={draftStaging.role}
        onDraftTurno={setDraftTurno}
        onDraftGrupo={setDraftGrupo}
        onDraftStagingName={onDraftStagingName}
        onDraftStagingRole={onDraftStagingRole}
        onDraftPersonGuardar={guardarDraftPerson}
        onDraftPersonRemove={removeDraftPerson}
        onIniciarTurno={requestIniciarTurno}
        onCerrarTurnoActual={requestCerrarTurnoActual}
        onFinalizarAreaImpresion={requestFinalizarAreaImpresion}
        closedTurnos={closedTurnos}
        lastClosedTurno={lastClosedTurno}
        onSetTurno={(v) => patchActiveTurn((t) => ({ ...t, turno: v }))}
        onSetGrupo={(v) => patchActiveTurn((t) => ({ ...t, grupo: v }))}
        onActivePersonnelApply={(people) => {
          const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
          patchActiveTurn((t) => ({ ...t, operador, ayudante, supervisor }))
        }}
        onEntradaChange={(idx, v) =>
          patchActiveTurn((t) => {
            const next = [...t.entradaBobinasKg]
            next[idx] = sanitizeBobinaKgSlotInput(v)
            return { ...t, entradaBobinasKg: next }
          })
        }
        onOpenEntradaLabel={(idx) => openLabelEditor("entrada", idx)}
        onSetDevolucionBuena={(v) =>
          patchActiveTurn((t) => ({ ...t, devolucionBuenaKg: v }))
        }
        onSetDevolucionRechazada={(v) =>
          patchActiveTurn((t) => {
            const raw = String(v ?? "").trim().replace(",", ".")
            const n = raw === "" ? 0 : Number(raw)
            const rechZero = !Number.isFinite(n) || n <= 0
            const bobinas = rechZero ? "" : String(Math.max(0, Math.floor(n)))
            return {
              ...t,
              devolucionRechazadaKg: "",
              devolucionRechazadaBobinas: bobinas,
              devolucionRechazadaMotivo: rechZero ? "" : t.devolucionRechazadaMotivo,
            }
          })
        }
        onSetDevolucionRechazadaMotivo={(v) =>
          patchActiveTurn((t) => ({ ...t, devolucionRechazadaMotivo: v }))
        }
        warehouseReturn={{
          open: returnWarehouseOpen,
          onOpenChange: (open) => {
            if (!open && returnSubmitting) return
            handleReturnWarehouseOpenChange(open)
          },
          workOrderCode: readString(prefill.code) || `OT-${workOrderId}`,
          draft: returnDraft,
          onDraftChange: patchReturnDraft,
          onRejectedEntryChange: patchRejectedEntry,
          onAddRejectedEntry: addRejectedEntry,
          onRemoveRejectedEntry: removeRejectedEntry,
          materialOptionsGood: returnMaterialOptionsGood,
          materialOptionsBad: returnMaterialOptionsBad,
          supplierOptions: returnSupplierOptions,
          loadingGood: returnLoadingMaterialsGood,
          loadingBad: returnLoadingMaterialsBad,
          loadingSuppliers: returnLoadingSuppliers,
          submitting: returnSubmitting,
          onSubmit: submitReturn,
        }}
        onSalidaChange={(idx, v) =>
          patchActiveTurn((t) => {
            const next = [...t.salidaBobinasKg]
            next[idx] = sanitizeBobinaKgSlotInput(v)
            return { ...t, salidaBobinasKg: next }
          })
        }
        onOpenSalidaLabel={(idx) => openLabelEditor("salida", idx)}
        onSetScrapTransparente={(v) =>
          patchActiveTurn((t) => ({ ...t, scrapTransparenteKg: v }))
        }
        onSetScrapImpreso={(v) => patchActiveTurn((t) => ({ ...t, scrapImpresoKg: v }))}
        labelEditorOpen={labelEditorOpen}
        labelEditorMode={labelEditorMode}
        labelEditorIndex={labelEditorIndex}
        labelEditorDraft={labelEditorDraft}
        labelEditorError={labelEditorError}
        onLabelOpenChange={(open) => {
          setLabelEditorOpen(open)
          if (!open) setLabelEditorError("")
        }}
        onLabelDraftChange={updateLabelDraft}
        onLabelClear={clearLabelEditor}
        onLabelSave={saveLabelEditor}
        canPreviewTimerReport={canPreviewTimerReport}
        onPreviewTimerReport={requestOpenTimerReportPreview}
        canPreviewDesperdicioReport={canPreviewDesperdicioReport}
        onPreviewDesperdicioReport={openDesperdicioPreview}
        canPreviewPlanillaReport={canPreviewPlanillaReport}
        onPreviewPlanillaReport={openPlanillaPreview}
        simplifiedTimerActions
        devolucionesPendienteAlmacen={devolucionesPendienteAlmacen}
      />

      {(() => {
        const doneObs = !!readString(form.impObservaciones).trim()
        return (
          <MesSectionShell
            title={
              <span className="inline-flex items-center gap-2">
                <NotebookPen className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Observaciones del turno
              </span>
            }
            subtle
            headerRight={
              doneObs ? (
                <div className="mes-badge-done">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Completo
                </div>
              ) : null
            }
          >
            <Textarea
              id={impObsTextareaId}
              name="impObservaciones"
              aria-label="Observaciones del turno"
              value={readString(form.impObservaciones)}
              onChange={(e) => {
                if (!hasActiveTurno || controlReadOnly) return
                patchActiveTurn((t) => ({ ...t, observaciones: e.target.value }))
              }}
              placeholder={
                hasActiveTurno
                  ? "Observaciones adicionales..."
                  : "Inicie un turno para registrar observaciones."
              }
              disabled={controlReadOnly || !hasActiveTurno}
            />
          </MesSectionShell>
        )
      })()}

      <div className="no-print mb-12 flex flex-col items-center gap-2">
        {guardarHint ? (
          <p className="max-w-md text-center text-xs text-muted-foreground">{guardarHint}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={requestGuardar} disabled={saving || !canClickGuardar}>
            <Save className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <MesGuardarChoiceDialog
        open={guardarChoiceOpen}
        onOpenChange={setGuardarChoiceOpen}
        areaLabel={MES_GUARDAR_AREA_LABELS.printing}
        canFinalizeArea={canFinalizeOrder}
        hasActiveTurno={hasActiveTurno}
        betweenShiftsMode={canPersistEntreTurnos && !hasActiveTurno}
        onGuardarSesion={() => void handleGuardarSesion()}
        onFinalizarTurno={requestCerrarTurnoActual}
        onFinalizarArea={requestFinalizarAreaImpresion}
      />

      {timerConfirm ? (
        <MesPrintingConfirmDialog
          tone={getMesTimerConfirm("impresion")[timerConfirm].tone}
          open
          onOpenChange={(open) => {
            if (!open) setTimerConfirm(null)
          }}
          icon={<CirclePlay className="h-5 w-5" aria-hidden />}
          title={getMesTimerConfirm("impresion")[timerConfirm].title}
          description={getMesTimerConfirm("impresion")[timerConfirm].description}
          confirmLabel={getMesTimerConfirm("impresion")[timerConfirm].confirmLabel}
          confirmVariant={
            getMesTimerConfirm("impresion")[timerConfirm].destructive ? "destructive" : "default"
          }
          onConfirm={() => {
            const key = timerConfirm
            setTimerConfirm(null)
            executeTimerConfirm(key)
          }}
        />
      ) : null}

      <MesPrintingConfirmDialog
        tone="violet"
        open={previewTimerConfirmOpen}
        onOpenChange={setPreviewTimerConfirmOpen}
        icon={<FileSearch className="h-5 w-5" aria-hidden />}
        title="Vista previa del cronómetro"
        description="Se abrirá una pestaña nueva con el reporte de tiempos y pausas registrados hasta este momento."
        confirmLabel="Abrir vista previa"
        onConfirm={() => confirmOpenTimerReportPreview()}
      />

      <MesPrintingConfirmDialog
        tone="violet"
        open={takeoverConfirmOpen}
        onOpenChange={setTakeoverConfirmOpen}
        icon={<Users className="h-5 w-5" aria-hidden />}
        title="Tomar control del turno"
        description={
          <>
            Este turno está siendo gestionado por{" "}
            <span className="font-semibold text-foreground">{activeOwnerName ?? "otro usuario"}</span>. ¿Desea tomar
            el control para editar?
          </>
        }
        confirmLabel="Tomar control"
        onConfirm={() => confirmTakeover()}
      />

      <MesPrintingConfirmDialog
        tone="rose"
        open={closeTurnConfirmOpen}
        onOpenChange={setCloseTurnConfirmOpen}
        icon={<LogOut className="h-5 w-5" aria-hidden />}
        title="Cerrar turno"
        description="Se cerrará el registro de turno de planta en curso y se consolidará el cronómetro en el historial. Podrá abrir otro turno de planta después. ¿Confirma el cierre?"
        confirmLabel="Sí, cerrar turno"
        onConfirm={() => confirmCloseTurnFirstStep()}
      />

      <MesPrintingConfirmDialog
        tone="red"
        open={finalizeOtConfirmOpen}
        onOpenChange={setFinalizeOtConfirmOpen}
        icon={<Flag className="h-5 w-5" aria-hidden />}
        title="Finalizar área de impresión (OT)"
        description="Marcará el área de impresión como finalizada en la orden. Revise que los datos del turno estén completos antes de continuar."
        confirmLabel="Sí, finalizar área"
        confirmVariant="destructive"
        onConfirm={() => confirmFinalizarAreaImpresion()}
      />

      <MesPrintingConfirmDialog
        tone="orange"
        open={emptyShiftCloseDialogOpen}
        onOpenChange={(open) => {
          setEmptyShiftCloseDialogOpen(open)
          if (!open) pendingEmptyShiftCloseRef.current = null
        }}
        icon={<AlertCircle className="h-5 w-5" aria-hidden />}
        title="Cerrar turno sin actividad"
        description="El turno no registra tiempo efectivo ni producción. ¿Desea cerrarlo igual?"
        confirmLabel="Sí, cerrar igual"
        onConfirm={() => confirmEmptyShiftClose()}
      />

      <MesPrintingConfirmDialog
        tone="indigo"
        open={startTurnConfirmOpen}
        onOpenChange={setStartTurnConfirmOpen}
        icon={<Sparkles className="h-5 w-5" aria-hidden />}
        title="Abrir turno de planta (registro)"
        description="Confirme para abrir el registro de turno de planta (Diurno/Nocturno y grupo), habilitar el cronómetro, bobinas y resumen operativo del turno en curso."
        confirmLabel="Confirmar e iniciar"
        onConfirm={() => confirmIniciarTurno()}
      />

    </div>
  )
}
