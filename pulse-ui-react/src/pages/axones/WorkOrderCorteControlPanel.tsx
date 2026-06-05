"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { FileSearch, Save, Scissors } from "lucide-react"
import { toast } from "sonner"

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
import { appAbsoluteUrl } from "@/lib/app-base-path"
import { openCortePlanillaPreviewFromSource } from "@/lib/corte-planilla-preview"
import {
  MesGuardarChoiceDialog,
  MES_GUARDAR_AREA_LABELS,
  mesGuardarChoiceHint,
} from "@/components/axones/mes"
import { Button } from "@/components/ui/button"
import { apiFetch, ApiError } from "@/lib/api"
import { navigateToMesBandeja } from "@/lib/mes-bandeja-navigation"

type CorteDispatchSyncStatus = {
  material_resolved: boolean
  closed_paletas_with_kg: number
  usages_synced: number
  provisional_paletas_with_kg?: number
  provisional_synced?: number
}

type CorteControlPatchResponse = {
  dispatch_sync?: CorteDispatchSyncStatus
}

/** Mensaje persistente si el último guardado no sincronizó todo a Despacho. */
export function corteDispatchSyncIssueMessage(
  dispatchSync?: CorteDispatchSyncStatus,
): string | null {
  if (!dispatchSync) return null
  const {
    material_resolved,
    closed_paletas_with_kg,
    usages_synced,
    provisional_paletas_with_kg = 0,
    provisional_synced = 0,
  } = dispatchSync

  const needsMaterial =
    (closed_paletas_with_kg > 0 || provisional_paletas_with_kg > 0) && !material_resolved
  if (needsMaterial) {
    return "No se sincronizó a Despacho: la OT no tiene material asociado (líneas, pedido o producto). Asigne material en la OT o registre pesos y guarde de nuevo."
  }
  if (closed_paletas_with_kg > usages_synced) {
    return "Algunas paletas cerradas no se reflejaron en Despacho. Verifique material en la OT y guarde de nuevo."
  }
  if (provisional_paletas_with_kg > provisional_synced) {
    return "Algunas paletas en progreso no se reflejaron como saldo provisional en Despacho. Guarde de nuevo."
  }
  return null
}

/**
 * Guardar / cerrar paleta no finaliza corEstadoArea; avisa si el sync a despacho falló.
 */
/** Solo avisos de error al guardar; el saldo en Despacho no dispara toast automático de éxito. */
function warnCorteDispatchSync(dispatchSync?: CorteDispatchSyncStatus): void {
  if (!dispatchSync) return
  const issue = corteDispatchSyncIssueMessage(dispatchSync)
  if (!issue) return
  const needsMaterial =
    (dispatchSync.closed_paletas_with_kg > 0 ||
      (dispatchSync.provisional_paletas_with_kg ?? 0) > 0) &&
    !dispatchSync.material_resolved
  if (needsMaterial) toast.error(issue)
  else toast.warning(issue)
}
import { applyMesPhaseConfirmToTimer } from "@/lib/mes-multi-phase-timer-exec"
import { cumulativeArranqueSeconds, cumulativeDemountSeconds } from "@/lib/mes-phase-timer-fields"
import {
  cumulativeDeadSeconds,
  cumulativeEffectiveSeconds,
  cumulativeTotalPersistedSeconds,
  formatHoraArranqueFromMs,
  horaArranqueMsFromTimer,
} from "@/lib/mes-timer-band-shared"
import {
  buildMesTimerActionFlags,
  getMesTimerConfirm,
  mesTimerConfirmNeedsActiveTurno,
  type MesTimerConfirmKey,
} from "@/pages/axones/mes-timer-actions"
import { getStoredUser } from "@/lib/auth-storage"
import { withCorteAutoFields } from "@/lib/corte-planilla-metrics"
import { filterCorteControlForm } from "@/lib/corte-control-keys"
import {
  deriveCorteOperativoEstado,
  CORTE_CONTROL_SAVED_EVENT,
} from "@/lib/corte-mes-band-status"
import { MesOperativoEstadoCard } from "@/components/axones/mes"
import {
  canSaveProductionAreaForm,
  hasProductionTimerStarted,
  mesTimerFieldsFromForm,
  MES_PRODUCTION_SAVE_CONFIG,
  MES_SAVE_BLOCKED_MESSAGE,
} from "@/lib/mes-timer-guards"
import {
  bootstrapCorteFormState,
  clearCorteMirrorKeys,
  corteTurnoToMirror,
  COR_ACTUAL_KEY,
  COR_ENTRADA_META_KEY,
  COR_ENTRADA_SLOTS,
  COR_ESTADO_KEY,
  COR_TURNOS_KEY,
  corteAggregatedTimerMirrorFromTurnos,
  finalizeTurnTimerNow,
  materializeOpenCorteTurnoActual,
  parseCorteTurnoActual,
  parseCorteTurnos,
  readCorteEstadoArea,
  resolveCorteDisplayTimer,
  snapshotCorteTurnMetrics,
  accumulateCorteFromJson,
  formatTimerHms,
  pauseCorteProductionTimerOnForm,
  startCorteProductionTimerOnForm,
  type CortePauseEntry,
  type CorteTurnTimer,
  sanitizeCorEntradaBobinasKg,
  isCorPaletaCerrada,
  autoClosePaletasWithKgForTurnEnd,
  buildCorPaletasPersistedAfterTurnClose,
  getCorPaletas,
  resolveCorPaletasForSave,
  sumEntradaKgFromForm,
  sumSalidaKgFromOpenPaletas,
  sumSalidaKgFromPaletas,
  sumSalidaKgFromForm,
  syncCorteFormMetrics,
  syncCorteSalidaFields,
  type CorteTurnoEntry,
} from "./corte-turnos"
import { getMetaSeries } from "./laminacion-turnos"
import { stringsFromActivePersonnel, type DraftPerson } from "./WorkOrderMontajeOpsSection"
import WorkOrderCorteOpsSection from "./WorkOrderCorteOpsSection"
import { WindingFigurePicker } from "./WindingFigurePicker"
import "./work-order-planilla.css"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function readNumberString(v: unknown): string {
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v
  return ""
}

function normalizeNumericString(v: unknown): string {
  const raw = readNumberString(v).trim().replace(",", ".")
  if (!raw) return ""
  const n = Number(raw)
  return Number.isFinite(n) ? String(n) : ""
}

function mergePrefill(prefill: Record<string, unknown>, form?: Record<string, unknown> | null) {
  return { ...prefill, ...(form ?? {}) }
}

export default function WorkOrderCorteControlPanel({
  workOrderId,
  canFinalizeOrder = false,
}: {
  workOrderId: number
  canFinalizeOrder?: boolean
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [guardarChoiceOpen, setGuardarChoiceOpen] = useState(false)
  const [closeTurnConfirmOpen, setCloseTurnConfirmOpen] = useState(false)
  const [finalizeAreaConfirmOpen, setFinalizeAreaConfirmOpen] = useState(false)
  const [pauseMotivoModalOpen, setPauseMotivoModalOpen] = useState(false)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [timerConfirm, setTimerConfirm] = useState<MesTimerConfirmKey | null>(null)
  const [previewTimerConfirmOpen, setPreviewTimerConfirmOpen] = useState(false)
  const [timerTick, setTimerTick] = useState(0)
  const wasTimerPausedRef = useRef(false)
  const [dispatchSyncAlert, setDispatchSyncAlert] = useState<string | null>(null)
  const formRef = useRef(form)

  useEffect(() => {
    formRef.current = form
  }, [form])

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      const basePrefill = payload.prefill ?? {}
      setPrefill(basePrefill)
      const mergedForm = mergePrefill(basePrefill, payload.form)
      setForm(bootstrapCorteFormState(mergedForm))
      setDispatchSyncAlert(null)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT para corte.")
      setPrefill({})
      setForm({})
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  const pedidoTotalKg = readNumber(form.pedidoKg ?? prefill.pedidoKg)
  const areaEstado = readCorteEstadoArea(form[COR_ESTADO_KEY])
  const areaFinalizada = areaEstado === "finalizada"
  const canPreviewPlanillaReport = areaFinalizada
  const controlReadOnly = areaFinalizada && !canFinalizeOrder
  const activeTurno = useMemo(() => materializeOpenCorteTurnoActual(form), [form])
  const closedTurnos = useMemo(() => parseCorteTurnos(form[COR_TURNOS_KEY], form), [form])
  const activeTimer = useMemo(() => resolveCorteDisplayTimer(activeTurno, form), [activeTurno, form])
  const timerState = activeTimer.state || "pending"
  const arranqueState = readString(form.corTimerArranqueState) || "idle"
  const demountState = readString(form.corTimerDemountState) || "idle"
  const arranqueRunning = arranqueState === "running"
  const demountRunning = demountState === "running"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const hasActiveTurno = activeTurno !== null
  const nowMs = Date.now() + timerTick * 0
  const operativoEstado = useMemo(
    () => deriveCorteOperativoEstado(form, nowMs),
    [form, timerTick],
  )
  const jsonAccum = useMemo(
    () => accumulateCorteFromJson(closedTurnos, activeTurno, sumSalidaKgFromForm(form)),
    [closedTurnos, activeTurno, form],
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
  const otArranqueAccSec = useMemo(
    () => cumulativeArranqueSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const displayEffectiveSec = otEffectiveAccSec
  const displayDeadSec = otDeadAccSec
  const displayTotalSec = otTotalAccSec
  const displayDemountSec = otDemountAccSec
  const displayArranqueSec = otArranqueAccSec
  const producidoAcumuladoKg = jsonAccum.producidoKg
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
  const pauseEntries = useMemo<CortePauseEntry[]>(() => {
    const raw = form.corTimerPauses
    if (!Array.isArray(raw)) return []
    return raw
      .map((x) => x as Partial<CortePauseEntry>)
      .map((x) => ({
        at: readString(x.at),
        reason: readString(x.reason),
        obs: readString(x.obs),
        duration_sec: readNumber(x.duration_sec),
      }))
      .filter((x) => x.reason)
  }, [form.corTimerPauses])

  const timerEverStarted = useMemo(
    () => hasProductionTimerStarted(mesTimerFieldsFromForm(form, "cor")),
    [form],
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

  useEffect(() => {
    if (wasTimerPausedRef.current && !timerPaused) {
      setPauseMotivoModalOpen(false)
    }
    wasTimerPausedRef.current = timerPaused
  }, [timerPaused])

  useEffect(() => {
    if (!timerRunning && !timerPaused && !arranqueRunning && !demountRunning) return
    const id = window.setInterval(() => setTimerTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [timerPaused, timerRunning, arranqueRunning, demountRunning])

  const canSaveProduction = useMemo(() => {
    if (controlReadOnly) return false
    return canSaveProductionAreaForm(form, MES_PRODUCTION_SAVE_CONFIG.corte)
  }, [controlReadOnly, form])

  const canPersistShiftOpen = useMemo(() => {
    if (controlReadOnly) return false
    return hasActiveTurno
  }, [controlReadOnly, hasActiveTurno])

  const canClickGuardar = canSaveProduction || canPersistShiftOpen || areaFinalizada

  const canPersistBetweenShifts = useMemo(() => {
    if (controlReadOnly || areaFinalizada) return false
    if (hasActiveTurno) return false
    return closedTurnos.length > 0
  }, [areaFinalizada, closedTurnos.length, controlReadOnly, hasActiveTurno])

  const guardarHint = useMemo(
    () =>
      mesGuardarChoiceHint({
        areaLabel: MES_GUARDAR_AREA_LABELS.corte,
        controlReadOnly,
        hasActiveTurno,
        canSaveProduction,
        canPersistShiftOpen,
        canPersistBetweenShifts,
        closedTurnosCount: closedTurnos.length,
        blockedMessage: MES_SAVE_BLOCKED_MESSAGE,
      }),
    [
      areaFinalizada,
      canPersistBetweenShifts,
      canPersistShiftOpen,
      canSaveProduction,
      closedTurnos.length,
      controlReadOnly,
      hasActiveTurno,
    ],
  )

  const persistCorteForm = useCallback(
    async (
      srcBase?: Record<string, unknown>,
      options?: {
        skipProductionSaveGuard?: boolean
        notifyProductionSave?: boolean
        successMessage?: string
        suppressSuccessToast?: boolean
        /** Envía corTurnoActual: null al cerrar turno (no omitir la clave). */
        clearTurnoActual?: boolean
      },
    ): Promise<boolean> => {
      const rawForm = srcBase ?? formRef.current
      const paletasForSave = resolveCorPaletasForSave(rawForm)
      const src = withCorteAutoFields({
        ...rawForm,
        cor_paletas: paletasForSave,
        corSalidaPaletasKg: paletasForSave.map((p) => p.rollosKg),
      })
      if (!Number.isFinite(workOrderId) || workOrderId < 1) return false

      const notifyProductionSave = options?.notifyProductionSave !== false

      if (
        notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !canSaveProductionAreaForm(src, MES_PRODUCTION_SAVE_CONFIG.corte)
      ) {
        toast.error(MES_SAVE_BLOCKED_MESSAGE)
        return false
      }

      const finalizingArea = readCorteEstadoArea(src[COR_ESTADO_KEY]) === "finalizada"
      if (
        !finalizingArea &&
        !notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !parseCorteTurnoActual(src[COR_ACTUAL_KEY], src)
      ) {
        toast.error("Abra un turno de planta antes de guardar.")
        return false
      }

      let actualP = materializeOpenCorteTurnoActual(src)

      if (actualP) {
        if (!actualP.operador.trim() || !actualP.turno || !actualP.grupo) {
          toast.error("Corte: complete turno, grupo y operador antes de guardar.")
          return false
        }
        const entradaKg = sanitizeCorEntradaBobinasKg(
          src.corEntradaBobinasKg ?? actualP.entradaBobinasKg,
        )
        const entradaMeta = getMetaSeries(src, COR_ENTRADA_META_KEY, COR_ENTRADA_SLOTS)
        actualP = {
          ...actualP,
          paletas: paletasForSave,
          entradaBobinasKg: entradaKg,
          entradaBobinasMeta: entradaMeta,
          kgIngresados: sumEntradaKgFromForm({ ...src, corEntradaBobinasKg: entradaKg }).toFixed(2),
        }
      }
      const entradaForSave = sanitizeCorEntradaBobinasKg(src.corEntradaBobinasKg)
      const entradaMetaForSave = getMetaSeries(src, COR_ENTRADA_META_KEY, COR_ENTRADA_SLOTS)
      const salidaFields = syncCorteSalidaFields({
        ...src,
        cor_paletas: paletasForSave,
        corEntradaBobinasKg: entradaForSave,
      })

      const closedP = parseCorteTurnos(src[COR_TURNOS_KEY], src)
      const salidaActual = sumSalidaKgFromForm({ ...src, ...salidaFields })
      const accFromJson = accumulateCorteFromJson(closedP, actualP, salidaActual)
      const mirror = actualP ? corteTurnoToMirror(actualP) : {}

      const normalizedForm: Record<string, unknown> = {
        ...src,
        ...mirror,
        ...salidaFields,
        cor_paletas: paletasForSave,
        corSalidaPaletasKg: paletasForSave.map((p) => p.rollosKg),
        corEntradaBobinasKg: entradaForSave,
        [COR_ENTRADA_META_KEY]: entradaMetaForSave,
        [COR_TURNOS_KEY]: closedP,
        [COR_ESTADO_KEY]: readCorteEstadoArea(src[COR_ESTADO_KEY]),
        kgIngresadosCorte: normalizeNumericString(
          actualP?.kgIngresados ?? src.kgIngresadosCorte,
        ),
        kgSalidaCorte: normalizeNumericString(salidaFields.kgSalidaCorte),
        kgMermaCorte: normalizeNumericString(src.kgMermaCorte),
        metrajeCorte: normalizeNumericString(src.metrajeCorte),
        corScrapRefileKg: normalizeNumericString(src.corScrapRefileKg),
        corScrapImpresoKg: normalizeNumericString(src.corScrapImpresoKg),
        corScrapMalCorteKg: normalizeNumericString(src.corScrapMalCorteKg),
        corTimerEffectiveAccSec: normalizeNumericString(src.corTimerEffectiveAccSec),
        corTimerDeadAccSec: normalizeNumericString(src.corTimerDeadAccSec),
        corRegistrosTurnos: String(accFromJson.turnosRegistrados),
        corAcumuladoProducidoKg: normalizeNumericString(accFromJson.producidoKg),
      }

      if (actualP !== null) {
        normalizedForm[COR_ACTUAL_KEY] = actualP
      } else if (options?.clearTurnoActual) {
        Object.assign(normalizedForm, clearCorteMirrorKeys(), { [COR_ACTUAL_KEY]: null })
      }

      const corteOnlyForm = filterCorteControlForm(normalizedForm)

      setSaving(true)
      try {
        const res = await apiFetch<CorteControlPatchResponse>(
          `work-orders/${workOrderId}/orden-trabajo/corte-control`,
          {
            method: "PATCH",
            body: JSON.stringify({
              form: corteOnlyForm,
              origin_area: "corte",
              notify_on_production_save: notifyProductionSave && timerEverStarted,
            }),
          },
        )
        warnCorteDispatchSync(res.dispatch_sync)
        setDispatchSyncAlert(corteDispatchSyncIssueMessage(res.dispatch_sync))
        setForm((prev) => bootstrapCorteFormState({ ...prev, ...normalizedForm }))
        if (!options?.suppressSuccessToast) {
          toast.success(options?.successMessage ?? "Control de corte guardado.")
          const entradaKg = sumEntradaKgFromForm(normalizedForm)
          const provisionalKg = sumSalidaKgFromOpenPaletas(paletasForSave)
          if (provisionalKg > 0 && (res.dispatch_sync?.provisional_synced ?? 0) > 0) {
            toast.message(
              `Saldo provisional en Despacho: ${provisionalKg.toFixed(2)} kg (${res.dispatch_sync?.provisional_synced ?? 0} paleta(s)). Vuelva a Despacho · producto terminado.`,
              { duration: 9000 },
            )
          }
          if (entradaKg > 0 && salidaActual <= 0) {
            toast.message(
              "El ingreso de bobinas no genera saldo en Despacho. Registre kg en los rollos de «Bobinas de salida por paleta», pulse Guardar y, para la nota de entrega, Cerrar paleta.",
              { duration: 9000 },
            )
          }
        }
        window.dispatchEvent(
          new CustomEvent(CORTE_CONTROL_SAVED_EVENT, { detail: { workOrderId } }),
        )
        window.dispatchEvent(new Event("alerts:refresh"))
        return true
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo guardar control de corte.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [form, timerEverStarted, workOrderId],
  )

  const persistCorteFormCb = useCallback(
    (
      srcBase?: Record<string, unknown>,
      saveOptions?: Parameters<typeof persistCorteForm>[1],
    ) => persistCorteForm(srcBase, saveOptions),
    [persistCorteForm],
  )

  const patchActiveTurn = useCallback((updater: (t: CorteTurnoEntry) => CorteTurnoEntry) => {
    setForm((prev) => {
      const cur = materializeOpenCorteTurnoActual(prev)
      if (!cur) return prev
      const nextTurn = updater(cur)
      return {
        ...prev,
        [COR_ACTUAL_KEY]: nextTurn,
        ...corteTurnoToMirror(nextTurn),
        ...syncCorteFormMetrics({ ...prev, cor_paletas: nextTurn.paletas }),
      }
    })
  }, [])

  const applyCerrarTurno = useCallback(
    async (cur: CorteTurnoEntry) => {
      const finalizedTimer = finalizeTurnTimerNow(cur.timer)
      const u = getStoredUser()
      const paletasForClose = autoClosePaletasWithKgForTurnEnd(
        resolveCorPaletasForSave({ ...form, [COR_ACTUAL_KEY]: cur }),
      )
      const otPaletas = buildCorPaletasPersistedAfterTurnClose(paletasForClose, getCorPaletas(form))
      const closedCount = paletasForClose.filter(
        (p) => isCorPaletaCerrada(p) && sumSalidaKgFromPaletas([p]) > 0,
      ).length
      const closed: CorteTurnoEntry = {
        ...cur,
        timer: finalizedTimer,
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
        metrics: snapshotCorteTurnMetrics({
          ...form,
          cor_paletas: paletasForClose,
          corEntradaBobinasKg: cur.entradaBobinasKg,
          kgIngresadosCorte: sumEntradaKgFromForm({
            ...form,
            corEntradaBobinasKg: cur.entradaBobinasKg,
          }).toFixed(2),
          kgMermaCorte: cur.kgMerma || form.kgMermaCorte,
          metrajeCorte: cur.metraje || form.metrajeCorte,
          corObservaciones: cur.observaciones || form.corObservaciones,
        }),
        observaciones: readString(form.corObservaciones),
        paletas: paletasForClose,
        entradaBobinasKg: cur.entradaBobinasKg,
      }
      const turnosClosed = [...parseCorteTurnos(form[COR_TURNOS_KEY], form), closed]
      const nextForm: Record<string, unknown> = {
        ...form,
        [COR_TURNOS_KEY]: turnosClosed,
        [COR_ACTUAL_KEY]: null,
        corRegistrosTurnos: turnosClosed.length,
        ...clearCorteMirrorKeys(),
        cor_paletas: otPaletas,
        corSalidaPaletasKg: otPaletas.map((p) => p.rollosKg),
        ...corteAggregatedTimerMirrorFromTurnos(turnosClosed),
        ...syncCorteSalidaFields({ ...form, cor_paletas: otPaletas }),
      }
      setForm(bootstrapCorteFormState(nextForm))
      const ok = await persistCorteForm(nextForm, {
        skipProductionSaveGuard: true,
        notifyProductionSave: timerEverStarted,
        clearTurnoActual: true,
        successMessage: "Turno de planta cerrado y guardado. El formulario quedó en blanco para iniciar otro turno.",
        suppressSuccessToast: true,
      })
      if (ok) {
        toast.success(
          closedCount > 0
            ? `Turno cerrado. ${closedCount} paleta(s) listas en Despacho · producto terminado.`
            : "Turno de planta cerrado y guardado.",
        )
        navigateToMesBandeja(navigate, "corte", "produccion")
      }
    },
    [form, persistCorteForm, navigate, timerEverStarted],
  )

  const requestGuardar = useCallback(() => {
    if (saving || controlReadOnly) return
    if (!canClickGuardar) {
      toast.error(
        !hasActiveTurno && closedTurnos.length === 0
          ? "Abra un turno de planta antes de guardar."
          : MES_SAVE_BLOCKED_MESSAGE,
      )
      return
    }
    if (hasActiveTurno) {
      const cur = materializeOpenCorteTurnoActual(form)
      if (!cur?.operador.trim() || !cur.turno || !cur.grupo) {
        toast.error("Complete turno, grupo y operador antes de guardar.")
        return
      }
      setGuardarChoiceOpen(true)
      return
    }
    if (canPersistBetweenShifts) {
      setGuardarChoiceOpen(true)
      return
    }
    if (canFinalizeOrder && !areaFinalizada) {
      setGuardarChoiceOpen(true)
      return
    }
    toast.message("No hay turno abierto. Inicie un turno de planta o finalice el cierre de Corte si corresponde.")
  }, [
    areaFinalizada,
    canClickGuardar,
    canFinalizeOrder,
    canPersistBetweenShifts,
    closedTurnos.length,
    controlReadOnly,
    form,
    hasActiveTurno,
    saving,
  ])

  const handleGuardarSesion = useCallback(() => {
    void persistCorteForm(undefined, {
      skipProductionSaveGuard: !canSaveProduction && canPersistShiftOpen,
      notifyProductionSave: canSaveProduction && timerEverStarted,
      successMessage: "Control de corte guardado.",
    })
  }, [
    canPersistShiftOpen,
    canSaveProduction,
    persistCorteForm,
    timerEverStarted,
  ])

  const handleFinalizarTurnoFromGuardar = useCallback(() => {
    const cur = materializeOpenCorteTurnoActual(form)
    if (!cur) {
      toast.error("No hay turno de planta abierto.")
      return
    }
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador.")
      return
    }
    void applyCerrarTurno(cur)
  }, [applyCerrarTurno, form])

  async function finalizarAreaCorte() {
    if (!canFinalizeOrder) {
      toast.error("Solo jefatura puede finalizar el área de corte.")
      return
    }
    const prev = form
    let turnos = parseCorteTurnos(prev[COR_TURNOS_KEY], prev)
    const cur = parseCorteTurnoActual(prev[COR_ACTUAL_KEY], prev)
    const u = getStoredUser()
    let otPaletas = buildCorPaletasPersistedAfterTurnClose(
      autoClosePaletasWithKgForTurnEnd(getCorPaletas(prev)),
      getCorPaletas(prev),
    )
    if (cur) {
      const finalizedTimer = finalizeTurnTimerNow(cur.timer)
      const paletasForClose = autoClosePaletasWithKgForTurnEnd(
        resolveCorPaletasForSave({ ...prev, [COR_ACTUAL_KEY]: cur }),
      )
      otPaletas = buildCorPaletasPersistedAfterTurnClose(paletasForClose, getCorPaletas(prev))
      const closed: CorteTurnoEntry = {
        ...cur,
        timer: finalizedTimer,
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
        metrics: snapshotCorteTurnMetrics({
          ...prev,
          cor_paletas: paletasForClose,
          corEntradaBobinasKg: cur.entradaBobinasKg,
        }),
        paletas: paletasForClose,
        entradaBobinasKg: cur.entradaBobinasKg,
      }
      turnos = [...turnos, closed]
    }
    const nextForm: Record<string, unknown> = {
      ...prev,
      [COR_TURNOS_KEY]: turnos,
      [COR_ACTUAL_KEY]: null,
      [COR_ESTADO_KEY]: "finalizada",
      ...clearCorteMirrorKeys(),
      cor_paletas: otPaletas,
      corSalidaPaletasKg: otPaletas.map((p) => p.rollosKg),
      ...corteAggregatedTimerMirrorFromTurnos(turnos),
      ...syncCorteSalidaFields({ ...prev, cor_paletas: otPaletas }),
    }
    setForm(bootstrapCorteFormState(nextForm))
    const ok = await persistCorteForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      toast.success("Área de corte finalizada.")
      navigateToMesBandeja(navigate, "corte", "finalizadas")
    } else {
      toast.error("No se pudo finalizar el área de corte. Revise su conexión o permisos de jefatura.")
    }
  }

  /** Persiste turno + espejo plano para sincronizar corte_time_segments (reportes de planta). */
  function patchAndPersistTimer(
    updater: (timer: CorteTurnTimer) => CorteTurnTimer,
    successMessage?: string,
  ) {
    const cur = activeTurno
    if (!cur) return
    const nextTurn: CorteTurnoEntry = { ...cur, timer: updater(cur.timer) }
    const nextForm: Record<string, unknown> = {
      ...form,
      [COR_ACTUAL_KEY]: nextTurn,
      ...corteTurnoToMirror(nextTurn),
    }
    patchActiveTurn(() => nextTurn)
    void persistCorteForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      successMessage,
      suppressSuccessToast: !successMessage,
    })
  }

  function requestTimerConfirm(key: MesTimerConfirmKey) {
    if (controlReadOnly) return
    setTimerConfirm(key)
  }

  function executeTimerConfirm(key: MesTimerConfirmKey) {
    if (!mesTimerConfirmNeedsActiveTurno(key)) {
      setFinalizeAreaConfirmOpen(true)
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
        setCloseTurnConfirmOpen(true)
        break
      default:
        break
    }
  }

  function confirmStartProductionTimer() {
    if (!hasActiveTurno || controlReadOnly) return
    const nextBase = startCorteProductionTimerOnForm(form)
    if (!nextBase) return
    const nextTurn = materializeOpenCorteTurnoActual(nextBase)
    if (!nextTurn) return
    const nextForm: Record<string, unknown> = {
      ...nextBase,
      ...syncCorteFormMetrics({ ...nextBase, cor_paletas: nextTurn.paletas }),
    }
    setForm((prev) => ({
      ...prev,
      [COR_ACTUAL_KEY]: nextTurn,
      ...corteTurnoToMirror(nextTurn),
      ...syncCorteFormMetrics({ ...prev, cor_paletas: nextTurn.paletas }),
    }))
    void persistCorteForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    toast.message(
      "Producción iniciada. Los tiempos se reflejan en Reportes → Producción y tiempos (active «Incluir turnos en curso»).",
    )
  }

  function confirmResumeProductionAfterDeadTime() {
    if (!hasActiveTurno || controlReadOnly || !timerPaused) return
    const nextBase = startCorteProductionTimerOnForm(form)
    if (!nextBase) return
    const nextTurn = materializeOpenCorteTurnoActual(nextBase)
    if (!nextTurn) return
    const nextForm: Record<string, unknown> = {
      ...nextBase,
      ...syncCorteFormMetrics({ ...nextBase, cor_paletas: nextTurn.paletas }),
    }
    setForm((prev) => ({
      ...prev,
      [COR_ACTUAL_KEY]: nextTurn,
      ...corteTurnoToMirror(nextTurn),
      ...syncCorteFormMetrics({ ...prev, cor_paletas: nextTurn.paletas }),
    }))
    void persistCorteForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      successMessage: "Producción reanudada.",
    })
  }

  function runOpenTimerReportPreview() {
    const payload = {
      generated_at: new Date().toISOString(),
      work_order_id: workOrderId,
      work_order_code: readString(prefill.code) || `OT-${workOrderId}`,
      turno: {
        turno: readString(form.corTurno),
        grupo: readString(form.corGrupo),
        operador: readString(form.corOperador),
        ayudante: readString(form.corAyudante),
        supervisor: readString(form.corSupervisor),
      },
      timer: {
        state: timerState,
        total_hms: formatTimerHms(displayTotalSec),
        dead_hms: formatTimerHms(displayDeadSec),
        effective_hms: formatTimerHms(displayEffectiveSec),
        kg_hora: kgHora,
      },
      pauses: pauseEntries.map((p) => ({
        at: p.at,
        reason: p.reason,
        obs: p.obs,
        duration_hms: formatTimerHms(p.duration_sec),
      })),
    }
    const previewHash = (() => {
      try {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
        return `#p=${encodeURIComponent(encoded)}`
      } catch {
        return ""
      }
    })()
    if (!previewHash) {
      toast.error("No se pudo preparar la vista previa.")
      return
    }
    const url = appAbsoluteUrl(
      `/ordenes-trabajo/${encodeURIComponent(String(workOrderId))}/corte/temporizador/vista-previa${previewHash}`,
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

  function openPlanillaPreview() {
    if (!areaFinalizada) {
      toast.error("Finalice el área de corte para ver la planilla.")
      return
    }
    const ok = openCortePlanillaPreviewFromSource({
      work_order_id: workOrderId,
      work_order_code: readString(prefill.code) || `OT-${workOrderId}`,
      client: readString((prefill as Record<string, unknown>).clientName) || null,
      product: readString((prefill as Record<string, unknown>).productName) || null,
      form: form as Record<string, unknown>,
      board_stage: "corte",
    })
    if (!ok) {
      toast.error("No se pudo abrir la vista previa de planilla.")
    }
  }

  function confirmOpenTimerReportPreview() {
    setPreviewTimerConfirmOpen(false)
    runOpenTimerReportPreview()
  }

  function executePauseProductionTimer() {
    if (controlReadOnly) return
    if (!timerRunning) {
      toast.message("El cronómetro no está en marcha.")
      return
    }
    setForm((prev) => {
      const next = pauseCorteProductionTimerOnForm(prev)
      if (!next) {
        toast.error("No se pudo pausar el cronómetro. Guarde el turno e intente de nuevo.")
        return prev
      }
      queueMicrotask(() => {
        void persistCorteForm(next, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          suppressSuccessToast: true,
        })
      })
      return next
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
      const cur = materializeOpenCorteTurnoActual(prev)
      if (!cur || cur.timer.state !== "paused") return prev
      const now = Date.now()
      const pauseStart = cur.timer.pauseAtMs
      const pauseDurationSec = pauseStart > 0 ? (now - pauseStart) / 1000 : 0
      const nextTurn: CorteTurnoEntry = {
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
        [COR_ACTUAL_KEY]: nextTurn,
        ...corteTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => {
        void persistCorteForm(nextForm, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          suppressSuccessToast: true,
        }).then((ok) => {
          if (ok) {
            toast.message(
              "Parada registrada. Use «Fin de parada» para reanudar; el tiempo muerto queda en el reporte de planta.",
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

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de corte…</p>

  return (
    <div className="ax-mes space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          size="sm"
          onClick={requestGuardar}
          disabled={saving || controlReadOnly || (!areaFinalizada && !canClickGuardar)}
          title={guardarHint || undefined}
        >
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <div className="ax-ot">
        <div className="ot-section">
          <div className="section-header">
            <span className="inline-flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              AREA DE CORTE / EMBALAJE
            </span>
          </div>
          <div className="section-body">
            <div className="ot-grid ot-cols-4">
              <div className="ot-field">
                <label className="ot-label">Ancho corte (mm)</label>
                <input className="ot-input" value={readString(form.anchoCorteFinal)} placeholder="320±0" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Peso bobina (Kg)</label>
                <input className="ot-input" value={readString(form.pesoBobina)} placeholder="19-20" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Metros/Bobina (m)</label>
                <input className="ot-input" value={readString(form.metrosBobina)} placeholder="1020 ± 20" readOnly />
              </div>
              <div className="ot-field sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="ot-label">Figura embobinado (1-8 o libre)</label>
                </div>
                <WindingFigurePicker
                  value={readString(form.orientacionEmbalaje)}
                  onChange={() => undefined}
                  className="pointer-events-none"
                />
              </div>
              <div className="ot-field">
                <label className="ot-label">Ubic. fotocelda</label>
                <input className="ot-input" value={readString(form.ubicFotoceldaCorte)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Dist. fotocelda al borde (mm)</label>
                <input className="ot-input" value={readString(form.distFotoceldaBorde)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Distancia figura lado contrario (mm)</label>
                <input className="ot-input" value={readString(form.distFiguraLadoContrario)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Distancia figura lado fotocelda (mm)</label>
                <input className="ot-input" value={readString(form.distFiguraLadoFotocelda)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Max. empates</label>
                <input className="ot-input" value={readString(form.maxEmpates)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Diam. bobina (mm)</label>
                <input className="ot-input" value={readString(form.diamBobina)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Ancho core (mm)</label>
                <input className="ot-input" value={readString(form.anchoCore)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Diam. core (Plg)</label>
                <input className="ot-input" value={readString(form.diamCorePlg)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Cant. cores</label>
                <input className="ot-input" value={readString(form.cantCores)} readOnly />
              </div>
            </div>

            <div className="ot-grid ot-metrics-before-nested ot-cols-4">
              <div className="ot-field">
                <label className="ot-label">Kg ingresados</label>
                <input className="ot-input" value={readString(form.kgIngresadosCorte)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Kg salida</label>
                <input className="ot-input" value={readString(form.kgSalidaCorte)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Kg merma</label>
                <input className="ot-input" value={readString(form.kgMermaCorte)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Metraje</label>
                <input className="ot-input" value={readString(form.metrajeCorte)} readOnly />
              </div>
            </div>
          </div>
        </div>
      </div>

      <MesOperativoEstadoCard
        areaLabel="Corte"
        estado={operativoEstado}
        producidoKg={producidoAcumuladoKg}
      />

      {areaFinalizada ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          Área de corte finalizada en el sistema. Los datos quedan en solo lectura salvo jefatura.
        </p>
      ) : null}

      {dispatchSyncAlert ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {dispatchSyncAlert}
        </p>
      ) : null}

      <WorkOrderCorteOpsSection
        form={form}
        setForm={setForm}
        pedidoTotalKg={pedidoTotalKg}
        readOnly={controlReadOnly}
        readOnlyOps={controlReadOnly}
        canOperateProduction={canSaveProduction}
        areaFinalizada={areaFinalizada}
        canFinalizeOrder={canFinalizeOrder}
        hasActiveTurno={hasActiveTurno}
        turnosRegistrados={jsonAccum.turnosRegistrados}
        ultimoTurnoLabel={hasActiveTurno ? "Turno en curso" : jsonAccum.ultimoCierreLabel}
        closedTurnos={closedTurnos}
        timerState={timerState}
        totalSec={displayTotalSec}
        deadSec={displayDeadSec}
        effectiveSec={displayEffectiveSec}
        demountSec={displayDemountSec}
        arranqueSec={displayArranqueSec}
        timerShowsOtAccumulated={closedTurnos.length > 0 || hasActiveTurno}
        kgHora={kgHora}
        horaArranque={displayHoraArranque}
        arranqueRunning={arranqueRunning}
        demountRunning={demountRunning}
        timerRunning={timerRunning}
        timerPaused={timerPaused}
        timerActionFlags={timerActionFlags}
        onRequestTimerConfirm={requestTimerConfirm}
        onPreviewTimerReport={requestOpenTimerReportPreview}
        canPreviewPlanillaReport={canPreviewPlanillaReport}
        onPreviewPlanillaReport={openPlanillaPreview}
        formatTimerHms={formatTimerHms}
        corTurno={readString(form.corTurno)}
        corGrupo={readString(form.corGrupo)}
        corOperador={readString(form.corOperador)}
        corAyudante={readString(form.corAyudante)}
        corSupervisor={readString(form.corSupervisor)}
        onSetTurno={(v) => patchActiveTurn((t) => ({ ...t, turno: v }))}
        onSetGrupo={(v) => patchActiveTurn((t) => ({ ...t, grupo: v }))}
        onActivePersonnelApply={(people: DraftPerson[]) => {
          const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
          patchActiveTurn((t) => ({ ...t, operador, ayudante, supervisor }))
        }}
        patchActiveTurn={patchActiveTurn}
        onRequestSave={persistCorteFormCb}
        onApplyCerrarTurno={applyCerrarTurno}
        onRequestCerrarTurno={() => setCloseTurnConfirmOpen(true)}
        confirmPauseAndResume={confirmPauseAndResume}
        pauseReason={pauseReason}
        pauseObs={pauseObs}
        setPauseReason={setPauseReason}
        setPauseObs={setPauseObs}
        pauseMotivoDialogOpen={pauseMotivoModalOpen}
        onPauseMotivoDialogOpenChange={setPauseMotivoModalOpen}
        pauseEntries={pauseEntries}
      />

      <div className="no-print mb-12 flex flex-col items-center gap-2">
        {guardarHint ? (
          <p className="max-w-md text-center text-xs text-muted-foreground">{guardarHint}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            onClick={requestGuardar}
            disabled={saving || controlReadOnly || (!areaFinalizada && !canClickGuardar)}
            title={guardarHint || undefined}
          >
            <Save className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <MesGuardarChoiceDialog
        open={guardarChoiceOpen}
        onOpenChange={setGuardarChoiceOpen}
        areaLabel={MES_GUARDAR_AREA_LABELS.corte}
        canFinalizeArea={canFinalizeOrder && !areaFinalizada}
        hasActiveTurno={hasActiveTurno}
        betweenShiftsMode={canPersistBetweenShifts && !hasActiveTurno}
        onGuardarSesion={handleGuardarSesion}
        onFinalizarTurno={handleFinalizarTurnoFromGuardar}
        onFinalizarArea={() => setFinalizeAreaConfirmOpen(true)}
      />

      <AlertDialog open={closeTurnConfirmOpen} onOpenChange={setCloseTurnConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar turno</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará el turno de planta en curso y se guardará en el historial. Después verá la pantalla{" "}
              <span className="font-semibold">Personal y turno de planta</span> (como en Montaje e Impresión) para
              agregar otra cuadrilla y pulsar <span className="font-semibold">Iniciar turno</span>. ¿Confirma el cierre?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCloseTurnConfirmOpen(false)
                const cur = parseCorteTurnoActual(form[COR_ACTUAL_KEY], form)
                if (!cur) return
                if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
                  toast.error("Complete turno, grupo y operador.")
                  return
                }
                void applyCerrarTurno(cur)
              }}
            >
              Sí, cerrar turno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={finalizeAreaConfirmOpen} onOpenChange={setFinalizeAreaConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar área de corte (OT)</AlertDialogTitle>
            <AlertDialogDescription>
              Marcará el área de corte como finalizada en la orden. Revise que los datos del turno estén completos antes
              de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setFinalizeAreaConfirmOpen(false)
                void finalizarAreaCorte()
              }}
            >
              Sí, finalizar área
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {timerConfirm ? (
        <AlertDialog open onOpenChange={(open) => !open && setTimerConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{getMesTimerConfirm("corte")[timerConfirm].title}</AlertDialogTitle>
              <AlertDialogDescription>
                {getMesTimerConfirm("corte")[timerConfirm].description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className={
                  getMesTimerConfirm("corte")[timerConfirm].destructive
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                onClick={() => {
                  const key = timerConfirm
                  setTimerConfirm(null)
                  executeTimerConfirm(key)
                }}
              >
                {getMesTimerConfirm("corte")[timerConfirm].confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <AlertDialog open={previewTimerConfirmOpen} onOpenChange={setPreviewTimerConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="inline-flex items-center gap-2">
              <FileSearch className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
              Vista previa del cronómetro
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se abrirá una pestaña nueva con el reporte de tiempos y pausas registrados hasta este momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmOpenTimerReportPreview()}>
              Abrir vista previa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
