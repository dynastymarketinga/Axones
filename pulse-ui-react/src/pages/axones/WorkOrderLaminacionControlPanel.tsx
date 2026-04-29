"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import WorkOrderLaminacionOpsSection from "./WorkOrderLaminacionOpsSection"
import "./work-order-planilla.css"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
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

function setNumericSeries(
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  key: string,
  values: string[],
) {
  setForm((prev) => ({ ...prev, [key]: values }))
}

function setKey(
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  key: string,
  value: unknown,
) {
  setForm((prev) => ({ ...prev, [key]: value }))
}

function formatTimerHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, "0")
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

export default function WorkOrderLaminacionControlPanel({ workOrderId }: { workOrderId: number }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [timerTick, setTimerTick] = useState(0)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      setPrefill(payload.prefill ?? {})
      setForm(mergePrefill(payload.prefill ?? {}, payload.form))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT para laminación.")
      setPrefill({})
      setForm({})
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  const entradaImpresaBobinas = useMemo(() => getNumericSeries(form, "lamEntradaImpresaBobinasKg", 14), [form])
  const entradaVirgenBobinas = useMemo(() => getNumericSeries(form, "lamEntradaVirgenBobinasKg", 14), [form])
  const salidaBobinas = useMemo(() => getNumericSeries(form, "lamSalidaBobinasKg", 22), [form])
  const totalEntradaImpresa = useMemo(() => entradaImpresaBobinas.reduce((acc, v) => acc + readNumber(v), 0), [entradaImpresaBobinas])
  const totalEntradaVirgen = useMemo(() => entradaVirgenBobinas.reduce((acc, v) => acc + readNumber(v), 0), [entradaVirgenBobinas])
  const totalSalida = useMemo(() => salidaBobinas.reduce((acc, v) => acc + readNumber(v), 0), [salidaBobinas])
  const scrapTransparente = readNumber(form.lamScrapTransparenteKg)
  const scrapImpreso = readNumber(form.lamScrapImpresoKg)
  const scrapLaminado = readNumber(form.lamScrapLaminadoKg)
  const totalScrap = scrapTransparente + scrapImpreso + scrapLaminado
  const adhesivoConsumido = Math.max(0, readNumber(form.lamAdhesivoEntradaKg) - readNumber(form.lamAdhesivoSobroKg))
  const mermaCalc = totalEntradaImpresa + totalEntradaVirgen + adhesivoConsumido - totalSalida - totalScrap
  const refilPct = totalSalida > 0 ? (totalScrap / totalSalida) * 100 : 0
  const pedidoTotalKg = readNumber(form.pedidoKg ?? prefill.pedidoKg)
  const producidoAcumuladoKg = readNumber(form.lamAcumuladoProducidoKg) || totalSalida
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = Math.max(0, Math.floor(readNumber(form.lamRegistrosTurnos)))

  const timerState = readString(form.lamTimerState) || "pending"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const timerStopped = timerState === "stopped" || timerState === "completed"
  const effectiveAcc = readNumber(form.lamTimerEffectiveAccSec)
  const deadAcc = readNumber(form.lamTimerDeadAccSec)
  const lastResumeAt = readNumber(form.lamTimerLastResumeAtMs)
  const pauseAt = readNumber(form.lamTimerPauseAtMs)
  const nowMs = Date.now() + timerTick * 0
  const effectiveSec = effectiveAcc + (timerRunning && lastResumeAt > 0 ? (nowMs - lastResumeAt) / 1000 : 0)
  const deadSec = deadAcc + (timerPaused && pauseAt > 0 ? (nowMs - pauseAt) / 1000 : 0)
  const totalSec = effectiveSec + deadSec
  const kgHora = effectiveSec > 0 ? (totalSalida / (effectiveSec / 3600)).toFixed(2) : "0.00"
  const ultimoTurnoLabel =
    timerState === "completed"
      ? "Turno finalizado"
      : timerState === "stopped"
        ? "Turno cerrado"
        : timerState === "running"
          ? "Turno en ejecución"
          : "Sin producción previa"

  const pauseReasons = [
    "Cambio de bobina",
    "Ajuste de máquina",
    "Falla mecánica",
    "Falla eléctrica",
    "Problema de calidad",
    "Falta de material",
    "Preparación de adhesivo",
    "Almuerzo/Descanso",
    "Otro",
  ]

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

  useEffect(() => {
    if (!timerRunning && !timerPaused) return
    const id = window.setInterval(() => setTimerTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [timerPaused, timerRunning])

  function startProductionTimer() {
    const now = Date.now()
    setForm((prev) => ({
      ...prev,
      lamTimerState: "running",
      lamTimerStartedAtMs: readNumber(prev.lamTimerStartedAtMs) || now,
      lamTimerLastResumeAtMs: now,
      lamTimerPauseAtMs: 0,
      lamTimerEffectiveAccSec: readNumber(prev.lamTimerEffectiveAccSec),
      lamTimerDeadAccSec: readNumber(prev.lamTimerDeadAccSec),
    }))
  }

  function pauseProductionTimer() {
    if (!timerRunning) return
    const now = Date.now()
    setForm((prev) => ({
      ...prev,
      lamTimerState: "paused",
      lamTimerEffectiveAccSec:
        readNumber(prev.lamTimerEffectiveAccSec) +
        (readNumber(prev.lamTimerLastResumeAtMs) > 0 ? (now - readNumber(prev.lamTimerLastResumeAtMs)) / 1000 : 0),
      lamTimerPauseAtMs: now,
      lamTimerLastResumeAtMs: 0,
    }))
  }

  function confirmPauseAndResume() {
    if (!timerPaused || !pauseReason) {
      toast.error("Seleccione el motivo de parada.")
      return
    }
    const now = Date.now()
    const pauseDurationSec = pauseAt > 0 ? (now - pauseAt) / 1000 : 0
    setForm((prev) => {
      const rows = Array.isArray(prev.lamTimerPauses) ? (prev.lamTimerPauses as LaminacionPauseEntry[]) : []
      return {
        ...prev,
        lamTimerState: "running",
        lamTimerDeadAccSec: readNumber(prev.lamTimerDeadAccSec) + pauseDurationSec,
        lamTimerPauseAtMs: 0,
        lamTimerLastResumeAtMs: now,
        lamTimerPauses: [
          ...rows,
          { at: new Date(now).toISOString(), reason: pauseReason, obs: pauseObs.trim(), duration_sec: pauseDurationSec },
        ],
      }
    })
    setPauseReason("")
    setPauseObs("")
  }

  function stopProductionTimer(nextState: "stopped" | "completed") {
    const now = Date.now()
    setForm((prev) => {
      let effective = readNumber(prev.lamTimerEffectiveAccSec)
      let dead = readNumber(prev.lamTimerDeadAccSec)
      if (readString(prev.lamTimerState) === "running" && readNumber(prev.lamTimerLastResumeAtMs) > 0) {
        effective += (now - readNumber(prev.lamTimerLastResumeAtMs)) / 1000
      }
      if (readString(prev.lamTimerState) === "paused" && readNumber(prev.lamTimerPauseAtMs) > 0) {
        dead += (now - readNumber(prev.lamTimerPauseAtMs)) / 1000
      }
      return {
        ...prev,
        lamTimerState: nextState,
        lamTimerEffectiveAccSec: effective,
        lamTimerDeadAccSec: dead,
        lamTimerPauseAtMs: 0,
        lamTimerLastResumeAtMs: 0,
      }
    })
  }

  async function guardar() {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    const operador = readString(form.lamOperador).trim()
    if (!operador) {
      toast.error("Laminación: debe indicar el operador antes de guardar.")
      return
    }
    setSaving(true)
    try {
      await apiFetch(`work-orders/${workOrderId}/orden-trabajo`, {
        method: "PUT",
        body: JSON.stringify({
          form,
          origin_area: "laminacion",
          notify_on_production_save: true,
        }),
      })
      toast.success("Control de laminación guardado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar control de laminación.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de laminación…</p>

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Datos de pedido / OT (solo lectura)</h3>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>Actualizar</Button>
        </div>
        <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-muted-foreground">OT:</span> {readString(prefill.code) || "—"}</div>
          <div><span className="text-muted-foreground">Cliente:</span> {readString(form.cliente) || "—"}</div>
          <div><span className="text-muted-foreground">Producto:</span> {readString(form.producto) || "—"}</div>
          <div><span className="text-muted-foreground">CPE:</span> {readString(form.cpe) || "—"}</div>
          <div><span className="text-muted-foreground">Estructura:</span> {readString(form.estructuraMaterial) || "—"}</div>
          <div><span className="text-muted-foreground">Tipo impresión:</span> {readString(form.tipoImpresionEstructura || form.tipoImpresion) || "—"}</div>
          <div><span className="text-muted-foreground">Gramaje adhesivo:</span> {readString(form.gramajeAdhesivo) || "—"}</div>
          <div><span className="text-muted-foreground">Relación mezcla:</span> {readString(form.relacionMezcla) || "—"}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="text-sm font-medium">Tiempo de Arranque</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{readString(prefill.code) || `OT-${workOrderId}`}</Badge>
          <Badge variant={timerStopped ? "default" : "secondary"}>{timerStopped ? "Completada" : "Pendiente"}</Badge>
          <span className="font-mono">{formatTimerHms(totalSec)}</span>
        </div>
      </div>

      <WorkOrderLaminacionOpsSection
        pedidoTotalKg={pedidoTotalKg}
        producidoAcumuladoKg={producidoAcumuladoKg}
        faltanteKg={faltanteKg}
        turnosRegistrados={turnosRegistrados}
        totalEntradaImpresa={totalEntradaImpresa}
        totalEntradaVirgen={totalEntradaVirgen}
        totalSalida={totalSalida}
        totalScrap={totalScrap}
        ultimoTurnoLabel={ultimoTurnoLabel}
        timerState={timerState}
        totalSec={totalSec}
        deadSec={deadSec}
        effectiveSec={effectiveSec}
        kgHora={kgHora}
        timerRunning={timerRunning}
        timerPaused={timerPaused}
        timerStopped={timerStopped}
        pauseReasons={pauseReasons}
        pauseReason={pauseReason}
        pauseObs={pauseObs}
        pauseEntries={pauseEntries}
        turno={readString(form.lamTurno)}
        grupo={readString(form.lamGrupo)}
        operador={readString(form.lamOperador)}
        ayudante={readString(form.lamAyudante)}
        supervisor={readString(form.lamSupervisor)}
        entradaImpresaBobinas={entradaImpresaBobinas}
        entradaVirgenBobinas={entradaVirgenBobinas}
        salidaBobinas={salidaBobinas}
        metrajeRaw={readNumberString(form.lamMetrajeProduccion)}
        adhesivoEntradaRaw={readNumberString(form.lamAdhesivoEntradaKg)}
        adhesivoSobroRaw={readNumberString(form.lamAdhesivoSobroKg)}
        catalizadorEntradaRaw={readNumberString(form.lamCatalizadorEntradaKg)}
        catalizadorSobroRaw={readNumberString(form.lamCatalizadorSobroKg)}
        acetatoEntradaRaw={readNumberString(form.lamAcetatoEntradaLt)}
        acetatoSobroRaw={readNumberString(form.lamAcetatoSobroLt)}
        scrapTransparenteRaw={readNumberString(form.lamScrapTransparenteKg)}
        scrapImpresoRaw={readNumberString(form.lamScrapImpresoKg)}
        scrapLaminadoRaw={readNumberString(form.lamScrapLaminadoKg)}
        mermaCalc={mermaCalc}
        refilPct={refilPct}
        formatTimerHms={formatTimerHms}
        setPauseReason={setPauseReason}
        setPauseObs={setPauseObs}
        startProductionTimer={startProductionTimer}
        pauseProductionTimer={pauseProductionTimer}
        stopProductionTimer={stopProductionTimer}
        confirmPauseAndResume={confirmPauseAndResume}
        onSetTurno={(v) => setKey(setForm, "lamTurno", v)}
        onSetGrupo={(v) => setKey(setForm, "lamGrupo", v)}
        onSetOperador={(v) => setKey(setForm, "lamOperador", v)}
        onSetAyudante={(v) => setKey(setForm, "lamAyudante", v)}
        onSetSupervisor={(v) => setKey(setForm, "lamSupervisor", v)}
        onEntradaImpresaChange={(idx, v) => {
          const next = [...entradaImpresaBobinas]
          next[idx] = v
          setNumericSeries(setForm, "lamEntradaImpresaBobinasKg", next)
        }}
        onEntradaVirgenChange={(idx, v) => {
          const next = [...entradaVirgenBobinas]
          next[idx] = v
          setNumericSeries(setForm, "lamEntradaVirgenBobinasKg", next)
        }}
        onSalidaChange={(idx, v) => {
          const next = [...salidaBobinas]
          next[idx] = v
          setNumericSeries(setForm, "lamSalidaBobinasKg", next)
        }}
        onSetMetraje={(v) => setKey(setForm, "lamMetrajeProduccion", v)}
        onSetAdhesivoEntrada={(v) => setKey(setForm, "lamAdhesivoEntradaKg", v)}
        onSetAdhesivoSobro={(v) => setKey(setForm, "lamAdhesivoSobroKg", v)}
        onSetCatalizadorEntrada={(v) => setKey(setForm, "lamCatalizadorEntradaKg", v)}
        onSetCatalizadorSobro={(v) => setKey(setForm, "lamCatalizadorSobroKg", v)}
        onSetAcetatoEntrada={(v) => setKey(setForm, "lamAcetatoEntradaLt", v)}
        onSetAcetatoSobro={(v) => setKey(setForm, "lamAcetatoSobroLt", v)}
        onSetScrapTransparente={(v) => setKey(setForm, "lamScrapTransparenteKg", v)}
        onSetScrapImpreso={(v) => setKey(setForm, "lamScrapImpresoKg", v)}
        onSetScrapLaminado={(v) => setKey(setForm, "lamScrapLaminadoKg", v)}
      />

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 text-sm font-medium">Observaciones</div>
        <Textarea value={readString(form.lamObservaciones)} onChange={(e) => setKey(setForm, "lamObservaciones", e.target.value)} placeholder="Observaciones adicionales..." />
      </div>

      <div className="no-print mb-12 flex justify-center">
        <Button type="button" onClick={() => void guardar()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

    </div>
  )
}
