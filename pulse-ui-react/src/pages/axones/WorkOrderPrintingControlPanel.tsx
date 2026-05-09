"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import WorkOrderPrintingOpsSection, { type BobinaLabelMeta } from "./WorkOrderPrintingOpsSection"
import {
  IMP_ACTUAL_KEY,
  IMP_ESTADO_KEY,
  IMP_TURNOS_KEY,
  accumulatePrintingFromJson,
  bootstrapPrintingFormState,
  clearPrintingMirrorKeys,
  createNewPrintingTurno,
  finalizeTurnTimerNow,
  parsePrintingTurnoActual,
  parsePrintingTurnos,
  printingTurnoToMirror,
  PRINTING_REJECT_REASONS,
  readEstadoArea,
  sumEntradaKg,
  sumSalidaKg,
  type PrintingTurnoEntry,
} from "./printing-turnos"
import "./work-order-planilla.css"
import { Sparkles } from "lucide-react"

import { getStoredUser } from "@/lib/auth-storage"

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

type ReturnDraft = {
  buenaMaterialId: string
  buenaKg: string
  rechazadaMaterialId: string
  rechazadaKg: string
  rechazadaMotivo: string
  rechazadaObs: string
  bobinaCode: string
}

type InventoryReturnCreated = { id: number }

type DraftPersonRole = "operador" | "ayudante" | "supervisor"
type DraftPerson = { id: string; role: DraftPersonRole; name: string }

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

const LOCAL_PRINTING_DRAFT_PREFIX = "axones.printing.control.draft."

type LocalPrintingDraft = {
  work_order_id: number
  saved_at_ms: number
  // Guardamos lo mínimo para rehidratar el temporizador + turno actual.
  active_turno: unknown
  mirror: Record<string, unknown>
}

function clearLocalPrintingDrafts(workOrderId: number) {
  try {
    localStorage.removeItem(`${LOCAL_PRINTING_DRAFT_PREFIX}${workOrderId}`)
  } catch {
    // ignore
  }
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
  const _navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [productionSummary, setProductionSummary] = useState<ProductionSummaryPayload | null>(null)

  /** Borrador para iniciar turno (sin turno activo). */
  const [draftTurno, setDraftTurno] = useState<"diurno" | "nocturno">("diurno")
  const [draftGrupo, setDraftGrupo] = useState<"A" | "B" | "C">("A")
  const [draftPeople, setDraftPeople] = useState<DraftPerson[]>([
    { id: "p0", role: "operador", name: "" },
  ])

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

  const addDraftPerson = useCallback(() => {
    setDraftPeople((prev) => [
      ...prev,
      { id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role: "ayudante", name: "" },
    ])
  }, [])

  const removeDraftPerson = useCallback((id: string) => {
    setDraftPeople((prev) => {
      const next = prev.filter((p) => p.id !== id)
      // Siempre mantener al menos 1 fila operador (restauración)
      if (!next.some((p) => p.role === "operador")) {
        return [{ id: "p0", role: "operador", name: "" }, ...next]
      }
      return next
    })
  }, [])

  const updateDraftPerson = useCallback(
    (id: string, patch: Partial<Pick<DraftPerson, "role" | "name">>) => {
      setDraftPeople((prev) => {
        const existingSupervisorId = prev.find((p) => p.role === "supervisor")?.id
        const desiredRole = patch.role
        if (desiredRole === "supervisor" && existingSupervisorId && existingSupervisorId !== id) {
          toast.warning("Solo puede haber un Supervisor en el turno.")
          return prev
        }
        if (desiredRole && desiredRole !== "operador") {
          const target = prev.find((p) => p.id === id)
          const operadorCount = prev.filter((p) => p.role === "operador").length
          if (target?.role === "operador" && operadorCount === 1) {
            toast.warning("Agregue otra persona al turno antes de cambiar el rol del único operador.")
            return prev
          }
        }

        let next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p))

        if (desiredRole === "operador") {
          return next.map((p) =>
            p.id !== id && p.role === "operador" ? { ...p, role: "ayudante" } : p,
          )
        }

        if (!next.some((p) => p.role === "operador")) {
          const promoteIdx = next.findIndex((p) => p.role === "ayudante")
          if (promoteIdx === -1) {
            toast.warning("Debe existir al menos un operador en el turno.")
            return prev
          }
          next = next.map((p, i) => (i === promoteIdx ? { ...p, role: "operador" } : p))
        }

        return next
      })
    },
    [],
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      setPrefill(payload.prefill ?? {})
      const mergedForm = mergePrefill(payload.prefill ?? {}, payload.form)
      const boot = bootstrapPrintingFormState(mergedForm)
      // Rehidratar desde respaldo local si hay un temporizador más reciente.
      try {
        const raw = localStorage.getItem(`${LOCAL_PRINTING_DRAFT_PREFIX}${workOrderId}`)
        if (raw) {
          const draft = JSON.parse(raw) as Partial<LocalPrintingDraft>
          const serverLastResume = readNumber(boot.impTimerLastResumeAtMs)
          const serverPauseAt = readNumber(boot.impTimerPauseAtMs)
          const serverTimerAny = Math.max(serverLastResume, serverPauseAt)

          const draftMirror =
            draft.mirror && typeof draft.mirror === "object"
              ? (draft.mirror as Record<string, unknown>)
              : null
          const draftLastResume = readNumber(draftMirror?.impTimerLastResumeAtMs)
          const draftPauseAt = readNumber(draftMirror?.impTimerPauseAtMs)
          const draftTimerAny = Math.max(draftLastResume, draftPauseAt)

          if (draftTimerAny > serverTimerAny && draft.active_turno) {
            setForm(
              bootstrapPrintingFormState({
                ...boot,
                [IMP_ACTUAL_KEY]: draft.active_turno,
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

  const closedTurnos = useMemo(() => parsePrintingTurnos(form[IMP_TURNOS_KEY]), [form])
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

  const entradaBobinas = useMemo(() => getNumericSeries(form, "impEntradaBobinasKg", 26), [form])
  const salidaBobinas = useMemo(() => getNumericSeries(form, "impSalidaBobinasKg", 22), [form])
  const entradaBobinasMeta = useMemo(() => getMetaSeries(form, "impEntradaBobinasMeta", 26), [form])
  const salidaBobinasMeta = useMemo(() => getMetaSeries(form, "impSalidaBobinasMeta", 22), [form])
  const totalEntradaTurnoActual = useMemo(
    () => entradaBobinas.reduce((acc, v) => acc + readNumber(v), 0),
    [entradaBobinas],
  )
  const totalSalida = useMemo(() => salidaBobinas.reduce((acc, v) => acc + readNumber(v), 0), [salidaBobinas])
  const scrapTransparente = readNumber(form.impScrapTransparenteKg)
  const scrapImpreso = readNumber(form.impScrapImpresoKg)
  const totalScrap = scrapTransparente + scrapImpreso
  const devolucionBuena = readNumber(form.impDevolucionBuenaKg)
  const devolucionRechazada = readNumber(form.impDevolucionRechazadaKg)
  const devolucionesPendienteAlmacen = useMemo(() => {
    const b = toFiniteOrNull(form.impDevolucionBuenaKg) ?? 0
    const r = toFiniteOrNull(form.impDevolucionRechazadaKg) ?? 0
    if (b <= 0 && r <= 0) return false
    const envioMs = readNumber(form.impDevolucionesAlmacenUltimoEnvioMs)
    const snapB = readString(form.impDevolucionesAlmacenSnapBuena)
    const snapR = readString(form.impDevolucionesAlmacenSnapRech)
    const curB = normalizeNumericString(form.impDevolucionBuenaKg)
    const curR = normalizeNumericString(form.impDevolucionRechazadaKg)
    if (envioMs <= 0) return true
    return curB !== snapB || curR !== snapR
  }, [
    form.impDevolucionBuenaKg,
    form.impDevolucionRechazadaKg,
    form.impDevolucionesAlmacenUltimoEnvioMs,
    form.impDevolucionesAlmacenSnapBuena,
    form.impDevolucionesAlmacenSnapRech,
  ])
  const materialConsumido = Math.max(0, totalEntradaTurnoActual - devolucionBuena - devolucionRechazada)
  const mermaCalcRaw = materialConsumido - totalSalida - totalScrap
  const mermaManual = toFiniteOrNull(form.impMermaKg)
  const mermaCalc = mermaManual ?? Math.abs(mermaCalcRaw)
  const refilPct = materialConsumido > 0 ? (totalScrap / materialConsumido) * 100 : 0
  const pedidoTotalKg = readNumber(form.pedidoKg ?? prefill.pedidoKg)
  const summaryPrinting = productionSummary?.printing
  const historicalBobinaUsages = summaryPrinting?.bobina_usages ?? []
  const historicalSegments = summaryPrinting?.time_segments_recent ?? []
  const hasHistoricalPrinting = historicalBobinaUsages.length > 0 || historicalSegments.length > 0
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
  const formProducedBaseline = readNumber(form.impAcumuladoProducidoKg)
  const producidoAcumuladoKg = hasHistoricalPrinting
    ? historicalSalida
    : formProducedBaseline > 0
      ? formProducedBaseline
      : jsonAccum.producidoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = hasHistoricalPrinting ? inferredHistoricalTurns : jsonAccum.turnosCerrados
  const totalEntradaAcumulada = hasHistoricalPrinting ? historicalEntrada : jsonAccum.entradaKg
  const formScrapAcumulado = readNumber(form.impScrapAcumuladoKg)
  const totalScrapAcumulado = hasHistoricalPrinting
    ? formScrapAcumulado > 0
      ? formScrapAcumulado
      : totalScrap
    : formScrapAcumulado > 0
      ? formScrapAcumulado
      : jsonAccum.scrapKg
  const hasOpenHistoricalProductionSegment =
    summaryPrinting?.open_time_segment?.segment_type === "production" &&
    !summaryPrinting?.open_time_segment?.ended_at
  const formUltimoTurnoLabel = hasActiveTurno
    ? "Turno en curso"
    : jsonAccum.ultimoCierreLabel
  const ultimoTurnoLabel = hasHistoricalPrinting
    ? hasOpenHistoricalProductionSegment
      ? "Turno en ejecución"
      : inferredHistoricalTurns > 0
        ? "Turno cerrado"
        : "Sin producción previa"
    : formUltimoTurnoLabel

  const [timerTick, setTimerTick] = useState(0)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [labelEditorOpen, setLabelEditorOpen] = useState(false)
  const [labelEditorMode, setLabelEditorMode] = useState<"entrada" | "salida">("entrada")
  const [labelEditorIndex, setLabelEditorIndex] = useState(0)
  const [labelEditorDraft, setLabelEditorDraft] = useState<BobinaLabelMeta>(emptyBobinaLabelMeta())
  const [labelEditorError, setLabelEditorError] = useState("")
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [startTurnConfirmOpen, setStartTurnConfirmOpen] = useState(false)
  const [startTimerConfirmOpen, setStartTimerConfirmOpen] = useState(false)
  const [takeoverConfirmOpen, setTakeoverConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [returnLoadingMaterialsGood, setReturnLoadingMaterialsGood] = useState(false)
  const [returnLoadingMaterialsBad, setReturnLoadingMaterialsBad] = useState(false)
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnMaterialOptionsGood, setReturnMaterialOptionsGood] = useState<MaterialRow[]>([])
  const [returnMaterialOptionsBad, setReturnMaterialOptionsBad] = useState<MaterialRow[]>([])
  const [returnDraft, setReturnDraft] = useState<ReturnDraft>({
    buenaMaterialId: "",
    buenaKg: "",
    rechazadaMaterialId: "",
    rechazadaKg: "",
    rechazadaMotivo: "",
    rechazadaObs: "",
    bobinaCode: "",
  })
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
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const effectiveAcc = readNumber(form.impTimerEffectiveAccSec)
  const deadAcc = readNumber(form.impTimerDeadAccSec)
  const lastResumeAt = readNumber(form.impTimerLastResumeAtMs)
  const pauseAt = readNumber(form.impTimerPauseAtMs)
  const nowMs = Date.now() + timerTick * 0
  const effectiveSec = effectiveAcc + (timerRunning && lastResumeAt > 0 ? (nowMs - lastResumeAt) / 1000 : 0)
  const deadSec = deadAcc + (timerPaused && pauseAt > 0 ? (nowMs - pauseAt) / 1000 : 0)
  const totalSec = effectiveSec + deadSec
  const kgHora = effectiveSec > 0 ? (totalSalida / (effectiveSec / 3600)).toFixed(2) : "0.00"
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

  useEffect(() => {
    if (!timerPaused) setPauseMotivoModalOpen(false)
  }, [timerPaused])

  // Respaldo local inmediato del temporizador (evita pérdida al navegar atrás/recargar).
  useEffect(() => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    if (!hasActiveTurno) return
    if (!(timerRunning || timerPaused)) return
    try {
      const cur = parsePrintingTurnoActual(form[IMP_ACTUAL_KEY])
      if (!cur) return
      const mirror = printingTurnoToMirror(cur)
      const draft: LocalPrintingDraft = {
        work_order_id: workOrderId,
        saved_at_ms: Date.now(),
        active_turno: cur,
        mirror,
      }
      localStorage.setItem(`${LOCAL_PRINTING_DRAFT_PREFIX}${workOrderId}`, JSON.stringify(draft))
    } catch {
      // no-op
    }
  }, [form, hasActiveTurno, timerPaused, timerRunning, workOrderId])

  const canPreviewDesperdicioReport = useMemo(() => {
    return hasActiveTurno && !controlReadOnly && !areaFinalizada
  }, [areaFinalizada, controlReadOnly, hasActiveTurno])

  const canPreviewTimerReport = useMemo(() => {
    if (!hasActiveTurno) return false
    if (controlReadOnly) return false
    if (areaFinalizada) return false
    const startedByState =
      timerState === "running" ||
      timerState === "paused" ||
      timerState === "stopped" ||
      timerState === "completed"
    const startedByLegacy =
      effectiveAcc > 0 ||
      deadAcc > 0 ||
      lastResumeAt > 0 ||
      pauseAt > 0 ||
      pauseEntries.length > 0
    return startedByState || startedByLegacy
  }, [
    hasActiveTurno,
    controlReadOnly,
    areaFinalizada,
    timerState,
    effectiveAcc,
    deadAcc,
    lastResumeAt,
    pauseAt,
    pauseEntries.length,
  ])

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
    toast.success("Control tomado. Puede editar el turno.")
    void persistPrintingForm({
      ...form,
      [IMP_ACTUAL_KEY]: nextTurn,
      ...printingTurnoToMirror(nextTurn),
    })
  }

  function openTimerReportPreview() {
    if (!canPreviewTimerReport) {
      toast.error("Inicie el temporizador para habilitar la vista previa.")
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
        `axones.printing.timer-preview.${workOrderId}`,
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
    )}/impresion/temporizador/vista-previa`
    window.open(url, "_blank", "noopener,noreferrer")
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
        merma_kg: mermaCalc,
        refil_pct: refilPct,
        devolucion_buena_kg: devolucionBuena,
        devolucion_rechazada_kg: devolucionRechazada,
        material_consumido_kg: materialConsumido,
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
    const url = `${window.location.origin}/axones/ordenes-trabajo/${encodeURIComponent(
      String(workOrderId),
    )}/impresion/desperdicio/vista-previa`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const outlierWarnings = useMemo(() => {
    const warnings: string[] = []
    const MAX_BOBINA_KG = 5000
    const MAX_DEVOLUCION_KG = 10000
    const MAX_METRAJE = 1000000
    const MAX_TOTAL_ENTRADA = 50000

    if (totalEntradaTurnoActual > MAX_TOTAL_ENTRADA) {
      warnings.push(
        `Total entrada elevado (${totalEntradaTurnoActual.toFixed(2)} Kg). Verifique unidad y captura.`,
      )
    }
    if (devolucionBuena > MAX_DEVOLUCION_KG) {
      warnings.push(`Devolución buena alta (${devolucionBuena.toFixed(2)} Kg).`)
    }
    if (devolucionRechazada > MAX_DEVOLUCION_KG) {
      warnings.push(`Devolución rechazada alta (${devolucionRechazada.toFixed(2)} Kg).`)
    }
    const metraje = readNumber(form.impMetrajeProduccion)
    if (metraje > MAX_METRAJE) {
      warnings.push(`Metraje elevado (${metraje.toFixed(0)}). Revise que no haya ceros extra.`)
    }
    entradaBobinas.forEach((v, idx) => {
      const n = readNumber(v)
      if (n > MAX_BOBINA_KG) warnings.push(`Entrada bobina ${idx + 1} fuera de rango (${n.toFixed(2)} Kg).`)
    })
    salidaBobinas.forEach((v, idx) => {
      const n = readNumber(v)
      if (n > MAX_BOBINA_KG) warnings.push(`Salida bobina ${idx + 1} fuera de rango (${n.toFixed(2)} Kg).`)
    })
    if (Math.abs(mermaCalcRaw) > Math.max(5000, pedidoTotalKg * 5)) {
      warnings.push(`Merma atípica (${mermaCalcRaw.toFixed(2)} Kg). Revise entradas/salidas/devoluciones.`)
    }
    if (pedidoTotalKg > 0 && producidoAcumuladoKg > pedidoTotalKg + 0.01) {
      warnings.push(
        `Producido acumulado (${producidoAcumuladoKg.toFixed(2)} Kg) supera el pedido (${pedidoTotalKg.toFixed(2)} Kg). Verifique unidades o captura.`,
      )
    }
    return warnings
  }, [
    totalEntradaTurnoActual,
    devolucionBuena,
    devolucionRechazada,
    form.impMetrajeProduccion,
    entradaBobinas,
    salidaBobinas,
    mermaCalcRaw,
    pedidoTotalKg,
    producidoAcumuladoKg,
  ])

  const persistPrintingForm = useCallback(
    async (srcBase?: Record<string, unknown>) => {
      const src = srcBase ?? form
      if (!Number.isFinite(workOrderId) || workOrderId < 1) return

      const act = parsePrintingTurnoActual(src[IMP_ACTUAL_KEY])
      if (act) {
        const operador = act.operador.trim()
        const turno = act.turno
        const grupo = act.grupo
        if (!operador || !turno || !grupo) {
          toast.error("Impresión: complete turno, grupo y operador antes de guardar.")
          return
        }
      }

      const rechKgValidar = act
        ? toFiniteOrNull(act.devolucionRechazadaKg) ?? 0
        : toFiniteOrNull(src.impDevolucionRechazadaKg) ?? 0
      const motivoRechValidar = act
        ? readString(act.devolucionRechazadaMotivo).trim()
        : readString(src.impDevolucionRechazadaMotivo).trim()
      if (rechKgValidar > 0 && !motivoRechValidar) {
        toast.error("Devolución rechazada: indique un motivo antes de guardar.")
        return
      }

      if (outlierWarnings.length > 0) {
        toast.warning(`Se detectaron ${outlierWarnings.length} valores atípicos. Se guardará de todas formas.`)
      }

      const eb = getNumericSeries(src, "impEntradaBobinasKg", 26)
      const sb = getNumericSeries(src, "impSalidaBobinasKg", 22)
      const em = getMetaSeries(src, "impEntradaBobinasMeta", 26)
      const sm = getMetaSeries(src, "impSalidaBobinasMeta", 22)

      const closedP = parsePrintingTurnos(src[IMP_TURNOS_KEY])
      const actualP = parsePrintingTurnoActual(src[IMP_ACTUAL_KEY])
      const accFromJson = accumulatePrintingFromJson(closedP, actualP)

      const normalizedForm: Record<string, unknown> = {
        ...src,
        [IMP_TURNOS_KEY]: closedP,
        [IMP_ACTUAL_KEY]: actualP,
        [IMP_ESTADO_KEY]: readEstadoArea(src[IMP_ESTADO_KEY]),
        impEntradaBobinasKg: eb.map((v) => normalizeNumericString(v)),
        impSalidaBobinasKg: sb.map((v) => normalizeNumericString(v)),
        impEntradaBobinasMeta: em.map((m) => normalizeBobinaLabelMeta(m)),
        impSalidaBobinasMeta: sm.map((m) => normalizeBobinaLabelMeta(m)),
        impDevolucionBuenaKg: normalizeNumericString(src.impDevolucionBuenaKg),
        impDevolucionRechazadaKg: normalizeNumericString(src.impDevolucionRechazadaKg),
        impMetrajeProduccion: normalizeNumericString(src.impMetrajeProduccion),
        impScrapTransparenteKg: normalizeNumericString(src.impScrapTransparenteKg),
        impScrapImpresoKg: normalizeNumericString(src.impScrapImpresoKg),
        impScrapImpresoDestino: (() => {
          const d = readString(src.impScrapImpresoDestino).toLowerCase()
          if (d === "transparente") return "transparente"
          if (d === "bopp") return "bopp"
          return ""
        })(),
        impScrapAcumuladoKg: normalizeNumericString(accFromJson.scrapKg),
        impMermaKg: normalizeNumericString(src.impMermaKg),
        impTimerEffectiveAccSec: normalizeNumericString(src.impTimerEffectiveAccSec),
        impTimerDeadAccSec: normalizeNumericString(src.impTimerDeadAccSec),
        impRegistrosTurnos: String(accFromJson.turnosCerrados),
        impAcumuladoProducidoKg: normalizeNumericString(accFromJson.producidoKg),
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
            notify_on_production_save: true,
          }),
        })
        toast.success("Control de impresión guardado.")
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo guardar control de impresión.")
      } finally {
        setSaving(false)
      }
    },
    [form, outlierWarnings.length, workOrderId],
  )

  // Wrapper estable para intervalos.
  const persistPrintingFormCb = useCallback((srcBase?: Record<string, unknown>) => {
    void persistPrintingForm(srcBase)
  }, [persistPrintingForm])

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
      persistPrintingFormCb(form)
    }, 60000)
    return () => window.clearInterval(id)
  }, [timerRunning, controlReadOnly, saving, persistPrintingFormCb, form])

  function startProductionTimer() {
    if (!hasActiveTurno || controlReadOnly) return
    setStartTimerConfirmOpen(true)
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
        lastResumeAtMs: now,
        pauseAtMs: 0,
      },
    }
    patchActiveTurn(() => nextTurn)
    setStartTimerConfirmOpen(false)
    void persistPrintingForm({
      ...form,
      [IMP_ACTUAL_KEY]: nextTurn,
      ...printingTurnoToMirror(nextTurn),
    })
  }

  function pauseProductionTimer() {
    if (!timerRunning || controlReadOnly) return
    const now = Date.now()
    const cur = activeTurno
    if (!cur) return
    if (cur.timer.state !== "running") return
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
    patchActiveTurn(() => nextTurn)
    void persistPrintingForm({
      ...form,
      [IMP_ACTUAL_KEY]: nextTurn,
      ...printingTurnoToMirror(nextTurn),
    })
    setPauseMotivoModalOpen(true)
  }

  function confirmPauseAndResume() {
    if (!timerPaused || !pauseReason) {
      toast.error("Seleccione el motivo de parada.")
      return
    }
    const now = Date.now()
    const pauseDurationSec = pauseAt > 0 ? (now - pauseAt) / 1000 : 0
    const cur = activeTurno
    if (!cur) return
    const nextTurn: PrintingTurnoEntry = {
      ...cur,
      timer: {
        ...cur.timer,
        state: "running",
        deadAccSec: cur.timer.deadAccSec + pauseDurationSec,
        pauseAtMs: 0,
        lastResumeAtMs: now,
        pauses: [
          ...cur.timer.pauses,
          {
            at: new Date(now).toISOString(),
            reason: pauseReason,
            obs: pauseObs.trim(),
            duration_sec: pauseDurationSec,
          },
        ],
      },
    }
    patchActiveTurn(() => nextTurn)
    setPauseReason("")
    setPauseObs("")
    setPauseMotivoModalOpen(false)
    void persistPrintingForm({
      ...form,
      [IMP_ACTUAL_KEY]: nextTurn,
      ...printingTurnoToMirror(nextTurn),
    })
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
    setForm((prev) => ({
      ...prev,
      [IMP_ACTUAL_KEY]: turnoWithPeople,
      ...printingTurnoToMirror(turnoWithPeople),
      [IMP_TURNOS_KEY]: parsePrintingTurnos(prev[IMP_TURNOS_KEY]),
    }))
    setStartTurnConfirmOpen(false)
    toast.success("Turno iniciado. Use Guardar para persistir en el servidor.")
  }

  function cerrarTurnoActual() {
    if (controlReadOnly) return
    const cur = parsePrintingTurnoActual(form[IMP_ACTUAL_KEY])
    if (!cur) return
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador.")
      return
    }
    const rechCierre = toFiniteOrNull(cur.devolucionRechazadaKg) ?? 0
    if (rechCierre > 0 && !readString(cur.devolucionRechazadaMotivo).trim()) {
      toast.error("Devolución rechazada: indique un motivo antes de cerrar el turno.")
      return
    }
    const finalizedTimer = finalizeTurnTimerNow(cur.timer)
    if (
      finalizedTimer.effectiveAccSec < 0.01 &&
      sumSalidaKg(cur) === 0 &&
      sumEntradaKg(cur) === 0
    ) {
      const ok = window.confirm(
        "El turno no registra tiempo efectivo ni producción. ¿Desea cerrarlo igual?",
      )
      if (!ok) return
    }
    const u = getStoredUser()
    const closed: PrintingTurnoEntry = {
      ...cur,
      timer: finalizedTimer,
      closed_at: new Date().toISOString(),
      closed_by: u ? { id: u.id, name: u.name } : null,
    }
    setForm((prev) => ({
      ...prev,
      [IMP_TURNOS_KEY]: [...parsePrintingTurnos(prev[IMP_TURNOS_KEY]), closed],
      [IMP_ACTUAL_KEY]: null,
      ...clearPrintingMirrorKeys(),
    }))
    toast.success("Turno cerrado. Puede iniciar otro turno cuando corresponda.")
  }

  async function finalizarAreaImpresion() {
    if (!canFinalizeOrder) return
    const prev = form
    let turnos = parsePrintingTurnos(prev[IMP_TURNOS_KEY])
    const cur = parsePrintingTurnoActual(prev[IMP_ACTUAL_KEY])
    const u = getStoredUser()
    if (cur) {
      const rechFin = toFiniteOrNull(cur.devolucionRechazadaKg) ?? 0
      if (rechFin > 0 && !readString(cur.devolucionRechazadaMotivo).trim()) {
        toast.error("Devolución rechazada: indique un motivo antes de finalizar el área.")
        return
      }
      const closed: PrintingTurnoEntry = {
        ...cur,
        timer: finalizeTurnTimerNow(cur.timer),
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
      }
      turnos = [...turnos, closed]
    }
    const nextForm: Record<string, unknown> = {
      ...prev,
      [IMP_TURNOS_KEY]: turnos,
      [IMP_ACTUAL_KEY]: null,
      [IMP_ESTADO_KEY]: "finalizada",
      ...clearPrintingMirrorKeys(),
    }
    setForm(nextForm)
    await persistPrintingForm(nextForm)
    toast.success("Área de impresión finalizada.")
  }

  function openLabelEditor(mode: "entrada" | "salida", idx: number) {
    const meta = mode === "entrada" ? entradaBobinasMeta[idx] : salidaBobinasMeta[idx]
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
    const normalized = normalizeBobinaLabelMeta(labelEditorDraft)
    const hasAnyValue = Object.values(normalized).some((v) => v !== "")
    const fechaPattern = /^\d{2}\/\d{2}\/\d{4}$/
    if (hasAnyValue && !fechaPattern.test(normalized.fecha)) {
      setLabelEditorError("Fecha obligatoria con formato dd/mm/aaaa.")
      return
    }

    const size = labelEditorMode === "entrada" ? 26 : 22
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
      return { ...t, salidaBobinasMeta: next.slice(0, size) }
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

  function openReturnModal() {
    setReturnDraft({
      buenaMaterialId: "",
      buenaKg: normalizeNumericString(form.impDevolucionBuenaKg),
      rechazadaMaterialId: "",
      rechazadaKg: normalizeNumericString(form.impDevolucionRechazadaKg),
      rechazadaMotivo: readString(form.impDevolucionRechazadaMotivo),
      rechazadaObs: "",
      bobinaCode: "",
    })
    setReturnModalOpen(true)
    void loadReturnMaterials("material")
    void loadReturnMaterials("bobinas_rechazadas")
  }

  async function submitReturn() {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return

    const buenaKg = Number(readString(returnDraft.buenaKg).trim().replace(",", "."))
    const rechKg = Number(readString(returnDraft.rechazadaKg).trim().replace(",", "."))
    const hasBuena = Number.isFinite(buenaKg) && buenaKg > 0
    const hasRech = Number.isFinite(rechKg) && rechKg > 0
    if (!hasBuena && !hasRech) {
      toast.error("Indique Kg en devolución buena y/o rechazada.")
      return
    }

    const buenaMaterialId = Number(returnDraft.buenaMaterialId)
    const rechMaterialId = Number(returnDraft.rechazadaMaterialId)
    if (hasBuena && (!Number.isFinite(buenaMaterialId) || buenaMaterialId < 1)) {
      toast.error("Seleccione el material de la devolución buena.")
      return
    }
    if (hasRech && (!Number.isFinite(rechMaterialId) || rechMaterialId < 1)) {
      toast.error("Seleccione el material de la devolución rechazada.")
      return
    }
    if (hasRech && !returnDraft.rechazadaMotivo.trim()) {
      toast.error("Seleccione un motivo para la devolución rechazada.")
      return
    }

    const bobinaRef = returnDraft.bobinaCode.trim()
    const rejectReasonLabel =
      PRINTING_REJECT_REASONS.find((r) => r.id === returnDraft.rechazadaMotivo)?.label ??
      returnDraft.rechazadaMotivo.trim()
    const rejectObs = returnDraft.rechazadaObs.trim()

    setReturnSubmitting(true)
    try {
      const createdIds: number[] = []
      let createdBuenaId: number | null = null
      let createdRechId: number | null = null

      if (hasBuena) {
        const created = await apiFetch<InventoryReturnCreated>("inventory-returns", {
          method: "POST",
          body: JSON.stringify({
            material_id: buenaMaterialId,
            work_order_id: null,
            destination_area: "material",
            quantity: buenaKg.toFixed(3),
            reason: bobinaRef ? `Bobina/Ref: ${bobinaRef}` : null,
          }),
        })
        createdBuenaId = created.id
        createdIds.push(created.id)
      }

      if (hasRech) {
        const reasonParts = [`Motivo: ${rejectReasonLabel}`]
        if (rejectObs) reasonParts.push(`Obs: ${rejectObs}`)
        if (bobinaRef) reasonParts.push(`Bobina/Ref: ${bobinaRef}`)
        const created = await apiFetch<InventoryReturnCreated>("inventory-returns", {
          method: "POST",
          body: JSON.stringify({
            material_id: rechMaterialId,
            work_order_id: workOrderId,
            destination_area: "bobinas_rechazadas",
            quantity: rechKg.toFixed(3),
            reason: reasonParts.join(" · "),
          }),
        })
        createdRechId = created.id
        createdIds.push(created.id)
      }

      const titleBase = readString(prefill.code) || `OT-${workOrderId}`
      const bodyLines = [
        `Origen: Impresión`,
        `OT: ${titleBase}`,
        hasBuena ? `Devolución buena: ${buenaKg.toFixed(3)} Kg (return_id=${createdBuenaId ?? "—"})` : null,
        hasRech
          ? `Devolución rechazada: ${rechKg.toFixed(3)} Kg · Motivo: ${rejectReasonLabel} (return_id=${createdRechId ?? "—"})`
          : null,
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
                  impDevolucionRechazadaMotivo: returnDraft.rechazadaMotivo.trim(),
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
          devolucionRechazadaMotivo: hasRech
            ? returnDraft.rechazadaMotivo.trim()
            : cur.devolucionRechazadaMotivo,
        }
        return {
          ...prev,
          [IMP_ACTUAL_KEY]: nextTurn,
          ...printingTurnoToMirror(nextTurn),
          impDevolucionesAlmacenUltimoEnvioMs: Date.now(),
          impDevolucionesAlmacenSnapBuena: normalizeNumericString(nextTurn.devolucionBuenaKg),
          impDevolucionesAlmacenSnapRech: normalizeNumericString(nextTurn.devolucionRechazadaKg),
        }
      }
      setForm((prev) => patchDev(prev))
      setReturnModalOpen(false)
      toast.success("Solicitud enviada a almacén. Devoluciones registradas.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la devolución / solicitud.")
    } finally {
      setReturnSubmitting(false)
    }
  }

  async function guardar() {
    await persistPrintingForm()
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
      [IMP_TURNOS_KEY]: [],
      [IMP_ACTUAL_KEY]: null,
      ...clearPrintingMirrorKeys(),
    }
    for (const k of Object.keys(cleared)) {
      if (k.startsWith("impBlockDone.")) delete cleared[k]
    }

    clearLocalPrintingDrafts(workOrderId)
    setForm(bootstrapPrintingFormState(cleared))
    toast.success("Impresión reiniciada localmente. Guardando en el servidor…")
    await persistPrintingForm(cleared)
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de impresión…</p>

  return (
    <div className="space-y-4">
      <WorkOrderStageBadge current="produccion" />
      {hasActiveTurno && !readOnlyOps && !canEditByControl ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">Turno en control de otro usuario</div>
              <div className="text-amber-950/80">
                Control actual: <span className="font-semibold">{activeOwnerName ?? "—"}</span>
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
        totalScrap={totalScrapAcumulado}
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
        impTurno={readString(form.impTurno)}
        impGrupo={readString(form.impGrupo)}
        impOperador={readString(form.impOperador)}
        impAyudante={readString(form.impAyudante)}
        impSupervisor={readString(form.impSupervisor)}
        entradaBobinas={entradaBobinas}
        entradaMeta={entradaBobinasMeta}
        devolucionBuenaRaw={readNumberString(form.impDevolucionBuenaKg)}
        devolucionRechazadaRaw={readNumberString(form.impDevolucionRechazadaKg)}
        devolucionRechazadaMotivoRaw={readString(form.impDevolucionRechazadaMotivo)}
        salidaBobinas={salidaBobinas}
        salidaMeta={salidaBobinasMeta}
        mermaCalc={mermaCalc}
        mermaRaw={readNumberString(form.impMermaKg)}
        metrajeRaw={readNumberString(form.impMetrajeProduccion)}
        scrapTransparenteRaw={readNumberString(form.impScrapTransparenteKg)}
        scrapImpresoRaw={readNumberString(form.impScrapImpresoKg)}
        scrapImpresoDestino={(() => {
          const d = readString(form.impScrapImpresoDestino).toLowerCase()
          if (d === "transparente") return "transparente"
          if (d === "bopp") return "bopp"
          return "auto"
        })()}
        onSetScrapImpresoDestino={(v) =>
          setForm((prev) => ({
            ...prev,
            impScrapImpresoDestino: v === "auto" ? "" : v,
          }))
        }
        devolucionBuena={devolucionBuena}
        devolucionRechazada={devolucionRechazada}
        materialConsumido={materialConsumido}
        totalSalida={totalSalida}
        refilPct={refilPct}
        formatTimerHms={formatTimerHms}
        setPauseReason={setPauseReason}
        setPauseObs={setPauseObs}
        startProductionTimer={startProductionTimer}
        pauseProductionTimer={pauseProductionTimer}
        confirmPauseAndResume={confirmPauseAndResume}
        hasActiveTurno={hasActiveTurno}
        areaFinalizada={areaFinalizada}
        readOnlyOps={controlReadOnly}
        canFinalizeOrder={canFinalizeOrder}
        draftTurno={draftTurno}
        draftGrupo={draftGrupo}
        draftPeople={draftPeople}
        draftOperadorMissing={draftOperadorMissing}
        onDraftTurno={setDraftTurno}
        onDraftGrupo={setDraftGrupo}
        onDraftPeopleAdd={addDraftPerson}
        onDraftPeopleRemove={removeDraftPerson}
        onDraftPeopleUpdate={updateDraftPerson}
        onIniciarTurno={requestIniciarTurno}
        onCerrarTurnoActual={cerrarTurnoActual}
        onFinalizarAreaImpresion={() => void finalizarAreaImpresion()}
        closedTurnos={closedTurnos}
        onSetTurno={(v) => patchActiveTurn((t) => ({ ...t, turno: v }))}
        onSetGrupo={(v) => patchActiveTurn((t) => ({ ...t, grupo: v }))}
        onSetOperador={(v) => patchActiveTurn((t) => ({ ...t, operador: v }))}
        onSetAyudante={(v) => patchActiveTurn((t) => ({ ...t, ayudante: v }))}
        onSetSupervisor={(v) => patchActiveTurn((t) => ({ ...t, supervisor: v }))}
        onEntradaChange={(idx, v) =>
          patchActiveTurn((t) => {
            const next = [...t.entradaBobinasKg]
            next[idx] = v
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
            return {
              ...t,
              devolucionRechazadaKg: v,
              devolucionRechazadaMotivo: rechZero ? "" : t.devolucionRechazadaMotivo,
            }
          })
        }
        onSetDevolucionRechazadaMotivo={(v) =>
          patchActiveTurn((t) => ({ ...t, devolucionRechazadaMotivo: v }))
        }
        onOpenReturnModal={openReturnModal}
        onSalidaChange={(idx, v) =>
          patchActiveTurn((t) => {
            const next = [...t.salidaBobinasKg]
            next[idx] = v
            return { ...t, salidaBobinasKg: next }
          })
        }
        onOpenSalidaLabel={(idx) => openLabelEditor("salida", idx)}
        onSetMerma={(v) => patchActiveTurn((t) => ({ ...t, mermaKg: v }))}
        onSetMetraje={(v) => patchActiveTurn((t) => ({ ...t, metrajeProduccion: v }))}
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
        onPreviewTimerReport={openTimerReportPreview}
        canPreviewDesperdicioReport={canPreviewDesperdicioReport}
        onPreviewDesperdicioReport={openDesperdicioPreview}
        canResetAll={!saving && !controlReadOnly}
        onResetAll={requestResetAll}
        devolucionesPendienteAlmacen={devolucionesPendienteAlmacen}
      />

      {(() => {
        const doneObs = !!readString(form.impObservaciones).trim()
        return (
          <div
            className={[
              "rounded-lg border p-3",
              doneObs ? "border-emerald-300 bg-emerald-50/40" : "bg-card",
            ].join(" ")}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">Observaciones del turno</div>
                {doneObs ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    Completo
                  </span>
                ) : null}
              </div>
            </div>
        <Textarea
          value={readString(form.impObservaciones)}
          onChange={(e) => {
            if (!hasActiveTurno || controlReadOnly) return
            patchActiveTurn((t) => ({ ...t, observaciones: e.target.value }))
          }}
          placeholder={hasActiveTurno ? "Observaciones adicionales..." : "Inicie un turno para registrar observaciones."}
          disabled={controlReadOnly || !hasActiveTurno}
        />
          </div>
        )
      })()}

      <div className="no-print mb-12 flex justify-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={() => void guardar()} disabled={saving || controlReadOnly}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <AlertDialog open={startTimerConfirmOpen} onOpenChange={setStartTimerConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar producción (Impresión)</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            ¿Está seguro? Una vez inicializado, empieza el proceso de producción de impresión y el cronómetro comenzará a correr.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmStartProductionTimer()}>
              Sí, iniciar producción
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar impresión (OT)</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Esto borrará turnos, temporizador, entradas/salidas/scrap/merma/metraje registrados en Impresión para
            esta OT. También limpia el respaldo local del navegador. ¿Desea continuar?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmResetAll()}>
              Sí, reiniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={takeoverConfirmOpen} onOpenChange={setTakeoverConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tomar control del turno</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Este turno está siendo gestionado por{" "}
            <span className="font-semibold text-foreground">{activeOwnerName ?? "otro usuario"}</span>. ¿Desea tomar el control para editar?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmTakeover()}>Tomar control</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={returnModalOpen}
        onOpenChange={(open) => {
          if (!returnSubmitting) setReturnModalOpen(open)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Devolución del turno (Impresión → Almacén)</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">OT preseleccionada</span>{" "}
              <span className="font-semibold">{readString(prefill.code) || `OT-${workOrderId}`}</span>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Referencia</div>
                  <div className="text-xs text-muted-foreground">Opcional</div>
                </div>
                <div className="space-y-1">
                  <Label>Bobina / referencia</Label>
                  <Input
                    value={returnDraft.bobinaCode}
                    onChange={(e) => setReturnDraft((prev) => ({ ...prev, bobinaCode: e.target.value }))}
                    placeholder="Código de bobina, etiqueta o lote"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-emerald-900">Devolución buena</div>
                  <div className="text-xs text-emerald-900/70">Reingresa a inventario</div>
                </div>
                <div className="grid gap-2">
                  <div className="space-y-1">
                    <Label>Cantidad (Kg)</Label>
                    <Input
                      inputMode="decimal"
                      value={returnDraft.buenaKg}
                      onChange={(e) => setReturnDraft((prev) => ({ ...prev, buenaKg: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Material</Label>
                    <select
                      className="ot-select h-9"
                      value={returnDraft.buenaMaterialId}
                      onChange={(e) => setReturnDraft((prev) => ({ ...prev, buenaMaterialId: e.target.value }))}
                      disabled={returnLoadingMaterialsGood}
                    >
                      <option value="">
                        {returnLoadingMaterialsGood ? "Cargando materiales..." : "Seleccione material"}
                      </option>
                      {returnMaterialOptionsGood.map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.sku} · {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-rose-200/70 bg-rose-50/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-rose-900">Devolución rechazada</div>
                  <div className="text-xs text-rose-900/70">Queda en rechazadas</div>
                </div>
                <div className="grid gap-2">
                  <div className="space-y-1">
                    <Label>Cantidad (Kg)</Label>
                    <Input
                      inputMode="decimal"
                      value={returnDraft.rechazadaKg}
                      onChange={(e) => setReturnDraft((prev) => ({ ...prev, rechazadaKg: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Material (rechazadas)</Label>
                    <select
                      className="ot-select h-9"
                      value={returnDraft.rechazadaMaterialId}
                      onChange={(e) => setReturnDraft((prev) => ({ ...prev, rechazadaMaterialId: e.target.value }))}
                      disabled={returnLoadingMaterialsBad}
                    >
                      <option value="">
                        {returnLoadingMaterialsBad ? "Cargando materiales..." : "Seleccione material"}
                      </option>
                      {returnMaterialOptionsBad.map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.sku} · {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Motivo (obligatorio)</Label>
                    <select
                      className="ot-select h-9"
                      value={returnDraft.rechazadaMotivo}
                      onChange={(e) => setReturnDraft((prev) => ({ ...prev, rechazadaMotivo: e.target.value }))}
                    >
                      <option value="">Seleccione motivo</option>
                      {PRINTING_REJECT_REASONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Observación (opcional)</Label>
                    <Textarea
                      value={returnDraft.rechazadaObs}
                      onChange={(e) => setReturnDraft((prev) => ({ ...prev, rechazadaObs: e.target.value }))}
                      placeholder="Detalle adicional (si aplica)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            <div className="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturnModalOpen(false)}
                disabled={returnSubmitting}
                className="sm:min-w-40"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void submitReturn()}
                disabled={returnSubmitting}
                className="sm:min-w-56"
              >
                {returnSubmitting ? "Enviando..." : "Enviar a almacén"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startTurnConfirmOpen} onOpenChange={setStartTurnConfirmOpen}>
        <DialogContent className="border-violet-200/70 bg-gradient-to-b from-violet-50/50 to-background sm:max-w-md">
          <DialogHeader className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-100/80 text-violet-700">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-2">
                <DialogTitle className="text-xl">Activar turno de impresión</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Confirme para habilitar el temporizador, el registro de bobinas y el resumen operativo del turno en curso.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setStartTurnConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => confirmIniciarTurno()}>
              Confirmar e iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
