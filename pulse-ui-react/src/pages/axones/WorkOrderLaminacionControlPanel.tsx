"use client"

import { createElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Layers, Package } from "lucide-react"
import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { WindingFigurePicker } from "./WindingFigurePicker"
import { MesSectionShell } from "@/components/axones/mes"
import { apiFetch, ApiError } from "@/lib/api"
import { LAMINACION_CONTROL_SAVED_EVENT } from "@/lib/laminacion-mes-band-status"
import { cumulativeEffectiveSeconds, formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"
import {
  canSaveProductionAreaForm,
  hasProductionTimerStarted,
  mesTimerFieldsFromForm,
  MES_PRODUCTION_SAVE_CONFIG,
  MES_SAVE_BLOCKED_MESSAGE,
} from "@/lib/mes-timer-guards"
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
import WorkOrderLaminacionOpsSection, {
  type DraftPerson,
  type DraftPersonRole,
  stringsFromActivePersonnel,
} from "./WorkOrderLaminacionOpsSection"
import {
  LAM_ACTUAL_KEY,
  LAM_ESTADO_KEY,
  LAM_PAUSE_REASONS,
  LAM_TURNOS_KEY,
  accumulateLaminacionFromJson,
  bootstrapLaminacionFormState,
  clearLaminacionMirrorKeys,
  createNewLaminacionTurno,
  finalizeLaminacionTurnTimerNow,
  laminacionAggregatedTimerMirrorFromTurnos,
  formatTimerHms,
  laminacionTurnoToMirror,
  parseLaminacionTurnoActual,
  parseLaminacionTurnos,
  readLaminacionEstadoArea,
  sumSalidaKgTurno,
  sumScrapKgTurno,
  LAM_BOBINAS_SLOTS,
  getMetaSeries,
  getNumericSeries,
  getSustratosLamRows,
  normalizeLaminacionFormForSave,
  normalizeBobinaLabelMeta,
  validateBobinaLabelSave,
  metaKeyForLabelMode,
  emptyBobinaLabelMeta,
  readLamNumber,
  sumSeriesKg,
  computeLamMermaRefil,
  type BobinaLabelMeta,
  type LamLabelEditorMode,
  type LaminacionTurnoEntry,
  type LaminacionTurnTimer,
} from "./laminacion-turnos"
import "./work-order-planilla.css"
import { AlertCircle, CheckCircle2, CirclePause, CirclePlay, FileSearch, Flag, LogOut, NotebookPen, RotateCcw, Save, Sparkles, Users } from "lucide-react"

import { getStoredUser } from "@/lib/auth-storage"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  product_id?: number | null
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

type LaminacionPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

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

const LOCAL_LAMINACION_DRAFT_PREFIX = "axones.laminacion.control.draft."

/** Tonos visuales para confirmaciones del panel de laminación (alineados a cada acción). */
type MesLaminacionConfirmTone =
  | "emerald"
  | "sky"
  | "indigo"
  | "violet"
  | "amber"
  | "orange"
  | "rose"
  | "red"

const MES_MONTAJE_CONFIRM: Record<MesLaminacionConfirmTone, { panel: string; iconBox: string }> = {
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

type MesLaminacionConfirmDialogProps = {
  tone: MesLaminacionConfirmTone
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  confirmVariant?: "default" | "destructive"
}

function MesLaminacionConfirmDialog(props: MesLaminacionConfirmDialogProps) {
  const skin = MES_MONTAJE_CONFIRM[props.tone]
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

const MES_MONTAJE_SUCCESS_TOAST_CLASSNAMES = {
  toast:
    "border-violet-200/70 bg-gradient-to-b from-violet-50/50 to-background text-foreground shadow-lg dark:from-violet-950/25 dark:to-background",
  title: "text-foreground text-sm font-medium",
  success: "!bg-transparent !border-transparent",
  description: "text-muted-foreground text-sm",
  icon: "text-violet-600",
} as const

function mesLaminacionToastSuccess(message: string) {
  toast.success(message, {
    richColors: false,
    classNames: MES_MONTAJE_SUCCESS_TOAST_CLASSNAMES,
    icon: createElement(Sparkles, { className: "h-4 w-4 shrink-0 text-violet-600", "aria-hidden": true }),
  })
}

function mesLaminacionToastWarning(message: string) {
  toast.warning(message, {
    richColors: false,
    classNames: {
      ...MES_MONTAJE_SUCCESS_TOAST_CLASSNAMES,
      warning: "!bg-transparent !border-transparent",
      icon: "text-amber-600",
    },
    icon: createElement(AlertCircle, { className: "h-4 w-4 shrink-0 text-amber-600", "aria-hidden": true }),
  })
}

type LocalLaminacionDraft = {
  work_order_id: number
  saved_at_ms: number
  // Guardamos lo mínimo para rehidratar el temporizador + turno actual.
  active_turno: unknown
  mirror: Record<string, unknown>
}

function clearLocalLaminacionDrafts(workOrderId: number) {
  try {
    localStorage.removeItem(`${LOCAL_LAMINACION_DRAFT_PREFIX}${workOrderId}`)
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(`axones.laminacion.timer-preview.${workOrderId}`)
  } catch {
    // ignore
  }
}

function mergePrefill(prefill: Record<string, unknown>, form?: Record<string, unknown> | null) {
  return { ...prefill, ...(form ?? {}) }
}

export default function WorkOrderLaminacionControlPanel({
  workOrderId,
  canFinalizeOrder = false,
}: {
  workOrderId: number
  /** Solo jefe/admin puede finalizar el área de laminacion (lamEstadoArea). */
  canFinalizeOrder?: boolean
}) {
  const lamObsTextareaId = useId().replace(/:/g, "")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [labelEditorOpen, setLabelEditorOpen] = useState(false)
  const [labelEditorMode, setLabelEditorMode] = useState<LamLabelEditorMode>("virgen")
  const [labelEditorIndex, setLabelEditorIndex] = useState(0)
  const [labelEditorDraft, setLabelEditorDraft] = useState<BobinaLabelMeta>(emptyBobinaLabelMeta())
  const [labelEditorError, setLabelEditorError] = useState("")

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
      mesLaminacionToastWarning("Solo puede haber un Supervisor en el turno.")
      return
    }
    if (role === "operador" && prev.some((p) => p.role === "operador")) {
      mesLaminacionToastWarning("Solo puede haber un Operador principal en el turno.")
      return
    }
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setDraftPeople((p) => [...p, { id, role, name: trimmed }])
    setDraftStaging((s) => ({ ...s, name: "" }))
  }, [])

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
      const boot = bootstrapLaminacionFormState(mergedForm)
      if (readLaminacionEstadoArea(boot[LAM_ESTADO_KEY]) === "finalizada") {
        setForm(boot)
        return
      }
      // Rehidratar desde respaldo local si hay un temporizador más reciente.
      try {
        const raw = localStorage.getItem(`${LOCAL_LAMINACION_DRAFT_PREFIX}${workOrderId}`)
        if (raw) {
          const draft = JSON.parse(raw) as Partial<LocalLaminacionDraft>
          const serverLastResume = readNumber(boot.lamTimerLastResumeAtMs)
          const serverPauseAt = readNumber(boot.lamTimerPauseAtMs)
          const serverTimerAny = Math.max(serverLastResume, serverPauseAt)

          const draftMirror =
            draft.mirror && typeof draft.mirror === "object"
              ? (draft.mirror as Record<string, unknown>)
              : null
          const draftLastResume = readNumber(draftMirror?.lamTimerLastResumeAtMs)
          const draftPauseAt = readNumber(draftMirror?.lamTimerPauseAtMs)
          const draftTimerAny = Math.max(draftLastResume, draftPauseAt)

          if (draftTimerAny > serverTimerAny && draft.active_turno) {
            setForm(
              bootstrapLaminacionFormState({
                ...boot,
                [LAM_ACTUAL_KEY]: draft.active_turno,
                ...(draftMirror ?? {}),
              }),
            )
          } else {
            setForm(boot)
          }
        } else {
          setForm(boot)
        }
      } catch {
        setForm(boot)
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT para laminacion.")
      setPrefill({})
      setForm({})
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { inventory_area: "material", per_page: 200, page: 1 },
        })
        if (!cancelled) setMaterials(data.data ?? [])
      } catch {
        if (!cancelled) setMaterials([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const entradaImpresaBobinas = useMemo(
    () => getNumericSeries(form, "lamEntradaImpresaBobinasKg", LAM_BOBINAS_SLOTS),
    [form],
  )
  const entradaVirgenBobinas = useMemo(
    () => getNumericSeries(form, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS),
    [form],
  )
  const salidaBobinas = useMemo(() => getNumericSeries(form, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS), [form])
  const entradaImpresaBobinasMeta = useMemo(
    () => getMetaSeries(form, "lamEntradaImpresaBobinasMeta", LAM_BOBINAS_SLOTS),
    [form],
  )
  const entradaVirgenBobinasMeta = useMemo(
    () => getMetaSeries(form, "lamEntradaVirgenBobinasMeta", LAM_BOBINAS_SLOTS),
    [form],
  )
  const salidaBobinasMeta = useMemo(() => getMetaSeries(form, "lamSalidaBobinasMeta", LAM_BOBINAS_SLOTS), [form])
  const totalEntradaImpresa = useMemo(() => sumSeriesKg(entradaImpresaBobinas), [entradaImpresaBobinas])
  const totalEntradaVirgen = useMemo(() => sumSeriesKg(entradaVirgenBobinas), [entradaVirgenBobinas])
  const sustratosLam = useMemo(() => getSustratosLamRows(form), [form])
  const materialById = useMemo(() => {
    const map = new Map<string, MaterialRow>()
    for (const m of materials) map.set(String(m.id), m)
    return map
  }, [materials])
  const totalSalida = useMemo(() => sumSeriesKg(salidaBobinas), [salidaBobinas])
  const scrapTransparente = readLamNumber(form.lamScrapTransparenteKg)
  const scrapImpreso = readLamNumber(form.lamScrapImpresoKg)
  const scrapLaminado = readLamNumber(form.lamScrapLaminadoKg)
  const totalScrap = scrapTransparente + scrapImpreso + scrapLaminado
  const adhesivoConsumido = Math.max(0, readLamNumber(form.lamAdhesivoEntradaKg) - readLamNumber(form.lamAdhesivoSobroKg))
  const { mermaCalc, refilPct } = useMemo(
    () =>
      computeLamMermaRefil({
        totalEntradaImpresa,
        totalEntradaVirgen,
        adhesivoConsumido,
        totalSalida,
        totalScrap,
      }),
    [totalEntradaImpresa, totalEntradaVirgen, adhesivoConsumido, totalSalida, totalScrap],
  )

  const closedTurnos = useMemo(() => parseLaminacionTurnos(form[LAM_TURNOS_KEY]), [form])
  const activeTurno = useMemo(() => parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY]), [form])
  const areaEstado = readLaminacionEstadoArea(form[LAM_ESTADO_KEY])
  const areaFinalizada = areaEstado === "finalizada"
  const readOnlyOps = areaFinalizada && !canFinalizeOrder
  const hasActiveTurno = activeTurno !== null
  const jsonAccum = useMemo(
    () => accumulateLaminacionFromJson(closedTurnos, activeTurno),
    [closedTurnos, activeTurno],
  )

  const patchActiveTurn = useCallback((updater: (t: LaminacionTurnoEntry) => LaminacionTurnoEntry) => {
    setForm((prev) => {
      const cur = parseLaminacionTurnoActual(prev[LAM_ACTUAL_KEY])
      if (!cur) return prev
      const nextTurn = updater(cur)
      return {
        ...prev,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      }
    })
  }, [])

  const totalSalidaTurno = activeTurno
    ? sumSalidaKgTurno(activeTurno)
    : sumSeriesKg(getNumericSeries(form, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS))
  const pedidoTotalKg = readNumber(form.pedidoKg ?? prefill.pedidoKg)
  const producidoAcumuladoKg =
    readNumber(form.lamAcumuladoProducidoKg) > 0
      ? readNumber(form.lamAcumuladoProducidoKg)
      : jsonAccum.producidoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = jsonAccum.turnosRegistrados
  const totalProduccionAcumulada = jsonAccum.producidoKg
  const totalScrapAcumulada = jsonAccum.scrapKg
  const ultimoTurnoLabel = hasActiveTurno ? "Turno en curso" : jsonAccum.ultimoCierreLabel

  const [timerTick, setTimerTick] = useState(0)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [startTurnConfirmOpen, setStartTurnConfirmOpen] = useState(false)
  const [startTimerConfirmOpen, setStartTimerConfirmOpen] = useState(false)
  const [takeoverConfirmOpen, setTakeoverConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false)
  const [previewTimerConfirmOpen, setPreviewTimerConfirmOpen] = useState(false)
  const [closeTurnConfirmOpen, setCloseTurnConfirmOpen] = useState(false)
  const [finalizeOtConfirmOpen, setFinalizeOtConfirmOpen] = useState(false)
  const [emptyShiftCloseDialogOpen, setEmptyShiftCloseDialogOpen] = useState(false)
  const pendingEmptyShiftCloseRef = useRef<{
    cur: LaminacionTurnoEntry
    finalizedTimer: LaminacionTurnTimer
  } | null>(null)
  const pauseReasons = LAM_PAUSE_REASONS

  const timerState = readString(form.lamTimerState) || "pending"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const effectiveAcc = readNumber(form.lamTimerEffectiveAccSec)
  const deadAcc = readNumber(form.lamTimerDeadAccSec)
  const lastResumeAt = readNumber(form.lamTimerLastResumeAtMs)
  const pauseAt = readNumber(form.lamTimerPauseAtMs)
  const nowMs = Date.now() + timerTick * 0
  const effectiveSec = effectiveAcc + (timerRunning && lastResumeAt > 0 ? (nowMs - lastResumeAt) / 1000 : 0)
  const deadSec = deadAcc + (timerPaused && pauseAt > 0 ? (nowMs - pauseAt) / 1000 : 0)
  const totalSec = effectiveSec + deadSec
  const otEffectiveAccSec = useMemo(
    () => cumulativeEffectiveSeconds(closedTurnos, activeTurno, Date.now()),
    [closedTurnos, activeTurno, timerTick],
  )
  const kgHora = effectiveSec > 0 ? (totalSalidaTurno / (effectiveSec / 3600)).toFixed(2) : "0.00"
  const pauseEntries = useMemo<LaminacionPauseEntry[]>(() => {
    const raw = form.lamTimerPauses
    if (!Array.isArray(raw)) return []
    return raw
      .map((x) => x as Partial<LaminacionPauseEntry>)
      .map((x) => ({
        at: readString(x.at),
        reason: readString(x.reason),
        obs: readString(x.obs),
        duration_sec: readNumber(x.duration_sec),
      }))
      .filter((x) => x.reason)
  }, [form.lamTimerPauses])

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

  // Respaldo local del turno abierto (evita pérdida al navegar atrás/recargar antes del play).
  useEffect(() => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    if (!hasActiveTurno) return
    try {
      const cur = parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY])
      if (!cur) return
      const mirror = laminacionTurnoToMirror(cur)
      const draft: LocalLaminacionDraft = {
        work_order_id: workOrderId,
        saved_at_ms: Date.now(),
        active_turno: cur,
        mirror,
      }
      localStorage.setItem(`${LOCAL_LAMINACION_DRAFT_PREFIX}${workOrderId}`, JSON.stringify(draft))
    } catch {
      // no-op
    }
  }, [form, hasActiveTurno, workOrderId])

  const timerEverStarted = useMemo(
    () => hasProductionTimerStarted(mesTimerFieldsFromForm(form, "lam")),
    [form],
  )

  const canSaveProduction = useMemo(() => {
    if (controlReadOnly) return false
    return canSaveProductionAreaForm(form, MES_PRODUCTION_SAVE_CONFIG.laminacion)
  }, [controlReadOnly, form])

  const canPersistShiftOpen = useMemo(() => {
    if (controlReadOnly) return false
    return hasActiveTurno
  }, [controlReadOnly, hasActiveTurno])

  const canClickGuardar = canSaveProduction || canPersistShiftOpen

  const guardarHint = useMemo(() => {
    if (controlReadOnly) return ""
    if (canSaveProduction) return ""
    if (canPersistShiftOpen) {
      return "Turno abierto: puede guardar el registro. Para avisar a otras áreas, inicie el cronómetro (play) y vuelva a guardar."
    }
    return MES_SAVE_BLOCKED_MESSAGE
  }, [canPersistShiftOpen, canSaveProduction, controlReadOnly])

  const canPreviewTimerReport = useMemo(() => {
    if (!hasActiveTurno) return false
    if (controlReadOnly) return false
    if (areaFinalizada) return false
    return timerEverStarted
  }, [hasActiveTurno, controlReadOnly, areaFinalizada, timerEverStarted])

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
    const nextTurn: LaminacionTurnoEntry = {
      ...cur,
      control_owner_user_id: u.id,
      control_owner_name: u.name,
      control_taken_at: new Date().toISOString(),
    }
    patchActiveTurn(() => nextTurn)
    setTakeoverConfirmOpen(false)
    mesLaminacionToastSuccess("Control tomado. Puede editar el turno.")
    void persistLaminacionForm(
      {
        ...form,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: timerEverStarted,
      },
    )
  }

  function runOpenTimerReportPreview() {
    const payload = {
      generated_at: new Date().toISOString(),
      work_order_id: workOrderId,
      work_order_code: readString(prefill.code) || `OT-${workOrderId}`,
      product: readString((prefill as Record<string, unknown>).productName) || null,
      client: readString((prefill as Record<string, unknown>).clientName) || null,
      turno: {
        turno: readString(form.lamTurno),
        grupo: readString(form.lamGrupo),
        operador: readString(form.lamOperador),
        ayudante: readString(form.lamAyudante),
        supervisor: readString(form.lamSupervisor),
      },
      timer: {
        state: timerState,
        total_hms: formatTimerHms(totalSec),
        dead_hms: formatTimerHms(deadSec),
        effective_hms: formatTimerHms(effectiveSec),
        kg_hora: kgHora,
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
        `axones.laminacion.timer-preview.${workOrderId}`,
        JSON.stringify(payload),
      )
    } catch {
      toast.error("No se pudo guardar la vista previa en el navegador.")
      return
    }
    // Abrir dentro del sistema (SPA) bajo /axones (basename del router)
    // usando una pestaña nueva para mantener la pantalla operativa abierta.
    const url = `${window.location.origin}/axones/ordenes-trabajo/${encodeURIComponent(
      String(workOrderId),
    )}/laminacion/temporizador/vista-previa`
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

  function requestCerrarTurnoActual() {
    if (controlReadOnly) return
    const cur = parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY])
    if (!cur) return
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador.")
      return
    }
    setCloseTurnConfirmOpen(true)
  }

  function confirmCloseTurnFirstStep() {
    setCloseTurnConfirmOpen(false)
    cerrarTurnoActual()
  }

  function requestFinalizarAreaLaminacion() {
    if (!canFinalizeOrder) return
    setFinalizeOtConfirmOpen(true)
  }

  function confirmFinalizarAreaLaminacion() {
    setFinalizeOtConfirmOpen(false)
    void finalizarAreaLaminacion()
  }

  const outlierWarnings = useMemo(() => {
    const warnings: string[] = []
    const MAX_KG_PRODUCCION = 50000
    const MAX_MERMA = 10000
    const MAX_METRAJE = 1000000

    if (totalSalidaTurno > MAX_KG_PRODUCCION) {
      warnings.push(`Salida del turno elevada (${totalSalidaTurno.toFixed(2)} Kg). Verifique unidad y captura.`)
    }
    const scrapTurno = activeTurno ? sumScrapKgTurno(activeTurno) : readLamNumber(form.lamScrapLaminadoKg)
    if (scrapTurno > MAX_MERMA) {
      warnings.push(`Scrap del turno alto (${scrapTurno.toFixed(2)} Kg).`)
    }
    const metraje = readNumber(form.lamMetrajeProduccion)
    if (metraje > MAX_METRAJE) {
      warnings.push(`Metraje elevado (${metraje.toFixed(0)}). Revise que no haya ceros extra.`)
    }
    if (pedidoTotalKg > 0 && producidoAcumuladoKg > pedidoTotalKg + 0.01) {
      warnings.push(
        `Producido acumulado (${producidoAcumuladoKg.toFixed(2)} Kg) supera el pedido (${pedidoTotalKg.toFixed(2)} Kg). Verifique unidades o captura.`,
      )
    }
    return warnings
  }, [totalSalidaTurno, form.lamScrapLaminadoKg, form.lamMetrajeProduccion, pedidoTotalKg, producidoAcumuladoKg])

  const persistLaminacionForm = useCallback(
    async (
      srcBase?: Record<string, unknown>,
      options?: {
        skipProductionSaveGuard?: boolean
        notifyProductionSave?: boolean
        successMessage?: string
        suppressSuccessToast?: boolean
      },
    ): Promise<boolean> => {
      const src = srcBase ?? form
      if (!Number.isFinite(workOrderId) || workOrderId < 1) return false
      const notifyProductionSave = options?.notifyProductionSave !== false

      if (
        notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !canSaveProductionAreaForm(src, MES_PRODUCTION_SAVE_CONFIG.laminacion)
      ) {
        toast.error(MES_SAVE_BLOCKED_MESSAGE)
        return false
      }

      const finalizingArea = readLaminacionEstadoArea(src[LAM_ESTADO_KEY]) === "finalizada"
      if (
        !finalizingArea &&
        !notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !parseLaminacionTurnoActual(src[LAM_ACTUAL_KEY])
      ) {
        toast.error("Abra un turno de planta antes de guardar.")
        return false
      }

      const act = parseLaminacionTurnoActual(src[LAM_ACTUAL_KEY])
      if (act) {
        const operador = act.operador.trim()
        const turno = act.turno
        const grupo = act.grupo
        if (!operador || !turno || !grupo) {
          toast.error("Laminación: complete turno, grupo y operador antes de guardar.")
          return false
        }
      }

      if (outlierWarnings.length > 0) {
        mesLaminacionToastWarning(`Se detectaron ${outlierWarnings.length} valores atípicos. Se guardará de todas formas.`)
      }

      const closedP = parseLaminacionTurnos(src[LAM_TURNOS_KEY])
      const actualP = parseLaminacionTurnoActual(src[LAM_ACTUAL_KEY])
      const accFromJson = accumulateLaminacionFromJson(closedP, actualP)

      const seriesBase = actualP
        ? {
            entradaImpresaBobinas: actualP.entradaImpresaBobinasKg,
            entradaVirgenBobinas: actualP.entradaVirgenBobinasKg,
            salidaBobinas: actualP.salidaBobinasKg,
            entradaImpresaBobinasMeta: actualP.entradaImpresaBobinasMeta,
            entradaVirgenBobinasMeta: actualP.entradaVirgenBobinasMeta,
            salidaBobinasMeta: actualP.salidaBobinasMeta,
          }
        : {
            entradaImpresaBobinas: getNumericSeries(src, "lamEntradaImpresaBobinasKg", LAM_BOBINAS_SLOTS),
            entradaVirgenBobinas: getNumericSeries(src, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS),
            salidaBobinas: getNumericSeries(src, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS),
            entradaImpresaBobinasMeta: getMetaSeries(src, "lamEntradaImpresaBobinasMeta", LAM_BOBINAS_SLOTS),
            entradaVirgenBobinasMeta: getMetaSeries(src, "lamEntradaVirgenBobinasMeta", LAM_BOBINAS_SLOTS),
            salidaBobinasMeta: getMetaSeries(src, "lamSalidaBobinasMeta", LAM_BOBINAS_SLOTS),
          }

      const normalizedForm = normalizeLaminacionFormForSave(
        {
          ...src,
          [LAM_TURNOS_KEY]: closedP,
          [LAM_ACTUAL_KEY]: actualP,
          [LAM_ESTADO_KEY]: readLaminacionEstadoArea(src[LAM_ESTADO_KEY]),
          lamTimerEffectiveAccSec: normalizeNumericString(src.lamTimerEffectiveAccSec),
          lamTimerDeadAccSec: normalizeNumericString(src.lamTimerDeadAccSec),
          lamRegistrosTurnos: String(accFromJson.turnosRegistrados),
          lamAcumuladoProducidoKg: normalizeNumericString(accFromJson.producidoKg),
        },
        seriesBase,
      )

      const laminacionOnlyForm: Record<string, unknown> = Object.fromEntries(
        Object.entries(normalizedForm).filter(([k]) => k && k.startsWith("lam")),
      )

      setSaving(true)
      try {
        await apiFetch(`work-orders/${workOrderId}/orden-trabajo/laminacion-control`, {
          method: "PATCH",
          body: JSON.stringify({
            form: laminacionOnlyForm,
            origin_area: "laminacion",
            notify_on_production_save: notifyProductionSave,
          }),
        })
        setForm(bootstrapLaminacionFormState(normalizedForm))
        if (!options?.suppressSuccessToast) {
          mesLaminacionToastSuccess(
            options?.successMessage ??
              (notifyProductionSave
                ? "Control de laminación guardado."
                : "Turno de planta guardado en el servidor."),
          )
        }
        window.dispatchEvent(
          new CustomEvent(LAMINACION_CONTROL_SAVED_EVENT, { detail: { workOrderId } }),
        )
        return true
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo guardar control de laminación.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [form, outlierWarnings.length, workOrderId],
  )

  // Wrapper estable para intervalos.
  const persistLaminacionFormCb = useCallback((srcBase?: Record<string, unknown>) => {
    void persistLaminacionForm(srcBase)
  }, [persistLaminacionForm])

  useEffect(() => {
    if (!timerRunning && !timerPaused) return
    const id = window.setInterval(() => setTimerTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [timerPaused, timerRunning])

  // Auto-guardado cada 60s mientras corre el temporizador (si tengo control).
  useEffect(() => {
    if (!timerRunning) return
    if (controlReadOnly) return
    const id = window.setInterval(() => {
      if (controlReadOnly) return
      if (saving) return
      persistLaminacionFormCb(form)
    }, 60000)
    return () => window.clearInterval(id)
  }, [timerRunning, controlReadOnly, saving, persistLaminacionFormCb, form])

  function startProductionTimer() {
    if (!hasActiveTurno || controlReadOnly) return
    setStartTimerConfirmOpen(true)
  }

  function confirmStartProductionTimer() {
    if (!hasActiveTurno || controlReadOnly) return
    const now = Date.now()
    const cur = activeTurno
    if (!cur) return
    const nextTurn: LaminacionTurnoEntry = {
      ...cur,
      timer: {
        ...cur.timer,
        state: "running",
        startedAtMs: cur.timer.startedAtMs || now,
        lastResumeAtMs: now,
        pauseAtMs: 0,
      },
    }
    patchActiveTurn(() => nextTurn)
    setStartTimerConfirmOpen(false)
    void persistLaminacionForm({
      ...form,
      [LAM_ACTUAL_KEY]: nextTurn,
      ...laminacionTurnoToMirror(nextTurn),
    })
  }

  function requestPauseProductionTimer() {
    if (!timerRunning || controlReadOnly) return
    setPauseConfirmOpen(true)
  }

  function confirmPauseProductionTimer() {
    setPauseConfirmOpen(false)
    executePauseProductionTimer()
  }

  /** Pausa atómica: un solo setForm + persist con el mismo snapshot (evita desincronía mirror / turno anidado). */
  function executePauseProductionTimer() {
    if (!timerRunning || controlReadOnly) return
    const now = Date.now()
    setForm((prev) => {
      const cur = parseLaminacionTurnoActual(prev[LAM_ACTUAL_KEY])
      if (!cur || cur.timer.state !== "running") return prev
      const last = cur.timer.lastResumeAtMs
      const nextTurn: LaminacionTurnoEntry = {
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
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => {
        void persistLaminacionForm(nextForm)
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
      const cur = parseLaminacionTurnoActual(prev[LAM_ACTUAL_KEY])
      if (!cur || cur.timer.state !== "paused") return prev
      const now = Date.now()
      const pauseStart = cur.timer.pauseAtMs
      const pauseDurationSec = pauseStart > 0 ? (now - pauseStart) / 1000 : 0
      const nextTurn: LaminacionTurnoEntry = {
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
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => {
        void persistLaminacionForm(nextForm)
      })
      return nextForm
    })
    setPauseReason("")
    setPauseObs("")
    setPauseMotivoModalOpen(false)
    mesLaminacionToastSuccess("Parada registrada. El cronómetro sigue en pausa; use play para reanudar el tiempo efectivo.")
  }

  function requestIniciarTurno() {
    if (readOnlyOps) return
    if (hasActiveTurno) return
    if (!draftOperadorName) {
      toast.error(
        draftPeople.length > 0
          ? "Falta un Operador en la cuadrilla. Guarde al menos una persona con rol Operador (Ayudante no basta)."
          : "Guarde al menos un operador en la cuadrilla antes de iniciar el turno.",
      )
      return
    }
    setStartTurnConfirmOpen(true)
  }

  function confirmIniciarTurno() {
    if (readOnlyOps) return
    if (hasActiveTurno) return
    if (!draftOperadorName) {
      setStartTurnConfirmOpen(false)
      toast.error(
        draftPeople.length > 0
          ? "Falta un Operador en la cuadrilla. Guarde al menos una persona con rol Operador (Ayudante no basta)."
          : "Guarde al menos un operador en la cuadrilla antes de iniciar el turno.",
      )
      return
    }
    const u = getStoredUser()
    const t = createNewLaminacionTurno({
      turno: draftTurno,
      grupo: draftGrupo,
      operador: draftOperadorName,
      controlOwner: u ? { id: u.id, name: u.name } : null,
    })
    const turnoWithPeople: LaminacionTurnoEntry = {
      ...t,
      ayudante: draftAyudantesLabel,
      supervisor: draftSupervisorName,
    }
    const nextForm: Record<string, unknown> = {
      ...form,
      [LAM_ACTUAL_KEY]: turnoWithPeople,
      ...laminacionTurnoToMirror(turnoWithPeople),
      [LAM_TURNOS_KEY]: parseLaminacionTurnos(form[LAM_TURNOS_KEY]),
    }
    setForm(nextForm)
    setDraftPeople([])
    setDraftStaging({ name: "", role: "operador" })
    setStartTurnConfirmOpen(false)
    void (async () => {
      await persistLaminacionForm(nextForm, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage:
          "Turno de planta abierto y guardado. Use play en «Cronómetro de producción» para iniciar tiempos.",
      })
      await tryAdvanceBoardStageToLaminacion()
    })()
  }

  async function tryAdvanceBoardStageToLaminacion() {
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
      if ((stageOrder[bs] ?? -1) >= stageOrder.laminacion) return
      await apiFetch(`work-orders/${workOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: "laminacion" }),
      })
    } catch {
      /* sin permiso o red */
    }
  }

  async function applyCerrarTurno(cur: LaminacionTurnoEntry, finalizedTimer: LaminacionTurnTimer) {
    const u = getStoredUser()
    const closed: LaminacionTurnoEntry = {
      ...cur,
      timer: finalizedTimer,
      closed_at: new Date().toISOString(),
      closed_by: u ? { id: u.id, name: u.name } : null,
    }
    const nextForm: Record<string, unknown> = {
      ...form,
      [LAM_TURNOS_KEY]: [...parseLaminacionTurnos(form[LAM_TURNOS_KEY]), closed],
      [LAM_ACTUAL_KEY]: null,
      ...clearLaminacionMirrorKeys(),
      ...laminacionAggregatedTimerMirrorFromTurnos([...parseLaminacionTurnos(form[LAM_TURNOS_KEY]), closed]),
    }
    setForm(bootstrapLaminacionFormState(nextForm))
    const ok = await persistLaminacionForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      mesLaminacionToastSuccess("Turno de planta cerrado y guardado.")
      await load()
    }
  }

  function confirmEmptyShiftClose() {
    const p = pendingEmptyShiftCloseRef.current
    pendingEmptyShiftCloseRef.current = null
    setEmptyShiftCloseDialogOpen(false)
    if (!p) return
    void applyCerrarTurno(p.cur, p.finalizedTimer)
  }

  function cerrarTurnoActual() {
    if (controlReadOnly) return
    const cur = parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY])
    if (!cur) return
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador.")
      return
    }
    const finalizedTimer = finalizeLaminacionTurnTimerNow(cur.timer)
    if (finalizedTimer.effectiveAccSec < 0.01 && sumSalidaKgTurno(cur) === 0) {
      pendingEmptyShiftCloseRef.current = { cur, finalizedTimer }
      setEmptyShiftCloseDialogOpen(true)
      return
    }
    void applyCerrarTurno(cur, finalizedTimer)
  }

  async function finalizarAreaLaminacion() {
    if (!canFinalizeOrder) {
      toast.error("Solo jefatura puede finalizar el área de laminación.")
      return
    }
    const prev = form
    let turnos = parseLaminacionTurnos(prev[LAM_TURNOS_KEY])
    const cur = parseLaminacionTurnoActual(prev[LAM_ACTUAL_KEY])
    const u = getStoredUser()
    if (cur) {
      const closed: LaminacionTurnoEntry = {
        ...cur,
        timer: finalizeLaminacionTurnTimerNow(cur.timer),
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
      }
      turnos = [...turnos, closed]
    }
    const nextForm: Record<string, unknown> = {
      ...prev,
      [LAM_TURNOS_KEY]: turnos,
      [LAM_ACTUAL_KEY]: null,
      [LAM_ESTADO_KEY]: "finalizada",
      ...clearLaminacionMirrorKeys(),
      ...laminacionAggregatedTimerMirrorFromTurnos(turnos),
    }
    clearLocalLaminacionDrafts(workOrderId)
    setForm(bootstrapLaminacionFormState(nextForm))
    const ok = await persistLaminacionForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      mesLaminacionToastSuccess(
        "Área de laminación finalizada. La OT pasará a Finalizadas e Historial en la bandeja.",
      )
      await load()
    } else {
      toast.error("No se pudo finalizar el área de laminación. Revise su conexión o permisos de jefatura.")
    }
  }

  function openLabelEditor(mode: LamLabelEditorMode, idx: number) {
    const meta =
      mode === "impresa"
        ? entradaImpresaBobinasMeta[idx]
        : mode === "virgen"
          ? entradaVirgenBobinasMeta[idx]
          : salidaBobinasMeta[idx]
    setLabelEditorMode(mode)
    setLabelEditorIndex(idx)
    setLabelEditorDraft(meta ? { ...meta } : emptyBobinaLabelMeta())
    setLabelEditorError("")
    setLabelEditorOpen(true)
  }

  function updateLabelDraft(key: keyof BobinaLabelMeta, value: string) {
    setLabelEditorDraft((prev) => ({ ...prev, [key]: value }))
    if (key === "fecha" && labelEditorError) setLabelEditorError("")
  }

  function clearLabelEditor() {
    setLabelEditorDraft(emptyBobinaLabelMeta())
    setLabelEditorError("")
  }

  function saveLabelEditor() {
    const err = validateBobinaLabelSave(labelEditorDraft)
    if (err) {
      setLabelEditorError(err)
      return
    }
    const normalized = normalizeBobinaLabelMeta(labelEditorDraft)
    const key = metaKeyForLabelMode(labelEditorMode)
    patchActiveTurn((t) => {
      const next = { ...t }
      if (labelEditorMode === "impresa") {
        const meta = [...t.entradaImpresaBobinasMeta]
        meta[labelEditorIndex] = normalized
        next.entradaImpresaBobinasMeta = meta
      } else if (labelEditorMode === "virgen") {
        const meta = [...t.entradaVirgenBobinasMeta]
        meta[labelEditorIndex] = normalized
        next.entradaVirgenBobinasMeta = meta
      } else {
        const meta = [...t.salidaBobinasMeta]
        meta[labelEditorIndex] = normalized
        next.salidaBobinasMeta = meta
      }
      return next
    })
    setLabelEditorOpen(false)
    setLabelEditorError("")
  }

  function patchBobinaKg(
    field: "entradaImpresaBobinasKg" | "entradaVirgenBobinasKg" | "salidaBobinasKg",
    idx: number,
    v: string,
  ) {
    patchActiveTurn((t) => {
      const next = { ...t }
      if (field === "entradaImpresaBobinasKg") {
        const arr = [...t.entradaImpresaBobinasKg]
        arr[idx] = v
        next.entradaImpresaBobinasKg = arr
      } else if (field === "entradaVirgenBobinasKg") {
        const arr = [...t.entradaVirgenBobinasKg]
        arr[idx] = v
        next.entradaVirgenBobinasKg = arr
      } else {
        const arr = [...t.salidaBobinasKg]
        arr[idx] = v
        next.salidaBobinasKg = arr
      }
      return next
    })
  }

  async function guardar() {
    if (canSaveProduction) {
      await persistLaminacionForm()
      return
    }
    if (canPersistShiftOpen) {
      await persistLaminacionForm(undefined, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage:
          "Turno guardado. Inicie el cronómetro (play) para habilitar el guardado de producción con aviso a otras áreas.",
      })
      return
    }
    toast.error(MES_SAVE_BLOCKED_MESSAGE)
  }

  function requestResetAll() {
    if (saving) return
    if (controlReadOnly) return
    setResetConfirmOpen(true)
  }

  async function confirmResetAll() {
    if (saving) return
    if (controlReadOnly) return
    setResetConfirmOpen(false)

    const cleared: Record<string, unknown> = {
      ...form,
      [LAM_TURNOS_KEY]: [],
      [LAM_ACTUAL_KEY]: null,
      ...clearLaminacionMirrorKeys(),
    }
    for (const k of Object.keys(cleared)) {
      if (k.startsWith("lamBlockDone.")) delete cleared[k]
    }

    clearLocalLaminacionDrafts(workOrderId)
    setForm(bootstrapLaminacionFormState(cleared))
    mesLaminacionToastSuccess("Laminación reiniciado localmente. Guardando en el servidor…")
    await persistLaminacionForm(cleared, { skipProductionSaveGuard: true })
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de laminación…</p>

  return (
    <div className="ax-mes space-y-4">
      <WorkOrderStageBadge current="produccion" />
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

      <div className="ax-ot">
        <div className="ot-section">
          <div className="section-header">
            <span className="inline-flex items-center gap-2">
              <Layers className="h-4 w-4" />
              AREA DE LAMINACION
            </span>
          </div>
          <div className="section-body">
            <div className="ot-grid ot-cols-4">
              <div className="ot-field sm:col-span-2 lg:col-span-1">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="ot-label">Figura embobinado</label>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Figura
                  </Badge>
                </div>
                <WindingFigurePicker
                  value={readString(form.figuraEmbobinadoLam)}
                  onChange={() => undefined}
                  className="pointer-events-none"
                />
              </div>
              <div className="ot-field">
                <label className="ot-label">Gramaje adhesivo (g/m2)</label>
                <input className="ot-input" value={readString(form.gramajeAdhesivo)} placeholder="1,5 a 2,0" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Relacion mezcla</label>
                <input className="ot-input" value={readString(form.relacionMezcla)} placeholder="100/80" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Observaciones</label>
                <input className="ot-input" value={readString(form.obsLaminacion)} readOnly />
              </div>
            </div>

            <div className="ot-section">
              <div className="section-header section-sublam">
                <span className="inline-flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  SUSTRATOS VIRGEN A UTILIZAR (LAMINACION)
                </span>
              </div>
              <div className="section-body">
                {sustratosLam.map((r, idx) => {
                  const material = materialById.get(r.material_id)
                  const free = readString(r.material_free_text).trim()
                  const materialLabel = free
                    ? free
                    : material
                      ? `${material.sku} · ${material.name}`
                      : readString(r.material_id).trim()
                        ? readString(r.material_id)
                        : ""
                  return (
                    <div key={idx} className="ot-grid ot-cols-2-asym ot-sustrato-lam">
                      <div className="ot-field">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="ot-label">{`Sustrato ${idx + 1}`}</label>
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Inventario
                          </Badge>
                        </div>
                        <input className="ot-input" value={materialLabel} placeholder="Seleccionar del inventario..." readOnly />
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Kg a utilizar</label>
                        <input className="ot-input" value={r.kg} placeholder="Ej: 430" readOnly />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="ot-grid ot-cols-4">
              <div className="ot-field">
                <label className="ot-label">Kg entrada</label>
                <input className="ot-input" value={readNumberString(form.kgEntradaLam)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Kg salida</label>
                <input className="ot-input" value={readNumberString(form.kgSalidaLam)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Metraje</label>
                <input className="ot-input" value={readNumberString(form.metrajeLam)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Merma</label>
                <input className="ot-input" value={readNumberString(form.mermaLam)} readOnly />
              </div>
            </div>

            <div className="ot-grid ot-cols-4">
              <div className="ot-field">
                <label className="ot-label">Kg entrada 2 (trilam.)</label>
                <input className="ot-input" value={readNumberString(form.kgEntradaLam2)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Kg salida 2 (trilam.)</label>
                <input className="ot-input" value={readNumberString(form.kgSalidaLam2)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Metraje 2</label>
                <input className="ot-input" value={readNumberString(form.metrajeLam2)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Merma 2</label>
                <input className="ot-input" value={readNumberString(form.mermaLam2)} readOnly />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Datos de pedido / OT (solo lectura)</h3>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
            Actualizar
          </Button>
        </div>
        <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-muted-foreground">OT:</span>{" "}
            {readString(prefill.numeroOrden) || readString(prefill.code) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Cliente:</span> {readString(form.cliente) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Producto:</span> {readString(form.producto) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">CPE:</span> {readString(form.cpe) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Estructura:</span> {readString(form.estructuraMaterial) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Tipo impresión:</span>{" "}
            {readString(form.tipoImpresionEstructura || form.tipoImpresion) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Gramaje adhesivo:</span> {readString(form.gramajeAdhesivo) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Relación mezcla:</span> {readString(form.relacionMezcla) || "—"}
          </div>
        </div>
      </div>

      <WorkOrderLaminacionOpsSection
        pedidoTotalKg={pedidoTotalKg}
        producidoAcumuladoKg={producidoAcumuladoKg}
        faltanteKg={faltanteKg}
        turnosRegistrados={turnosRegistrados}
        totalProduccionAcumulada={totalProduccionAcumulada}
        totalEntradaImpresa={totalEntradaImpresa}
        totalEntradaVirgen={totalEntradaVirgen}
        totalSalida={totalSalida}
        totalScrap={totalScrap}
        mermaCalc={mermaCalc}
        refilPct={refilPct}
        totalSalidaTurnoKg={totalSalidaTurno}
        totalScrapAcumulada={totalScrapAcumulada}
        ultimoTurnoLabel={ultimoTurnoLabel}
        timerState={timerState}
        totalSec={totalSec}
        deadSec={deadSec}
        effectiveSec={effectiveSec}
        kgHora={kgHora}
        timerRunning={timerRunning}
        timerPaused={timerPaused}
        pauseReasons={pauseReasons}
        pauseReason={pauseReason}
        pauseObs={pauseObs}
        pauseMotivoDialogOpen={pauseMotivoModalOpen}
        onPauseMotivoDialogOpenChange={setPauseMotivoModalOpen}
        pauseEntries={pauseEntries}
        lamTurno={readString(form.lamTurno)}
        lamGrupo={readString(form.lamGrupo)}
        lamOperador={readString(form.lamOperador)}
        lamAyudante={readString(form.lamAyudante)}
        lamSupervisor={readString(form.lamSupervisor)}
        kgProduccionRaw={readNumberString(form.lamKgProduccion)}
        mermaRaw={readNumberString(form.lamMermaKg)}
        metrajeRaw={readNumberString(form.lamMetraje)}
        formatTimerHms={formatTimerHms}
        setPauseReason={setPauseReason}
        setPauseObs={setPauseObs}
        startProductionTimer={startProductionTimer}
        pauseProductionTimer={requestPauseProductionTimer}
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
        onFinalizarAreaLaminacion={requestFinalizarAreaLaminacion}
        closedTurnos={closedTurnos}
        onSetTurno={(v) => patchActiveTurn((t) => ({ ...t, turno: v }))}
        onSetGrupo={(v) => patchActiveTurn((t) => ({ ...t, grupo: v }))}
        onActivePersonnelApply={(people) => {
          const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
          patchActiveTurn((t) => ({ ...t, operador, ayudante, supervisor }))
        }}
        onSetKgProduccion={(v) => patchActiveTurn((t) => ({ ...t, kgProduccion: v }))}
        onSetMerma={(v) => patchActiveTurn((t) => ({ ...t, mermaKg: v }))}
        onSetMetraje={(v) => patchActiveTurn((t) => ({ ...t, metrajeLaminacion: v }))}
        canPreviewTimerReport={canPreviewTimerReport}
        onPreviewTimerReport={requestOpenTimerReportPreview}
        canResetAll={!saving && !controlReadOnly}
        onResetAll={requestResetAll}
        simplifiedTimerActions
      />

      {(() => {
        const doneObs = !!readString(form.lamObservaciones).trim()
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
              id={lamObsTextareaId}
              name="lamObservaciones"
              aria-label="Observaciones del turno"
              value={readString(form.lamObservaciones)}
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
          <Button type="button" onClick={() => void guardar()} disabled={saving || !canClickGuardar}>
            <Save className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          {!controlReadOnly && !areaFinalizada ? (
            <Button
              type="button"
              variant="outline"
              className="border-amber-300 text-amber-950 hover:bg-amber-50"
              disabled={saving}
              onClick={requestResetAll}
            >
              <RotateCcw className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Empezar de cero
            </Button>
          ) : null}
          {hasActiveTurno && !areaFinalizada && !controlReadOnly ? (
            <Button
              type="button"
              variant="outline"
              className="border-orange-300 text-orange-950 hover:bg-orange-50"
              disabled={saving}
              onClick={requestCerrarTurnoActual}
            >
              <LogOut className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Terminar turno de planta
            </Button>
          ) : null}
          {canFinalizeOrder && !areaFinalizada ? (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={requestFinalizarAreaLaminacion}
            >
              <Flag className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Finalizar área de laminación
            </Button>
          ) : null}
        </div>
      </div>

      <MesLaminacionConfirmDialog
        tone="emerald"
        open={startTimerConfirmOpen}
        onOpenChange={setStartTimerConfirmOpen}
        icon={<CirclePlay className="h-5 w-5" aria-hidden />}
        title="Iniciar cronómetro (Laminación)"
        description="¿Está seguro? Una vez iniciado, el cronómetro de máquina corre (tiempo efectivo); las paradas registran motivo. El turno de planta ya debe estar abierto."
        confirmLabel="Confirmar e iniciar"
        onConfirm={() => confirmStartProductionTimer()}
      />

      <MesLaminacionConfirmDialog
        tone="sky"
        open={pauseConfirmOpen}
        onOpenChange={setPauseConfirmOpen}
        icon={<CirclePause className="h-5 w-5" aria-hidden />}
        title="Pausar cronómetro (parada)"
        description="Se detendrá el tiempo efectivo y deberá registrar el motivo de la parada (tiempo muerto). No cierra el turno de planta; use «Cerrar turno» para eso. Tras registrar el motivo, el cronómetro seguirá en pausa hasta que pulse play. ¿Desea pausar ahora?"
        confirmLabel="Sí, pausar"
        onConfirm={() => confirmPauseProductionTimer()}
      />

      <MesLaminacionConfirmDialog
        tone="violet"
        open={previewTimerConfirmOpen}
        onOpenChange={setPreviewTimerConfirmOpen}
        icon={<FileSearch className="h-5 w-5" aria-hidden />}
        title="Vista previa del cronómetro"
        description="Se abrirá una pestaña nueva con el reporte de tiempos y pausas registrados hasta este momento."
        confirmLabel="Abrir vista previa"
        onConfirm={() => confirmOpenTimerReportPreview()}
      />

      <MesLaminacionConfirmDialog
        tone="amber"
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        icon={<RotateCcw className="h-5 w-5" aria-hidden />}
        title="Reiniciar laminación (OT)"
        description={
          <>
            Esto borrará turnos, cronómetro, producción, merma y metraje registrados en Laminación para esta OT.
            También limpia el respaldo local del navegador. ¿Desea continuar?
          </>
        }
        confirmLabel="Confirmar reinicio"
        onConfirm={() => void confirmResetAll()}
      />

      <MesLaminacionConfirmDialog
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

      <MesLaminacionConfirmDialog
        tone="rose"
        open={closeTurnConfirmOpen}
        onOpenChange={setCloseTurnConfirmOpen}
        icon={<LogOut className="h-5 w-5" aria-hidden />}
        title="Cerrar turno"
        description="Se cerrará el registro de turno de planta en curso y se consolidará el cronómetro en el historial. Podrá abrir otro turno de planta después. ¿Confirma el cierre?"
        confirmLabel="Sí, cerrar turno"
        onConfirm={() => confirmCloseTurnFirstStep()}
      />

      <MesLaminacionConfirmDialog
        tone="red"
        open={finalizeOtConfirmOpen}
        onOpenChange={setFinalizeOtConfirmOpen}
        icon={<Flag className="h-5 w-5" aria-hidden />}
        title="Finalizar área de laminacion (OT)"
        description="Marcará el área de laminacion como finalizada en la orden. Revise que los datos del turno estén completos antes de continuar."
        confirmLabel="Sí, finalizar área"
        confirmVariant="destructive"
        onConfirm={() => confirmFinalizarAreaLaminacion()}
      />

      <MesLaminacionConfirmDialog
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

      <MesLaminacionConfirmDialog
        tone="indigo"
        open={startTurnConfirmOpen}
        onOpenChange={setStartTurnConfirmOpen}
        icon={<Sparkles className="h-5 w-5" aria-hidden />}
        title="Abrir turno de planta (registro)"
        description="Confirme para abrir el registro de turno de planta (Diurno/Nocturno y grupo), habilitar el cronómetro y el resumen operativo del turno en curso."
        confirmLabel="Confirmar e iniciar"
        onConfirm={() => confirmIniciarTurno()}
      />

    </div>
  )
}
