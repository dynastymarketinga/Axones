"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Layers, Package } from "lucide-react"

import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { WindingFigurePicker } from "./WindingFigurePicker"
import WorkOrderLaminacionOpsSection, {
  type LamArchivedTurnEntry,
  type LamLabelEditorMode,
} from "./WorkOrderLaminacionOpsSection"
import type { BobinaLabelMeta } from "./WorkOrderPrintingOpsSection"
import "./work-order-planilla.css"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

type LaminacionPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }
type SustratoRow = { material_id: string; kg: string; material_free_text?: string }
const MIN_SUSTRATO_ROWS = 1
/** Casillas por rejilla (entrada impresa, virgen y salida laminada). */
const LAM_BOBINAS_SLOTS = 30

const LAM_TURNOS_HISTORIAL_KEY = "lamTurnosHistorial"

function parseLamTurnosHistorial(form: Record<string, unknown>): LamArchivedTurnEntry[] {
  const raw = form[LAM_TURNOS_HISTORIAL_KEY]
  if (!Array.isArray(raw)) return []
  const out: LamArchivedTurnEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const pausesRaw = o.pauses
    const pauses = Array.isArray(pausesRaw)
      ? pausesRaw
          .map((x) => x as Record<string, unknown>)
          .map((x) => ({
            at: readString(x.at),
            reason: readString(x.reason),
            obs: readString(x.obs),
            duration_sec: readNumber(x.duration_sec),
          }))
          .filter((x) => x.reason !== "")
      : []
    out.push({
      id: readString(o.id) || `lam_${out.length}`,
      closed_at: readString(o.closed_at),
      outcome: o.outcome === "orden_finalizada" ? "orden_finalizada" : "turno_cerrado",
      turno: readString(o.turno),
      grupo: readString(o.grupo),
      operador: readString(o.operador),
      ayudante: readString(o.ayudante),
      supervisor: readString(o.supervisor),
      effective_sec: readNumber(o.effective_sec),
      dead_sec: readNumber(o.dead_sec),
      total_salida_kg: readNumber(o.total_salida_kg),
      pauses,
    })
  }
  return out
}

function snapshotSalidaKgFromForm(prev: Record<string, unknown>): number {
  const raw = prev.lamSalidaBobinasKg
  if (!Array.isArray(raw)) return 0
  return raw.reduce((acc: number, v) => acc + readNumber(v), 0)
}

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

function ensureMinSustratoRows(rows: SustratoRow[], minRows = MIN_SUSTRATO_ROWS): SustratoRow[] {
  const next = [...rows]
  while (next.length < minRows) next.push({ material_id: "", kg: "", material_free_text: "" })
  return next
}

function getSustratosLamRows(form: Record<string, unknown>): SustratoRow[] {
  const raw = form.sustratosVirgenLam
  if (!Array.isArray(raw)) return ensureMinSustratoRows([])
  const out: SustratoRow[] = raw.map((r) => {
    const o = r as Record<string, unknown>
    return {
      material_id: readString(o.material_id),
      kg: readNumberString(o.kg),
      material_free_text: readString(o.material_free_text),
    }
  })
  return ensureMinSustratoRows(out)
}

/** Si no hay pesos en la rejilla virgen, copia kg de cada fila de sustratosVirgenLam a casillas consecutivas. */
function hydrateVirgenBobinasFromSustratos(form: Record<string, unknown>): Record<string, unknown> {
  const series = getNumericSeries(form, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS)
  const hasAnyBobina = series.some((v) => readNumber(v) > 0)
  if (hasAnyBobina) return form

  const rows = getSustratosLamRows(form).filter((r) => readNumber(r.kg) > 0)
  if (rows.length === 0) return form

  const next = [...series]
  let slot = 0
  for (const r of rows) {
    if (slot >= LAM_BOBINAS_SLOTS) break
    next[slot] = normalizeNumericString(r.kg)
    slot += 1
  }
  return { ...form, lamEntradaVirgenBobinasKg: next }
}

function formatTimerHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, "0")
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

function buildLaminacionDemoForm(prefill: Record<string, unknown>): Record<string, unknown> {
  return {
    ...prefill,
    figuraEmbobinadoLam: "3",
    gramajeAdhesivo: readString(prefill.gramajeAdhesivo) || "1.8",
    relacionMezcla: readString(prefill.relacionMezcla) || "100/80",
    obsLaminacion: "Vista demo para revisar distribución de la planilla.",
    sustratosVirgenLam: [{ material_id: "", kg: "430" }],
    kgEntradaLam: "430",
    kgSalidaLam: "420",
    metrajeLam: "5800",
    mermaLam: "10",
    kgEntradaLam2: "120",
    kgSalidaLam2: "116",
    metrajeLam2: "1700",
    mermaLam2: "4",
    lamTurno: "diurno",
    lamGrupo: "A",
    lamOperador: "Operador demo",
    lamAyudante: "Ayudante demo",
    lamSupervisor: "Supervisor demo",
  }
}

function hasLaminacionSavedData(form: Record<string, unknown> | null | undefined): boolean {
  if (!form || typeof form !== "object") return false
  const f = form as Record<string, unknown>
  const singleKeys = [
    "lamTurno",
    "lamGrupo",
    "lamOperador",
    "lamAyudante",
    "lamSupervisor",
    "lamMetrajeProduccion",
    "lamAdhesivoEntradaKg",
    "lamAdhesivoSobroKg",
    "lamCatalizadorEntradaKg",
    "lamCatalizadorSobroKg",
    "lamAcetatoEntradaLt",
    "lamAcetatoSobroLt",
    "lamScrapTransparenteKg",
    "lamScrapImpresoKg",
    "lamScrapLaminadoKg",
    "lamObservaciones",
    "lamTimerState",
    "lamEntradaVirgenRechazadasKg",
    "lamEntradaVirgenMaterialesBuenosKg",
  ]

  for (const key of singleKeys) {
    const value = f[key]
    if (typeof value === "string" && value.trim() !== "") return true
    if (typeof value === "number" && Number.isFinite(value) && value !== 0) return true
  }

  const seriesKeys = ["lamEntradaImpresaBobinasKg", "lamEntradaVirgenBobinasKg", "lamSalidaBobinasKg"]
  for (const key of seriesKeys) {
    const raw = f[key]
    if (!Array.isArray(raw)) continue
    if (raw.some((v) => readNumber(v) > 0)) return true
  }

  const hist = f[LAM_TURNOS_HISTORIAL_KEY]
  if (Array.isArray(hist) && hist.length > 0) return true

  return false
}

export default function WorkOrderLaminacionControlPanel({ workOrderId }: { workOrderId: number }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [timerTick, setTimerTick] = useState(0)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [isDemoPrefill, setIsDemoPrefill] = useState(false)
  const [labelEditorOpen, setLabelEditorOpen] = useState(false)
  const [labelEditorMode, setLabelEditorMode] = useState<LamLabelEditorMode>("virgen")
  const [labelEditorIndex, setLabelEditorIndex] = useState(0)
  const [labelEditorDraft, setLabelEditorDraft] = useState<BobinaLabelMeta>(emptyBobinaLabelMeta())
  const [labelEditorError, setLabelEditorError] = useState("")

  const markAsUserEdited = useCallback(() => {
    setIsDemoPrefill(false)
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      const basePrefill = payload.prefill ?? {}
      setPrefill(basePrefill)
      if (hasLaminacionSavedData(payload.form)) {
        setForm(hydrateVirgenBobinasFromSustratos(mergePrefill(basePrefill, payload.form)))
        setIsDemoPrefill(false)
      } else {
        const withDemo = mergePrefill(basePrefill, buildLaminacionDemoForm(basePrefill))
        setForm(hydrateVirgenBobinasFromSustratos(mergePrefill(withDemo, payload.form ?? {})))
        setIsDemoPrefill(true)
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT para laminación.")
      setPrefill({})
      setForm({})
      setIsDemoPrefill(false)
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
  const totalEntradaImpresa = useMemo(() => entradaImpresaBobinas.reduce((acc, v) => acc + readNumber(v), 0), [entradaImpresaBobinas])
  const totalEntradaVirgen = useMemo(() => entradaVirgenBobinas.reduce((acc, v) => acc + readNumber(v), 0), [entradaVirgenBobinas])
  const sustratosLam = useMemo(() => getSustratosLamRows(form), [form])
  const materialById = useMemo(() => {
    const map = new Map<string, MaterialRow>()
    for (const m of materials) map.set(String(m.id), m)
    return map
  }, [materials])
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
  const lamArchivedTurns = useMemo(() => parseLamTurnosHistorial(form), [form])
  const turnosRegistrados =
    lamArchivedTurns.length > 0
      ? lamArchivedTurns.length
      : Math.max(0, Math.floor(readNumber(form.lamRegistrosTurnos)))

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
    markAsUserEdited()
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
    markAsUserEdited()
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
    markAsUserEdited()
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
    markAsUserEdited()
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

      const prevState = readString(prev.lamTimerState)
      const pausesSnapshot = Array.isArray(prev.lamTimerPauses)
        ? (prev.lamTimerPauses as LaminacionPauseEntry[]).map((p) => ({ ...p }))
        : []
      const shouldArchive =
        effective + dead > 0.01 ||
        pausesSnapshot.length > 0 ||
        (prevState !== "pending" && prevState !== "")

      let historial = parseLamTurnosHistorial(prev)
      if (shouldArchive) {
        historial = [
          ...historial,
          {
            id: `lam_${now}_${historial.length}`,
            closed_at: new Date(now).toISOString(),
            outcome: nextState === "completed" ? "orden_finalizada" : "turno_cerrado",
            turno: readString(prev.lamTurno),
            grupo: readString(prev.lamGrupo),
            operador: readString(prev.lamOperador),
            ayudante: readString(prev.lamAyudante),
            supervisor: readString(prev.lamSupervisor),
            effective_sec: effective,
            dead_sec: dead,
            total_salida_kg: snapshotSalidaKgFromForm(prev),
            pauses: pausesSnapshot,
          },
        ]
      }

      const registros = shouldArchive ? historial.length : Math.max(0, Math.floor(readNumber(prev.lamRegistrosTurnos)))

      if (nextState === "stopped") {
        return {
          ...prev,
          [LAM_TURNOS_HISTORIAL_KEY]: historial,
          lamRegistrosTurnos: registros,
          lamTimerState: "pending",
          lamTimerEffectiveAccSec: 0,
          lamTimerDeadAccSec: 0,
          lamTimerStartedAtMs: 0,
          lamTimerPauseAtMs: 0,
          lamTimerLastResumeAtMs: 0,
          lamTimerPauses: [],
        }
      }

      return {
        ...prev,
        [LAM_TURNOS_HISTORIAL_KEY]: historial,
        lamRegistrosTurnos: registros,
        lamTimerState: "completed",
        lamTimerEffectiveAccSec: effective,
        lamTimerDeadAccSec: dead,
        lamTimerPauseAtMs: 0,
        lamTimerLastResumeAtMs: 0,
      }
    })
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
    const normalized = normalizeBobinaLabelMeta(labelEditorDraft)
    const hasAnyValue = Object.values(normalized).some((v) => v !== "")
    const fechaPattern = /^\d{2}\/\d{2}\/\d{4}$/
    if (hasAnyValue && !fechaPattern.test(normalized.fecha)) {
      setLabelEditorError("Fecha obligatoria con formato dd/mm/aaaa.")
      return
    }

    const key =
      labelEditorMode === "impresa"
        ? "lamEntradaImpresaBobinasMeta"
        : labelEditorMode === "virgen"
          ? "lamEntradaVirgenBobinasMeta"
          : "lamSalidaBobinasMeta"

    markAsUserEdited()
    setForm((prev) => {
      const next = getMetaSeries(prev, key, LAM_BOBINAS_SLOTS)
      next[labelEditorIndex] = normalized
      return { ...prev, [key]: next }
    })
    setLabelEditorOpen(false)
    setLabelEditorError("")
  }

  async function guardar() {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    const operador = readString(form.lamOperador).trim()
    if (!operador) {
      toast.error("Laminación: debe indicar el operador antes de guardar.")
      return
    }
    const normalizedForm: Record<string, unknown> = {
      ...form,
      lamEntradaImpresaBobinasKg: entradaImpresaBobinas.map((v) => normalizeNumericString(v)),
      lamEntradaVirgenBobinasKg: entradaVirgenBobinas.map((v) => normalizeNumericString(v)),
      lamEntradaVirgenRechazadasKg: normalizeNumericString(form.lamEntradaVirgenRechazadasKg),
      lamEntradaVirgenMaterialesBuenosKg: normalizeNumericString(form.lamEntradaVirgenMaterialesBuenosKg),
      lamSalidaBobinasKg: salidaBobinas.map((v) => normalizeNumericString(v)),
      lamEntradaImpresaBobinasMeta: entradaImpresaBobinasMeta.map((m) => normalizeBobinaLabelMeta(m)),
      lamEntradaVirgenBobinasMeta: entradaVirgenBobinasMeta.map((m) => normalizeBobinaLabelMeta(m)),
      lamSalidaBobinasMeta: salidaBobinasMeta.map((m) => normalizeBobinaLabelMeta(m)),
    }
    setSaving(true)
    try {
      await apiFetch(`work-orders/${workOrderId}/orden-trabajo`, {
        method: "PUT",
        body: JSON.stringify({
          form: normalizedForm,
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
    <div className="ax-mes space-y-4">
      <WorkOrderStageBadge current="produccion" />
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
                <input
                  className="ot-input"
                  value={readString(form.gramajeAdhesivo)}
                  placeholder="1,5 a 2,0"
                  readOnly
                />
              </div>
              <div className="ot-field">
                <label className="ot-label">Relacion mezcla</label>
                <input
                  className="ot-input"
                  value={readString(form.relacionMezcla)}
                  placeholder="100/80"
                  readOnly
                />
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
                        <input
                          className="ot-input"
                          value={materialLabel}
                          placeholder="Seleccionar del inventario..."
                          readOnly
                        />
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Kg a utilizar</label>
                        <input
                          className="ot-input"
                          value={r.kg}
                          placeholder="Ej: 430"
                          readOnly
                        />
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
        archivedTurns={lamArchivedTurns}
        turno={readString(form.lamTurno)}
        grupo={readString(form.lamGrupo)}
        operador={readString(form.lamOperador)}
        ayudante={readString(form.lamAyudante)}
        supervisor={readString(form.lamSupervisor)}
        entradaImpresaBobinas={entradaImpresaBobinas}
        entradaImpresaMeta={entradaImpresaBobinasMeta}
        entradaVirgenBobinas={entradaVirgenBobinas}
        entradaVirgenMeta={entradaVirgenBobinasMeta}
        salidaBobinas={salidaBobinas}
        salidaMeta={salidaBobinasMeta}
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
        onSetTurno={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamTurno", v)
        }}
        onSetGrupo={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamGrupo", v)
        }}
        onSetOperador={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamOperador", v)
        }}
        onSetAyudante={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamAyudante", v)
        }}
        onSetSupervisor={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamSupervisor", v)
        }}
        onEntradaImpresaChange={(idx, v) => {
          markAsUserEdited()
          const next = [...entradaImpresaBobinas]
          next[idx] = v
          setNumericSeries(setForm, "lamEntradaImpresaBobinasKg", next)
        }}
        onOpenImpresaLabel={(idx) => openLabelEditor("impresa", idx)}
        onEntradaVirgenChange={(idx, v) => {
          markAsUserEdited()
          const next = [...entradaVirgenBobinas]
          next[idx] = v
          setNumericSeries(setForm, "lamEntradaVirgenBobinasKg", next)
        }}
        onOpenVirgenLabel={(idx) => openLabelEditor("virgen", idx)}
        onSalidaChange={(idx, v) => {
          markAsUserEdited()
          const next = [...salidaBobinas]
          next[idx] = v
          setNumericSeries(setForm, "lamSalidaBobinasKg", next)
        }}
        onOpenSalidaLabel={(idx) => openLabelEditor("salida", idx)}
        onSetMetraje={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamMetrajeProduccion", v)
        }}
        onSetAdhesivoEntrada={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamAdhesivoEntradaKg", v)
        }}
        onSetAdhesivoSobro={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamAdhesivoSobroKg", v)
        }}
        onSetCatalizadorEntrada={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamCatalizadorEntradaKg", v)
        }}
        onSetCatalizadorSobro={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamCatalizadorSobroKg", v)
        }}
        onSetAcetatoEntrada={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamAcetatoEntradaLt", v)
        }}
        onSetAcetatoSobro={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamAcetatoSobroLt", v)
        }}
        onSetScrapTransparente={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamScrapTransparenteKg", v)
        }}
        onSetScrapImpreso={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamScrapImpresoKg", v)
        }}
        onSetScrapLaminado={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamScrapLaminadoKg", v)
        }}
        virgenRechazadasKgRaw={readNumberString(form.lamEntradaVirgenRechazadasKg)}
        virgenMaterialesBuenosKgRaw={readNumberString(form.lamEntradaVirgenMaterialesBuenosKg)}
        onSetVirgenRechazadasKg={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamEntradaVirgenRechazadasKg", v)
        }}
        onSetVirgenMaterialesBuenosKg={(v) => {
          markAsUserEdited()
          setKey(setForm, "lamEntradaVirgenMaterialesBuenosKg", v)
        }}
        labelEditorOpen={labelEditorOpen}
        labelEditorMode={labelEditorMode}
        labelEditorIndex={labelEditorIndex}
        labelEditorDraft={labelEditorDraft}
        labelEditorError={labelEditorError}
        onLabelOpenChange={setLabelEditorOpen}
        onLabelDraftChange={updateLabelDraft}
        onLabelClear={clearLabelEditor}
        onLabelSave={saveLabelEditor}
      />

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 text-sm font-medium">Observaciones</div>
        <Textarea
          value={readString(form.lamObservaciones)}
          onChange={(e) => {
            markAsUserEdited()
            setKey(setForm, "lamObservaciones", e.target.value)
          }}
          placeholder="Observaciones adicionales..."
        />
      </div>

      <div className="no-print mb-12 flex justify-center">
        <Button type="button" onClick={() => void guardar()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

    </div>
  )
}
