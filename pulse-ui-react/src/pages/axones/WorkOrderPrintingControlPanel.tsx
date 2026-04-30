"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import WorkOrderPrintingOpsSection, { type BobinaLabelMeta } from "./WorkOrderPrintingOpsSection"
import "./work-order-planilla.css"

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
  returnType: "buena" | "rechazada"
  materialId: string
  bobinaCode: string
  quantity: string
  reason: string
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

export default function WorkOrderPrintingControlPanel({ workOrderId }: { workOrderId: number }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [productionSummary, setProductionSummary] = useState<ProductionSummaryPayload | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      setPrefill(payload.prefill ?? {})
      const mergedForm = mergePrefill(payload.prefill ?? {}, payload.form)
      setForm({
        ...mergedForm,
        // Scrap del turno siempre inicia en 0 para nueva captura operativa.
        impScrapTransparenteKg: "0",
        impScrapImpresoKg: "0",
      })
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
  const formProducidoAcumuladoKg = formProducedBaseline > 0 ? formProducedBaseline : totalSalida
  const producidoAcumuladoKg = hasHistoricalPrinting ? historicalSalida : formProducidoAcumuladoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const formTurnosRegistrados = Math.max(0, Math.floor(readNumber(form.impRegistrosTurnos)))
  const turnosRegistrados = hasHistoricalPrinting ? inferredHistoricalTurns : formTurnosRegistrados
  const totalEntradaAcumulada = hasHistoricalPrinting ? historicalEntrada : totalEntradaTurnoActual
  const formScrapAcumulado = readNumber(form.impScrapAcumuladoKg)
  const totalScrapAcumulado = formScrapAcumulado > 0 ? formScrapAcumulado : totalScrap
  const hasOpenHistoricalProductionSegment =
    summaryPrinting?.open_time_segment?.segment_type === "production" &&
    !summaryPrinting?.open_time_segment?.ended_at
  const formUltimoTurnoLabel =
    readString(form.impTimerState) === "completed"
      ? "Turno finalizado"
      : readString(form.impTimerState) === "stopped"
        ? "Turno cerrado"
        : formTurnosRegistrados > 0
          ? "Turno cerrado"
          : "Sin producción previa"
  const ultimoTurnoLabel = hasHistoricalPrinting
    ? hasOpenHistoricalProductionSegment
      ? "Turno en ejecución"
      : turnosRegistrados > 0
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
  const [returnLoadingMaterials, setReturnLoadingMaterials] = useState(false)
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnMaterialOptions, setReturnMaterialOptions] = useState<MaterialRow[]>([])
  const [returnDraft, setReturnDraft] = useState<ReturnDraft>({
    returnType: "buena",
    materialId: "",
    bobinaCode: "",
    quantity: "",
    reason: "",
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
  const timerStopped = timerState === "stopped" || timerState === "completed"
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
  ])

  useEffect(() => {
    if (!timerRunning && !timerPaused) return
    const id = window.setInterval(() => setTimerTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [timerPaused, timerRunning])

  function startProductionTimer() {
    const now = Date.now()
    setForm((prev) => ({
      ...prev,
      impTimerState: "running",
      impTimerStartedAtMs: readNumber(prev.impTimerStartedAtMs) || now,
      impTimerLastResumeAtMs: now,
      impTimerPauseAtMs: 0,
      impTimerEffectiveAccSec: readNumber(prev.impTimerEffectiveAccSec),
      impTimerDeadAccSec: readNumber(prev.impTimerDeadAccSec),
    }))
  }

  function pauseProductionTimer() {
    if (!timerRunning) return
    const now = Date.now()
    setForm((prev) => ({
      ...prev,
      impTimerState: "paused",
      impTimerEffectiveAccSec:
        readNumber(prev.impTimerEffectiveAccSec) +
        (readNumber(prev.impTimerLastResumeAtMs) > 0 ? (now - readNumber(prev.impTimerLastResumeAtMs)) / 1000 : 0),
      impTimerPauseAtMs: now,
      impTimerLastResumeAtMs: 0,
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
      const rows = Array.isArray(prev.impTimerPauses) ? (prev.impTimerPauses as PrintingPauseEntry[]) : []
      return {
        ...prev,
        impTimerState: "running",
        impTimerDeadAccSec: readNumber(prev.impTimerDeadAccSec) + pauseDurationSec,
        impTimerPauseAtMs: 0,
        impTimerLastResumeAtMs: now,
        impTimerPauses: [
          ...rows,
          {
            at: new Date(now).toISOString(),
            reason: pauseReason,
            obs: pauseObs.trim(),
            duration_sec: pauseDurationSec,
          },
        ],
      }
    })
    setPauseReason("")
    setPauseObs("")
  }

  function stopProductionTimer(nextState: "stopped" | "completed") {
    const now = Date.now()
    setForm((prev) => {
      let effective = readNumber(prev.impTimerEffectiveAccSec)
      let dead = readNumber(prev.impTimerDeadAccSec)
      if (readString(prev.impTimerState) === "running" && readNumber(prev.impTimerLastResumeAtMs) > 0) {
        effective += (now - readNumber(prev.impTimerLastResumeAtMs)) / 1000
      }
      if (readString(prev.impTimerState) === "paused" && readNumber(prev.impTimerPauseAtMs) > 0) {
        dead += (now - readNumber(prev.impTimerPauseAtMs)) / 1000
      }
      return {
        ...prev,
        impTimerState: nextState,
        impTimerEffectiveAccSec: effective,
        impTimerDeadAccSec: dead,
        impTimerPauseAtMs: 0,
        impTimerLastResumeAtMs: 0,
      }
    })
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

    const key = labelEditorMode === "entrada" ? "impEntradaBobinasMeta" : "impSalidaBobinasMeta"
    const size = labelEditorMode === "entrada" ? 26 : 22
    setForm((prev) => {
      const next = getMetaSeries(prev, key, size)
      next[labelEditorIndex] = normalized
      return { ...prev, [key]: next }
    })
    setLabelEditorOpen(false)
    setLabelEditorError("")
  }

  const loadReturnMaterials = useCallback(async (returnType: "buena" | "rechazada") => {
    const inventoryArea = returnType === "rechazada" ? "bobinas_rechazadas" : "material"
    setReturnLoadingMaterials(true)
    try {
      const res = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { inventory_area: inventoryArea, per_page: 200, page: 1 },
      })
      setReturnMaterialOptions(res.data ?? [])
    } catch {
      setReturnMaterialOptions([])
    } finally {
      setReturnLoadingMaterials(false)
    }
  }, [])

  function openReturnModal() {
    const defaultType: "buena" | "rechazada" = "buena"
    const defaultQty = normalizeNumericString(
      defaultType === "buena" ? form.impDevolucionBuenaKg : form.impDevolucionRechazadaKg,
    )
    setReturnDraft({
      returnType: defaultType,
      materialId: "",
      bobinaCode: "",
      quantity: defaultQty,
      reason: "",
    })
    setReturnModalOpen(true)
    void loadReturnMaterials(defaultType)
  }

  function onReturnTypeChange(nextType: "buena" | "rechazada") {
    setReturnDraft((prev) => ({
      ...prev,
      returnType: nextType,
      materialId: "",
      quantity: normalizeNumericString(
        nextType === "buena" ? form.impDevolucionBuenaKg : form.impDevolucionRechazadaKg,
      ),
    }))
    void loadReturnMaterials(nextType)
  }

  async function submitReturn() {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    const materialId = Number(returnDraft.materialId)
    const quantity = Number(returnDraft.quantity.trim().replace(",", "."))
    if (!Number.isFinite(materialId) || materialId < 1) {
      toast.error("Seleccione el material de la devolución.")
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("La cantidad debe ser mayor a 0.")
      return
    }

    const destinationArea =
      returnDraft.returnType === "rechazada" ? "bobinas_rechazadas" : "material"
    const reasonParts = [returnDraft.reason.trim()]
    if (returnDraft.bobinaCode.trim()) {
      reasonParts.push(`Bobina: ${returnDraft.bobinaCode.trim()}`)
    }
    const reasonText = reasonParts.filter(Boolean).join(" · ")

    setReturnSubmitting(true)
    try {
      const created = await apiFetch<InventoryReturnCreated>("inventory-returns", {
        method: "POST",
        body: JSON.stringify({
          material_id: materialId,
          work_order_id: returnDraft.returnType === "rechazada" ? workOrderId : null,
          destination_area: destinationArea,
          quantity: quantity.toFixed(3),
          reason: reasonText || null,
        }),
      })
      await apiFetch(`inventory-returns/${created.id}/accept`, { method: "POST" })
      setForm((prev) => ({
        ...prev,
        ...(returnDraft.returnType === "buena"
          ? { impDevolucionBuenaKg: normalizeNumericString(quantity) }
          : { impDevolucionRechazadaKg: normalizeNumericString(quantity) }),
      }))
      setReturnModalOpen(false)
      toast.success("Devolución registrada en inventario.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la devolución.")
    } finally {
      setReturnSubmitting(false)
    }
  }

  async function guardar() {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    const operador = readString(form.impOperador).trim()
    const turno = readString(form.impTurno).trim()
    const grupo = readString(form.impGrupo).trim()
    if (!operador || !turno || !grupo) {
      toast.error("Impresión: complete turno, grupo y operador antes de guardar.")
      return
    }
    if (outlierWarnings.length > 0) {
      toast.warning(`Se detectaron ${outlierWarnings.length} valores atípicos. Se guardará de todas formas.`)
    }
    const normalizedForm: Record<string, unknown> = {
      ...form,
      impEntradaBobinasKg: entradaBobinas.map((v) => normalizeNumericString(v)),
      impSalidaBobinasKg: salidaBobinas.map((v) => normalizeNumericString(v)),
      impEntradaBobinasMeta: entradaBobinasMeta.map((m) => normalizeBobinaLabelMeta(m)),
      impSalidaBobinasMeta: salidaBobinasMeta.map((m) => normalizeBobinaLabelMeta(m)),
      impDevolucionBuenaKg: normalizeNumericString(form.impDevolucionBuenaKg),
      impDevolucionRechazadaKg: normalizeNumericString(form.impDevolucionRechazadaKg),
      impMetrajeProduccion: normalizeNumericString(form.impMetrajeProduccion),
      impScrapTransparenteKg: normalizeNumericString(form.impScrapTransparenteKg),
      impScrapImpresoKg: normalizeNumericString(form.impScrapImpresoKg),
      impScrapAcumuladoKg: normalizeNumericString(totalScrapAcumulado),
      impMermaKg: normalizeNumericString(form.impMermaKg),
      impTimerEffectiveAccSec: normalizeNumericString(form.impTimerEffectiveAccSec),
      impTimerDeadAccSec: normalizeNumericString(form.impTimerDeadAccSec),
    }
    setSaving(true)
    try {
      await apiFetch(
        `work-orders/${workOrderId}/orden-trabajo/printing-control`,
        {
          method: "PATCH",
          body: JSON.stringify({
            form: normalizedForm,
            origin_area: "impresion",
            notify_on_production_save: true,
          }),
        },
      )
      toast.success("Control de impresión guardado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar control de impresión.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de impresión…</p>

  return (
    <div className="space-y-4">
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
        timerStopped={timerStopped}
        pauseReasons={pauseReasons}
        pauseReason={pauseReason}
        pauseObs={pauseObs}
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
        salidaBobinas={salidaBobinas}
        salidaMeta={salidaBobinasMeta}
        mermaCalc={mermaCalc}
        mermaRaw={readNumberString(form.impMermaKg)}
        metrajeRaw={readNumberString(form.impMetrajeProduccion)}
        scrapTransparenteRaw={readNumberString(form.impScrapTransparenteKg)}
        scrapImpresoRaw={readNumberString(form.impScrapImpresoKg)}
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
        stopProductionTimer={stopProductionTimer}
        confirmPauseAndResume={confirmPauseAndResume}
        onSetTurno={(v) => setKey(setForm, "impTurno", v)}
        onSetGrupo={(v) => setKey(setForm, "impGrupo", v)}
        onSetOperador={(v) => setKey(setForm, "impOperador", v)}
        onSetAyudante={(v) => setKey(setForm, "impAyudante", v)}
        onSetSupervisor={(v) => setKey(setForm, "impSupervisor", v)}
        onEntradaChange={(idx, v) => {
          const next = [...entradaBobinas]
          next[idx] = v
          setNumericSeries(setForm, "impEntradaBobinasKg", next)
        }}
        onOpenEntradaLabel={(idx) => openLabelEditor("entrada", idx)}
        onSetDevolucionBuena={(v) => setKey(setForm, "impDevolucionBuenaKg", v)}
        onSetDevolucionRechazada={(v) => setKey(setForm, "impDevolucionRechazadaKg", v)}
        onOpenReturnModal={openReturnModal}
        onSalidaChange={(idx, v) => {
          const next = [...salidaBobinas]
          next[idx] = v
          setNumericSeries(setForm, "impSalidaBobinasKg", next)
        }}
        onOpenSalidaLabel={(idx) => openLabelEditor("salida", idx)}
        onSetMerma={(v) => setKey(setForm, "impMermaKg", v)}
        onSetMetraje={(v) => setKey(setForm, "impMetrajeProduccion", v)}
        onSetScrapTransparente={(v) => setKey(setForm, "impScrapTransparenteKg", v)}
        onSetScrapImpreso={(v) => setKey(setForm, "impScrapImpresoKg", v)}
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
      />

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 text-sm font-medium">Observaciones</div>
        <Textarea
          value={readString(form.impObservaciones)}
          onChange={(e) => setKey(setForm, "impObservaciones", e.target.value)}
          placeholder="Observaciones adicionales..."
        />
      </div>

      <div className="no-print mb-12 flex justify-center">
        <Button type="button" onClick={() => void guardar()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <Dialog
        open={returnModalOpen}
        onOpenChange={(open) => {
          if (!returnSubmitting) setReturnModalOpen(open)
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar devolución en inventario</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="rounded border bg-muted/20 p-2 text-xs">
              OT preseleccionada: <span className="font-semibold">{readString(prefill.code) || `OT-${workOrderId}`}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipo de devolución</Label>
                <select
                  className="ot-select h-9"
                  value={returnDraft.returnType}
                  onChange={(e) =>
                    onReturnTypeChange(e.target.value === "rechazada" ? "rechazada" : "buena")
                  }
                >
                  <option value="buena">Buena (material)</option>
                  <option value="rechazada">Rechazada (bobinas rechazadas)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Cantidad (Kg)</Label>
                <Input
                  inputMode="decimal"
                  value={returnDraft.quantity}
                  onChange={(e) =>
                    setReturnDraft((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                  placeholder="0.000"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Material</Label>
              <select
                className="ot-select h-9"
                value={returnDraft.materialId}
                onChange={(e) =>
                  setReturnDraft((prev) => ({ ...prev, materialId: e.target.value }))
                }
                disabled={returnLoadingMaterials}
              >
                <option value="">
                  {returnLoadingMaterials ? "Cargando materiales..." : "Seleccione material"}
                </option>
                {returnMaterialOptions.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.sku} · {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Bobina / referencia (opcional)</Label>
              <Input
                value={returnDraft.bobinaCode}
                onChange={(e) =>
                  setReturnDraft((prev) => ({ ...prev, bobinaCode: e.target.value }))
                }
                placeholder="Código bobina o etiqueta"
              />
            </div>

            <div className="space-y-1">
              <Label>Motivo</Label>
              <Textarea
                value={returnDraft.reason}
                onChange={(e) =>
                  setReturnDraft((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Motivo de la devolución"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReturnModalOpen(false)}
              disabled={returnSubmitting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submitReturn()} disabled={returnSubmitting}>
              {returnSubmitting ? "Registrando..." : "Registrar devolución"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
