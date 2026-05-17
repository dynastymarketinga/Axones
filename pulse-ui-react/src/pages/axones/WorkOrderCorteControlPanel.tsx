"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Flag, LogOut, RotateCcw, Save, Scissors } from "lucide-react"
import { toast } from "sonner"

import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
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
import { Button } from "@/components/ui/button"
import { apiFetch, ApiError } from "@/lib/api"

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
function warnCorteDispatchSync(dispatchSync?: CorteDispatchSyncStatus): void {
  if (!dispatchSync) return
  const issue = corteDispatchSyncIssueMessage(dispatchSync)
  if (issue) {
    const needsMaterial =
      (dispatchSync.closed_paletas_with_kg > 0 ||
        (dispatchSync.provisional_paletas_with_kg ?? 0) > 0) &&
      !dispatchSync.material_resolved
    if (needsMaterial) toast.error(issue)
    else toast.warning(issue)
    return
  }
  const provisional = dispatchSync.provisional_paletas_with_kg ?? 0
  const provisionalSynced = dispatchSync.provisional_synced ?? 0
  if (provisional > 0 && provisionalSynced >= provisional) {
    toast.message("Saldo provisional visible en Despacho · producto terminado.")
  }
}
import { getStoredUser } from "@/lib/auth-storage"
import { withCorteAutoFields } from "@/lib/corte-planilla-metrics"
import { filterCorteControlForm } from "@/lib/corte-control-keys"
import { CORTE_CONTROL_SAVED_EVENT } from "@/lib/corte-mes-band-status"
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
  pauseCorteProductionTimerOnForm,
  startCorteProductionTimerOnForm,
  getCorPaletas,
  sanitizeCorEntradaBobinasKg,
  sanitizeCorPaletasForPersistence,
  shouldPreferTopCorPaletas,
  sumEntradaKgFromForm,
  sumSalidaKgFromPaletas,
  sumSalidaKgFromForm,
  syncCorteFormMetrics,
  syncCorteSalidaFields,
  type CorteTurnoEntry,
} from "./corte-turnos"
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [closeTurnConfirmOpen, setCloseTurnConfirmOpen] = useState(false)
  const [finalizeAreaConfirmOpen, setFinalizeAreaConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [pauseMotivoModalOpen, setPauseMotivoModalOpen] = useState(false)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [dispatchSyncAlert, setDispatchSyncAlert] = useState<string | null>(null)

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
  const controlReadOnly = areaFinalizada && !canFinalizeOrder
  const activeTurno = useMemo(() => materializeOpenCorteTurnoActual(form), [form])
  const activeTimer = useMemo(() => resolveCorteDisplayTimer(activeTurno, form), [activeTurno, form])
  const timerState = activeTimer.state || "pending"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const hasActiveTurno = activeTurno !== null

  const timerEverStarted = useMemo(
    () => hasProductionTimerStarted(mesTimerFieldsFromForm(form, "cor")),
    [form],
  )

  const canSaveProduction = useMemo(() => {
    if (controlReadOnly) return false
    return canSaveProductionAreaForm(form, MES_PRODUCTION_SAVE_CONFIG.corte)
  }, [controlReadOnly, form])

  const canPersistShiftOpen = useMemo(() => {
    if (controlReadOnly) return false
    return hasActiveTurno
  }, [controlReadOnly, hasActiveTurno])

  const canClickGuardar = canSaveProduction || canPersistShiftOpen || areaFinalizada

  const guardarHint = useMemo(() => {
    if (controlReadOnly) return ""
    if (canSaveProduction || areaFinalizada) return ""
    if (canPersistShiftOpen) {
      return "Turno abierto: puede guardar turno y personal. Para cerrar paletas y avisar a otras áreas, inicie el cronómetro (play)."
    }
    return MES_SAVE_BLOCKED_MESSAGE
  }, [areaFinalizada, canPersistShiftOpen, canSaveProduction, controlReadOnly])

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
      const src = withCorteAutoFields(srcBase ?? form)
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
        const topPaletas = getCorPaletas(src)
        if (shouldPreferTopCorPaletas(topPaletas, actualP.paletas)) {
          actualP = {
            ...actualP,
            paletas: sanitizeCorPaletasForPersistence(topPaletas),
          }
        }
        const entradaKg = sanitizeCorEntradaBobinasKg(
          src.corEntradaBobinasKg ?? actualP.entradaBobinasKg,
        )
        actualP = {
          ...actualP,
          paletas: sanitizeCorPaletasForPersistence(topPaletas),
          entradaBobinasKg: entradaKg,
          kgIngresados: sumEntradaKgFromForm({ ...src, corEntradaBobinasKg: entradaKg }).toFixed(2),
        }
      }

      const paletasForSave = sanitizeCorPaletasForPersistence(getCorPaletas(src))
      const entradaForSave = sanitizeCorEntradaBobinasKg(src.corEntradaBobinasKg)
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
        normalizedForm[COR_ACTUAL_KEY] = null
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

  const patchActiveTurnAndPersist = useCallback(
    (updater: (t: CorteTurnoEntry) => CorteTurnoEntry) => {
      setForm((prev) => {
        const cur = materializeOpenCorteTurnoActual(prev)
        if (!cur) return prev
        const nextTurn = updater(cur)
        const nextForm: Record<string, unknown> = {
          ...prev,
          [COR_ACTUAL_KEY]: nextTurn,
          ...corteTurnoToMirror(nextTurn),
          ...syncCorteFormMetrics({ ...prev, cor_paletas: nextTurn.paletas }),
        }
        queueMicrotask(() => {
          void persistCorteForm(nextForm, {
            skipProductionSaveGuard: true,
            notifyProductionSave: false,
            suppressSuccessToast: true,
          })
        })
        return nextForm
      })
    },
    [persistCorteForm],
  )

  const applyCerrarTurno = useCallback(
    async (cur: CorteTurnoEntry) => {
      const finalizedTimer = finalizeTurnTimerNow(cur.timer)
      const u = getStoredUser()
      const closed: CorteTurnoEntry = {
        ...cur,
        timer: finalizedTimer,
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
        metrics: snapshotCorteTurnMetrics({
          ...form,
          cor_paletas: cur.paletas,
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
        paletas: cur.paletas,
        entradaBobinasKg: cur.entradaBobinasKg,
      }
      const turnosClosed = [...parseCorteTurnos(form[COR_TURNOS_KEY], form), closed]
      const nextForm: Record<string, unknown> = {
        ...form,
        [COR_TURNOS_KEY]: turnosClosed,
        [COR_ACTUAL_KEY]: null,
        corRegistrosTurnos: turnosClosed.length,
        ...clearCorteMirrorKeys(),
        ...corteAggregatedTimerMirrorFromTurnos(turnosClosed),
        ...syncCorteSalidaFields({ ...form, cor_paletas: clearCorteMirrorKeys().cor_paletas }),
      }
      setForm(bootstrapCorteFormState(nextForm))
      const ok = await persistCorteForm(nextForm, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        suppressSuccessToast: true,
      })
      if (ok) {
        toast.success("Turno de planta cerrado y guardado.")
        await load()
      }
    },
    [form, persistCorteForm, load],
  )

  async function finalizarAreaCorte() {
    if (!canFinalizeOrder) {
      toast.error("Solo jefatura puede finalizar el área de corte.")
      return
    }
    const prev = form
    let turnos = parseCorteTurnos(prev[COR_TURNOS_KEY], prev)
    const cur = parseCorteTurnoActual(prev[COR_ACTUAL_KEY], prev)
    const u = getStoredUser()
    if (cur) {
      const finalizedTimer = finalizeTurnTimerNow(cur.timer)
      const closed: CorteTurnoEntry = {
        ...cur,
        timer: finalizedTimer,
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
        metrics: snapshotCorteTurnMetrics({
          ...prev,
          cor_paletas: cur.paletas,
          corEntradaBobinasKg: cur.entradaBobinasKg,
        }),
        paletas: cur.paletas,
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
      ...corteAggregatedTimerMirrorFromTurnos(turnos),
    }
    setForm(bootstrapCorteFormState(nextForm))
    const ok = await persistCorteForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      toast.success(
        "Área de corte finalizada. La OT pasará a Finalizadas e Historial en la bandeja.",
      )
      await load()
    } else {
      toast.error("No se pudo finalizar el área de corte. Revise su conexión o permisos de jefatura.")
    }
  }

  async function confirmResetAll() {
    if (saving || controlReadOnly) return
    setResetConfirmOpen(false)
    const cleared: Record<string, unknown> = {
      ...form,
      [COR_TURNOS_KEY]: [],
      [COR_ACTUAL_KEY]: null,
      [COR_ESTADO_KEY]: "abierta",
      ...clearCorteMirrorKeys(),
    }
    setForm(bootstrapCorteFormState(cleared))
    toast.success("Corte reiniciado. Guardando en el servidor…")
    await persistCorteForm(cleared, { skipProductionSaveGuard: true, notifyProductionSave: false })
  }

  const startProductionTimer = useCallback(() => {
    if (controlReadOnly || !hasActiveTurno) return
    setForm((prev) => {
      const next = startCorteProductionTimerOnForm(prev)
      if (!next) return prev
      queueMicrotask(() => {
        void persistCorteForm(next, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          successMessage: "Cronómetro iniciado y guardado en el sistema.",
        })
      })
      return next
    })
  }, [controlReadOnly, hasActiveTurno, persistCorteForm])

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
        })
      })
      return nextForm
    })
    setPauseReason("")
    setPauseObs("")
    setPauseMotivoModalOpen(false)
    toast.message("Parada registrada. Use play para reanudar el tiempo efectivo.")
  }

  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => {
      if (saving) return
      persistCorteFormCb(form, {
        skipProductionSaveGuard: !canSaveProduction && canPersistShiftOpen,
        notifyProductionSave: canSaveProduction && timerEverStarted,
        suppressSuccessToast: true,
      })
    }, 60000)
    return () => window.clearInterval(id)
  }, [
    timerRunning,
    saving,
    persistCorteFormCb,
    form,
    canSaveProduction,
    canPersistShiftOpen,
    timerEverStarted,
  ])

  const saveCorteForm = useCallback(() => {
    void persistCorteForm(undefined, {
      skipProductionSaveGuard: !canSaveProduction && canPersistShiftOpen,
      notifyProductionSave: canSaveProduction && timerEverStarted,
    })
  }, [canPersistShiftOpen, canSaveProduction, persistCorteForm, timerEverStarted])

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de corte…</p>

  return (
    <div className="ax-mes space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WorkOrderStageBadge current="corte" />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void load()}
            disabled={loading || saving}
          >
            Actualizar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveCorteForm}
            disabled={saving || controlReadOnly || (!areaFinalizada && !canClickGuardar)}
            title={guardarHint || undefined}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
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
                <label className="ot-label">Dist. figura lado contrario (mm)</label>
                <input className="ot-input" value={readString(form.distFiguraLadoContrario)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Dist. figura lado fotocelda (mm)</label>
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

      <div className="rounded-lg border bg-card p-3">
        <h3 className="mb-2 text-base font-semibold">Datos de pedido / OT (solo lectura)</h3>
        <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-muted-foreground">OT:</span> {readString(prefill.numeroOrden) || "—"}
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
            <span className="text-muted-foreground">Estructura:</span>{" "}
            {readString(form.estructuraMaterial) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Tipo impresión:</span>{" "}
            {readString(form.tipoImpresionEstructura || form.tipoImpresion) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Cant. solicitada (Kg):</span>{" "}
            {readString(form.pedidoKg) || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Ref. pedido:</span>{" "}
            {readString(form.client_order_code || form.client_order_reference) || "—"}
          </div>
        </div>
      </div>

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
        corTurno={readString(form.corTurno)}
        corGrupo={readString(form.corGrupo)}
        corOperador={readString(form.corOperador)}
        corAyudante={readString(form.corAyudante)}
        corSupervisor={readString(form.corSupervisor)}
        onSetTurno={(v) => patchActiveTurnAndPersist((t) => ({ ...t, turno: v }))}
        onSetGrupo={(v) => patchActiveTurnAndPersist((t) => ({ ...t, grupo: v }))}
        onActivePersonnelApply={(people: DraftPerson[]) => {
          const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
          patchActiveTurnAndPersist((t) => ({ ...t, operador, ayudante, supervisor }))
        }}
        patchActiveTurn={patchActiveTurn}
        onRequestSave={persistCorteFormCb}
        onApplyCerrarTurno={applyCerrarTurno}
        onRequestCerrarTurno={() => setCloseTurnConfirmOpen(true)}
        startProductionTimer={startProductionTimer}
        pauseProductionTimer={executePauseProductionTimer}
        confirmPauseAndResume={confirmPauseAndResume}
        pauseReason={pauseReason}
        pauseObs={pauseObs}
        setPauseReason={setPauseReason}
        setPauseObs={setPauseObs}
        pauseMotivoDialogOpen={pauseMotivoModalOpen}
        onPauseMotivoDialogOpenChange={setPauseMotivoModalOpen}
      />

      <div className="no-print mb-12 flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            onClick={saveCorteForm}
            disabled={saving || controlReadOnly || (!areaFinalizada && !canClickGuardar)}
            title={guardarHint || undefined}
          >
            <Save className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          {!controlReadOnly && !areaFinalizada ? (
            <Button
              type="button"
              variant="outline"
              className="border-amber-300 text-amber-950 hover:bg-amber-50"
              disabled={saving}
              onClick={() => setResetConfirmOpen(true)}
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
              onClick={() => setCloseTurnConfirmOpen(true)}
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
              onClick={() => setFinalizeAreaConfirmOpen(true)}
            >
              <Flag className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Finalizar área de corte
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog open={closeTurnConfirmOpen} onOpenChange={setCloseTurnConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar turno</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará el registro de turno de planta en curso y se consolidará el cronómetro en el historial. Podrá
              abrir otro turno después. ¿Confirma el cierre?
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

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar corte (OT)</AlertDialogTitle>
            <AlertDialogDescription>
              Esto borrará turnos, cronómetro, bobinas, paletas y métricas registradas en Corte para esta OT en el
              servidor. ¿Desea continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmResetAll()}>Confirmar reinicio</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
