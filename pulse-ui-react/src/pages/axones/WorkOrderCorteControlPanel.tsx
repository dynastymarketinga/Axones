"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Save, Scissors } from "lucide-react"
import { toast } from "sonner"

import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import { Button } from "@/components/ui/button"
import { apiFetch, ApiError } from "@/lib/api"
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
  COR_ACTUAL_KEY,
  COR_TURNOS_KEY,
  parseCorteTurnoActual,
  parseCorteTurnos,
  accumulateCorteFromJson,
  sumSalidaKgFromForm,
} from "./corte-turnos"
import WorkOrderCorteOpsSection from "./WorkOrderCorteOpsSection"
import { WindingFigurePicker } from "./WindingFigurePicker"
import "./work-order-planilla.css"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

const LOCAL_CORTE_DRAFT_PREFIX = "axones.corte.control.draft."

type LocalCorteDraft = {
  work_order_id: number
  saved_at_ms: number
  active_turno: unknown
  mirror: Record<string, unknown>
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
  canFinalizeOrder: _canFinalizeOrder = false,
}: {
  workOrderId: number
  canFinalizeOrder?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      const basePrefill = payload.prefill ?? {}
      setPrefill(basePrefill)
      const mergedForm = mergePrefill(basePrefill, payload.form)
      const boot = bootstrapCorteFormState(mergedForm)

      try {
        const raw = localStorage.getItem(`${LOCAL_CORTE_DRAFT_PREFIX}${workOrderId}`)
        if (raw) {
          const draft = JSON.parse(raw) as Partial<LocalCorteDraft>
          const serverLastResume = readNumber(boot.corTimerLastResumeAtMs)
          const serverPauseAt = readNumber(boot.corTimerPauseAtMs)
          const serverTimerAny = Math.max(serverLastResume, serverPauseAt)

          const draftMirror =
            draft.mirror && typeof draft.mirror === "object"
              ? (draft.mirror as Record<string, unknown>)
              : null
          const draftLastResume = readNumber(draftMirror?.corTimerLastResumeAtMs)
          const draftPauseAt = readNumber(draftMirror?.corTimerPauseAtMs)
          const draftTimerAny = Math.max(draftLastResume, draftPauseAt)

          if (draftTimerAny > serverTimerAny && draft.active_turno) {
            setForm(
              bootstrapCorteFormState({
                ...boot,
                [COR_ACTUAL_KEY]: draft.active_turno,
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
  const activeTurno = useMemo(() => parseCorteTurnoActual(form[COR_ACTUAL_KEY], form), [form])
  const timerState = readString(form.corTimerState) || "pending"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const hasActiveTurno = activeTurno !== null

  const timerEverStarted = useMemo(
    () => hasProductionTimerStarted(mesTimerFieldsFromForm(form, "cor")),
    [form],
  )

  const canSaveProduction = useMemo(() => {
    return canSaveProductionAreaForm(form, MES_PRODUCTION_SAVE_CONFIG.corte)
  }, [form])

  const persistCorteForm = useCallback(
    async (
      srcBase?: Record<string, unknown>,
      options?: { skipProductionSaveGuard?: boolean },
    ) => {
      const src = withCorteAutoFields(srcBase ?? form)
      if (!Number.isFinite(workOrderId) || workOrderId < 1) return

      if (
        !options?.skipProductionSaveGuard &&
        !canSaveProductionAreaForm(src, MES_PRODUCTION_SAVE_CONFIG.corte)
      ) {
        toast.error(MES_SAVE_BLOCKED_MESSAGE)
        return
      }

      const act = parseCorteTurnoActual(src[COR_ACTUAL_KEY], src)
      if (act) {
        if (!act.operador.trim() || !act.turno || !act.grupo) {
          toast.error("Corte: complete turno, grupo y operador antes de guardar.")
          return
        }
      }

      const closedP = parseCorteTurnos(src[COR_TURNOS_KEY], src)
      const actualP = parseCorteTurnoActual(src[COR_ACTUAL_KEY], src)
      const salidaActual = sumSalidaKgFromForm(src)
      const accFromJson = accumulateCorteFromJson(closedP, actualP, salidaActual)

      const normalizedForm: Record<string, unknown> = {
        ...src,
        [COR_TURNOS_KEY]: closedP,
        [COR_ACTUAL_KEY]: actualP,
        kgIngresadosCorte: normalizeNumericString(src.kgIngresadosCorte),
        kgSalidaCorte: normalizeNumericString(src.kgSalidaCorte),
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

      const corteOnlyForm = filterCorteControlForm(normalizedForm)

      setSaving(true)
      try {
        await apiFetch(`work-orders/${workOrderId}/orden-trabajo/corte-control`, {
          method: "PATCH",
          body: JSON.stringify({
            form: corteOnlyForm,
            origin_area: "corte",
            notify_on_production_save: timerEverStarted,
          }),
        })
        toast.success("Control de corte guardado.")
        window.dispatchEvent(
          new CustomEvent(CORTE_CONTROL_SAVED_EVENT, { detail: { workOrderId } }),
        )
        try {
          localStorage.removeItem(`${LOCAL_CORTE_DRAFT_PREFIX}${workOrderId}`)
        } catch {
          // no-op
        }
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo guardar control de corte.")
      } finally {
        setSaving(false)
      }
    },
    [form, timerEverStarted, workOrderId],
  )

  const persistCorteFormCb = useCallback(
    (srcBase?: Record<string, unknown>) => {
      void persistCorteForm(srcBase)
    },
    [persistCorteForm],
  )

  useEffect(() => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    if (!hasActiveTurno) return
    if (!(timerRunning || timerPaused)) return
    try {
      const cur = parseCorteTurnoActual(form[COR_ACTUAL_KEY], form)
      if (!cur) return
      const draft: LocalCorteDraft = {
        work_order_id: workOrderId,
        saved_at_ms: Date.now(),
        active_turno: cur,
        mirror: {
          corTimerState: form.corTimerState,
          corTimerStartedAtMs: form.corTimerStartedAtMs,
          corTimerLastResumeAtMs: form.corTimerLastResumeAtMs,
          corTimerPauseAtMs: form.corTimerPauseAtMs,
          corTimerEffectiveAccSec: form.corTimerEffectiveAccSec,
          corTimerDeadAccSec: form.corTimerDeadAccSec,
          corTimerPauses: form.corTimerPauses,
        },
      }
      localStorage.setItem(`${LOCAL_CORTE_DRAFT_PREFIX}${workOrderId}`, JSON.stringify(draft))
    } catch {
      // no-op
    }
  }, [form, hasActiveTurno, timerPaused, timerRunning, workOrderId])

  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => {
      if (saving) return
      persistCorteFormCb(form)
    }, 60000)
    return () => window.clearInterval(id)
  }, [timerRunning, saving, persistCorteFormCb, form])

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
            onClick={() => void persistCorteForm()}
            disabled={saving || !canSaveProduction}
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

      <WorkOrderCorteOpsSection
        form={form}
        setForm={setForm}
        pedidoTotalKg={pedidoTotalKg}
        onRequestSave={persistCorteFormCb}
      />
    </div>
  )
}
