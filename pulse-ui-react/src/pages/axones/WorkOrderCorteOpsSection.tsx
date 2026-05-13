import {
  CirclePause,
  CirclePlay,
  Flag,
  LogOut,
  Moon,
  PlusCircle,
  ReceiptText,
  Scissors,
  Sun,
  Trash2,
  Users,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { MesSectionShell, MesStatTile, MesTimerFace } from "@/components/axones/mes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

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

function readObject(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function formatTimerHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, "0")
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

function getNumericSeries(form: Record<string, unknown>, key: string, size: number): string[] {
  const raw = form[key]
  if (!Array.isArray(raw)) return Array.from({ length: size }, () => "")
  const out = raw.slice(0, size).map((v) => readString(v))
  while (out.length < size) out.push("")
  return out
}

type CortePauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

type Props = {
  form: Record<string, unknown>
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  pedidoTotalKg: number
}

const ROLLOS_PER_PALETA = 48
const MIN_PALETAS = 1

function emptyPaleta(): string[] {
  return Array.from({ length: ROLLOS_PER_PALETA }, () => "")
}

type CorPaleta = {
  id: string
  label: string
  rollosKg: string[]
  status?: "en_progreso" | "cerrada_opcional"
}

type CorTurno = {
  id: string
  closed_at: string
  label?: string
  turno?: string
  grupo?: string
  operador?: string
  ayudante?: string
  supervisor?: string
  metrics?: {
    entrada_bobinas_kg: string
    salida_total_kg: string
    merma_kg: string
    metraje: string
    scrap_total_kg: string
    scrap_refile_kg?: string
    scrap_impreso_kg?: string
    scrap_mal_corte_kg?: string
    rollos_salida: number
    paletas: number
  }
  timer?: {
    total_sec: number
    effective_sec: number
    dead_sec: number
    pauses?: CortePauseEntry[]
  }
  obs?: string
}

function ensureStringArray(raw: unknown, size: number): string[] {
  const out: string[] = []
  if (Array.isArray(raw)) {
    for (const v of raw.slice(0, size)) out.push(readString(v))
  }
  while (out.length < size) out.push("")
  return out
}

function toCorPaletasFromLegacy(form: Record<string, unknown>): CorPaleta[] {
  const raw = form.corSalidaPaletasKg
  if (!Array.isArray(raw)) return []
  return raw.map((p, idx) => ({
    id: `legacy-${idx + 1}`,
    label: `Paleta #${String(idx + 1).padStart(2, "0")}`,
    rollosKg: ensureStringArray(p, ROLLOS_PER_PALETA),
    status: "en_progreso",
  }))
}

function getCorPaletas(form: Record<string, unknown>): CorPaleta[] {
  const raw = form.cor_paletas
  const paletas: CorPaleta[] = []
  if (Array.isArray(raw)) {
    for (const p of raw) {
      const o = readObject(p)
      const id = readString(o.id)
      const label = readString(o.label) || "Paleta"
      if (!id) continue
      paletas.push({
        id,
        label,
        rollosKg: ensureStringArray(o.rollosKg, ROLLOS_PER_PALETA),
        status: (readString(o.status) as CorPaleta["status"]) || "en_progreso",
      })
    }
  }

  const fromLegacy = paletas.length === 0 ? toCorPaletasFromLegacy(form) : []
  const merged = paletas.length > 0 ? paletas : fromLegacy

  if (merged.length === 0) {
    return [
      {
        id: "p-01",
        label: "Paleta #01",
        rollosKg: emptyPaleta(),
        status: "en_progreso",
      },
    ]
  }

  while (merged.length < MIN_PALETAS) {
    merged.push({
      id: `p-${String(merged.length + 1).padStart(2, "0")}`,
      label: `Paleta #${String(merged.length + 1).padStart(2, "0")}`,
      rollosKg: emptyPaleta(),
      status: "en_progreso",
    })
  }
  return merged
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export default function WorkOrderCorteOpsSection({ form, setForm, pedidoTotalKg }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const entradaBobinas = useMemo(() => getNumericSeries(form, "corEntradaBobinasKg", 14), [form])
  const entradaBobinasCount = useMemo(() => entradaBobinas.filter((v) => Number(v) > 0).length, [entradaBobinas])
  const entradaBobinasTotal = useMemo(() => entradaBobinas.reduce((acc, v) => acc + readNumber(v), 0), [entradaBobinas])
  const corPaletas = useMemo(() => getCorPaletas(form), [form])
  const salidaPaletas = useMemo(() => corPaletas.map((p) => p.rollosKg), [corPaletas])
  const salidaPaletasTotales = useMemo(
    () => salidaPaletas.map((p) => p.reduce((acc, v) => acc + readNumber(v), 0)),
    [salidaPaletas],
  )
  const salidaPaletasRollos = useMemo(
    () => salidaPaletas.map((p) => p.filter((v) => readNumber(v) > 0).length),
    [salidaPaletas],
  )
  const bobinasSalidaCount = useMemo(
    () => salidaPaletasRollos.reduce((acc, n) => acc + n, 0),
    [salidaPaletasRollos],
  )
  const salidaTotalKg = useMemo(
    () => salidaPaletasTotales.reduce((acc, n) => acc + n, 0),
    [salidaPaletasTotales],
  )
  const paletteKgBase = 300
  const paletasEquivalentes = useMemo(() => salidaTotalKg / paletteKgBase, [salidaTotalKg])
  const paletasCompletas = useMemo(() => Math.floor(paletasEquivalentes), [paletasEquivalentes])

  const kgIngresados = readNumber(form.kgIngresadosCorte)
  const kgSalida = salidaTotalKg
  const kgMerma = readNumber(form.kgMermaCorte)
  const metraje = readNumber(form.metrajeCorte)
  const scrapRefile = readNumber(form.corScrapRefileKg)
  const scrapImpreso = readNumber(form.corScrapImpresoKg)
  const scrapMalCorte = readNumber(form.corScrapMalCorteKg)
  const scrapTotal = scrapRefile + scrapImpreso + scrapMalCorte
  const producidoAcumuladoKg = kgSalida
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = Math.max(0, Math.floor(readNumber(form.corRegistrosTurnos)))
  const ultimoTurnoLabel = readString(form.corUltimoTurnoLabel) || "Sin producción previa"

  const timerState = readString(form.corTimerState) || "pending"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const timerStopped = timerState === "stopped" || timerState === "completed"
  const effectiveAcc = readNumber(form.corTimerEffectiveAccSec)
  const deadAcc = readNumber(form.corTimerDeadAccSec)
  const lastResumeAt = readNumber(form.corTimerLastResumeAtMs)
  const pauseAt = readNumber(form.corTimerPauseAtMs)
  const effectiveSec = effectiveAcc + (timerRunning && lastResumeAt > 0 ? (nowMs - lastResumeAt) / 1000 : 0)
  const deadSec = deadAcc + (timerPaused && pauseAt > 0 ? (nowMs - pauseAt) / 1000 : 0)
  const totalSec = effectiveSec + deadSec
  const kgHora = effectiveSec > 0 ? (kgSalida / (effectiveSec / 3600)).toFixed(2) : "0.00"
  const mermaPct = kgIngresados > 0 ? ((kgMerma / kgIngresados) * 100).toFixed(2) : "0.00"
  const refilPct = kgIngresados > 0 ? ((scrapTotal / kgIngresados) * 100).toFixed(2) : "0.00"

  const pauseReasons = [
    "Cambio de cuchillas",
    "Ajuste de corte",
    "Falla mecánica",
    "Falla eléctrica",
    "Problema de calidad",
    "Cambio de pedido",
    "Almuerzo/Descanso",
    "Otro",
  ]

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

  useEffect(() => {
    if (!timerRunning && !timerPaused) return
    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerPaused, timerRunning])

  function setKey(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setNumericSeries(key: string, values: string[]) {
    setForm((prev) => ({ ...prev, [key]: values }))
  }

  function writePaletas(nextPaletas: CorPaleta[]) {
    const nextSalida = nextPaletas
      .map((p) => p.rollosKg)
      .flat()
      .reduce((acc, v) => acc + readNumber(v), 0)
      .toFixed(2)
    setForm((prev) => ({
      ...prev,
      cor_paletas: nextPaletas,
      // compat: claves viejas para no romper reportes/otros cálculos existentes
      corSalidaPaletasKg: nextPaletas.map((p) => p.rollosKg),
      kgSalidaCorte: nextSalida,
      corAcumuladoProducidoKg: Number(nextSalida),
    }))
  }

  function addPaleta() {
    const nextIndex = corPaletas.length + 1
    writePaletas([
      ...corPaletas,
      {
        id: `p-${String(nextIndex).padStart(2, "0")}`,
        label: `Paleta #${String(nextIndex).padStart(2, "0")}`,
        rollosKg: emptyPaleta(),
        status: "en_progreso",
      },
    ])
  }

  function removePaleta(index: number) {
    const target = corPaletas[index]
    const hasAnyKg = (target?.rollosKg ?? []).some((v) => readNumber(v) > 0)
    if (hasAnyKg) {
      const ok = window.confirm(
        "Esta paleta tiene pesos registrados. ¿Seguro que desea eliminarla?",
      )
      if (!ok) return
    }

    const filtered = corPaletas.filter((_, i) => i !== index)
    if (filtered.length >= MIN_PALETAS) {
      writePaletas(filtered)
      return
    }

    writePaletas([
      {
        id: "p-01",
        label: "Paleta #01",
        rollosKg: emptyPaleta(),
        status: "en_progreso",
      },
    ])
  }

  function startProductionTimer() {
    const now = Date.now()
    setForm((prev) => ({
      ...prev,
      cor_turno_actual:
        readString(readObject(prev.cor_turno_actual).id) !== ""
          ? prev.cor_turno_actual
          : {
              id: newId("turno"),
              opened_at: new Date(now).toISOString(),
            },
      corTimerState: "running",
      corTimerStartedAtMs: readNumber(prev.corTimerStartedAtMs) || now,
      corTimerLastResumeAtMs: now,
      corTimerPauseAtMs: 0,
      corTimerEffectiveAccSec: readNumber(prev.corTimerEffectiveAccSec),
      corTimerDeadAccSec: readNumber(prev.corTimerDeadAccSec),
      corUltimoTurnoLabel: "Turno en ejecución",
    }))
  }

  function pauseProductionTimer() {
    if (!timerRunning) return
    const now = Date.now()
    setForm((prev) => ({
      ...prev,
      corTimerState: "paused",
      corTimerEffectiveAccSec:
        readNumber(prev.corTimerEffectiveAccSec) +
        (readNumber(prev.corTimerLastResumeAtMs) > 0 ? (now - readNumber(prev.corTimerLastResumeAtMs)) / 1000 : 0),
      corTimerPauseAtMs: now,
      corTimerLastResumeAtMs: 0,
      corUltimoTurnoLabel: "En pausa",
    }))
  }

  function confirmPauseAndResume() {
    if (!timerPaused || !pauseReason) return
    const now = Date.now()
    const pauseDurationSec = pauseAt > 0 ? (now - pauseAt) / 1000 : 0
    setForm((prev) => {
      const rows = Array.isArray(prev.corTimerPauses) ? (prev.corTimerPauses as CortePauseEntry[]) : []
      return {
        ...prev,
        corTimerState: "running",
        corTimerDeadAccSec: readNumber(prev.corTimerDeadAccSec) + pauseDurationSec,
        corTimerPauseAtMs: 0,
        corTimerLastResumeAtMs: now,
        corTimerPauses: [
          ...rows,
          { at: new Date(now).toISOString(), reason: pauseReason, obs: pauseObs.trim(), duration_sec: pauseDurationSec },
        ],
        corUltimoTurnoLabel: "Turno en ejecución",
      }
    })
    setPauseReason("")
    setPauseObs("")
  }

  function stopProductionTimer(nextState: "stopped" | "completed") {
    const now = Date.now()
    setForm((prev) => {
      let effective = readNumber(prev.corTimerEffectiveAccSec)
      let dead = readNumber(prev.corTimerDeadAccSec)
      if (readString(prev.corTimerState) === "running" && readNumber(prev.corTimerLastResumeAtMs) > 0) {
        effective += (now - readNumber(prev.corTimerLastResumeAtMs)) / 1000
      }
      if (readString(prev.corTimerState) === "paused" && readNumber(prev.corTimerPauseAtMs) > 0) {
        dead += (now - readNumber(prev.corTimerPauseAtMs)) / 1000
      }

      const existingTurnos = Array.isArray(prev.cor_turnos) ? (prev.cor_turnos as unknown[]) : []
      const scrapR = readNumber(prev.corScrapRefileKg)
      const scrapI = readNumber(prev.corScrapImpresoKg)
      const scrapM = readNumber(prev.corScrapMalCorteKg)
      const scrapSum = scrapR + scrapI + scrapM
      const turnoEntry: CorTurno = {
        id: newId("turno"),
        closed_at: new Date(now).toISOString(),
        label: nextState === "completed" ? "Turno finalizado" : "Turno cerrado",
        turno: readString(prev.corTurno) || undefined,
        grupo: readString(prev.corGrupo) || undefined,
        operador: readString(prev.corOperador) || undefined,
        ayudante: readString(prev.corAyudante) || undefined,
        supervisor: readString(prev.corSupervisor) || undefined,
        metrics: {
          entrada_bobinas_kg: entradaBobinasTotal.toFixed(3),
          salida_total_kg: salidaTotalKg.toFixed(3),
          merma_kg: kgMerma.toFixed(3),
          metraje: metraje.toFixed(3),
          scrap_total_kg: scrapSum.toFixed(3),
          scrap_refile_kg: scrapR.toFixed(3),
          scrap_impreso_kg: scrapI.toFixed(3),
          scrap_mal_corte_kg: scrapM.toFixed(3),
          rollos_salida: bobinasSalidaCount,
          paletas: salidaPaletas.length,
        },
        timer: {
          total_sec: Math.round(effective + dead),
          effective_sec: Math.round(effective),
          dead_sec: Math.round(dead),
          pauses: pauseEntries,
        },
        obs: readString(prev.corObs) || undefined,
      }
      const nextTurnos = [...existingTurnos, turnoEntry]
      return {
        ...prev,
        cor_turnos: nextTurnos,
        cor_turno_actual: {
          id: newId("turno"),
          opened_at: new Date(now).toISOString(),
        },
        corTimerState: nextState,
        corTimerEffectiveAccSec: effective,
        corTimerDeadAccSec: dead,
        corTimerPauseAtMs: 0,
        corTimerLastResumeAtMs: 0,
        corRegistrosTurnos: nextTurnos.length,
        corAcumuladoProducidoKg: readNumber(prev.kgSalidaCorte),
        corUltimoTurnoLabel: nextState === "completed" ? "Turno finalizado" : "Turno cerrado",

        // Nuevo turno activo: limpiar datos del turno anterior
        corTurno: "",
        corGrupo: "",
        corOperador: "",
        corAyudante: "",
        corSupervisor: "",
        corObs: "",
      }
    })
  }

  return (
    <>
      <MesSectionShell title="Acumulado de la orden (todos los turnos)">
        <div className="mes-stat-grid mes-stat-grid--4">
          <MesStatTile label="Pedido total" value={`${pedidoTotalKg.toFixed(2)} Kg`} />
          <MesStatTile label="Producido" value={`${producidoAcumuladoKg.toFixed(2)} Kg`} tone="positive" />
          <MesStatTile label="Falta por producir" value={`${faltanteKg.toFixed(2)} Kg`} tone="negative" />
          <MesStatTile label="Registros / turnos" value={turnosRegistrados} />
        </div>
        <div className="mes-footer-bar mes-footer-bar--3">
          <div className="mes-footer-bar__item">
            Kg entrada: <strong>{kgIngresados.toFixed(2)} Kg</strong>
          </div>
          <div className="mes-footer-bar__item">
            Kg salida: <strong>{kgSalida.toFixed(2)} Kg</strong>
          </div>
          <div className="mes-footer-bar__item">
            Último turno: <strong>{ultimoTurnoLabel}</strong>
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={
          <span className="inline-flex items-center gap-2">
            <ReceiptText className="h-4 w-4 shrink-0" aria-hidden />
            Temporizador de producción
          </span>
        }
        headerRight={
          <Badge variant="secondary" className="text-xs">
            {timerState === "running"
              ? "En producción"
              : timerState === "paused"
                ? "En pausa"
                : timerState === "completed"
                  ? "Orden finalizada"
                  : timerState === "stopped"
                    ? "Turno cerrado"
                    : "Pendiente"}
          </Badge>
        }
      >
        <div className="mes-timer-grid">
          <MesTimerFace
            elapsedLabel={formatTimerHms(totalSec)}
            deadHms={formatTimerHms(deadSec)}
            effectiveHms={formatTimerHms(effectiveSec)}
            kgHora={kgHora}
          />
          <div className="mes-timer-actions w-full min-w-0">
            <TooltipProvider delayDuration={200}>
              <div className="mes-timer-action-stack">
                <div className="mes-timer-action-labeled">
                  <span className="mes-timer-action-label">Iniciar</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-primary shrink-0"
                        aria-label="Iniciar"
                        onClick={startProductionTimer}
                        disabled={timerRunning || timerState === "completed"}
                      >
                        <CirclePlay className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Iniciar temporizador</TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <span className="mes-timer-action-label">Pausar</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-secondary shrink-0"
                        aria-label="Pausar"
                        onClick={pauseProductionTimer}
                        disabled={!timerRunning}
                      >
                        <CirclePause className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Pausar temporizador</TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <span className="mes-timer-action-label">Fin turno</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-danger-outline shrink-0"
                        aria-label="Fin turno"
                        onClick={() => stopProductionTimer("stopped")}
                        disabled={timerStopped || timerState === "pending"}
                      >
                        <LogOut className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Cerrar turno sin finalizar la orden</TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <span className="mes-timer-action-label">Finalizar</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-destructive-solid shrink-0"
                        aria-label="Finalizar orden"
                        onClick={() => stopProductionTimer("completed")}
                        disabled={timerState === "completed" || timerState === "pending"}
                      >
                        <Flag className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Finalizar orden de trabajo</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
          </div>
        </div>
        {timerPaused ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-medium text-amber-900">Registrar motivo de parada</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="ot-select" value={pauseReason} onChange={(e) => setPauseReason(e.target.value)}>
                <option value="">-- Seleccionar motivo --</option>
                {pauseReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
              <Input value={pauseObs} onChange={(e) => setPauseObs(e.target.value)} placeholder="Detalle breve (opcional)" className="ot-input-unified h-9" />
            </div>
            <div className="mt-2"><Button type="button" size="sm" onClick={confirmPauseAndResume}>Registrar y continuar</Button></div>
          </div>
        ) : null}
        {pauseEntries.length > 0 ? (
          <div className="mt-3 space-y-1 rounded-md border border-slate-200 bg-white p-2">
            <p className="text-muted-foreground text-xs">Paradas registradas</p>
            {pauseEntries.map((entry, idx) => (
              <div key={`${entry.at}-${idx}`} className="text-xs">
                <span className="font-medium">{idx + 1}. {entry.reason}</span>
                <span className="text-muted-foreground"> · {formatTimerHms(entry.duration_sec)}</span>
                {entry.obs ? <span className="text-muted-foreground"> · {entry.obs}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </MesSectionShell>

      <MesSectionShell title="Información del turno" subtle>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="ot-label">Turno</Label>
            <div className="mes-toggle-row mes-toggle-turno">
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                value={readString(form.corTurno)}
                onValueChange={(v) => {
                  if (!v) return
                  setKey("corTurno", v)
                }}
              >
                <ToggleGroupItem value="diurno" className="flex-1 gap-2">
                  <Sun className="h-4 w-4 shrink-0" aria-hidden />
                  Diurno
                </ToggleGroupItem>
                <ToggleGroupItem value="nocturno" className="flex-1 gap-2">
                  <Moon className="h-4 w-4 shrink-0" aria-hidden />
                  Nocturno
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <p className="mes-field-hint">Turno según calendario de planta (diurno / nocturno).</p>
          </div>
          <div className="space-y-1">
            <Label className="ot-label">Grupo</Label>
            <div className="mes-toggle-row mes-toggle-grupo">
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                value={readString(form.corGrupo)}
                onValueChange={(v) => {
                  if (!v) return
                  setKey("corGrupo", v)
                }}
              >
                {(["A", "B", "C"] as const).map((g) => (
                  <ToggleGroupItem
                    key={g}
                    value={g}
                    className={cn(
                      "flex-1 gap-1",
                      g === "A" && "mes-grupo-a",
                      g === "B" && "mes-grupo-b",
                      g === "C" && "mes-grupo-c",
                    )}
                  >
                    <Users className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    {g}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <p className="mes-field-hint">Cuadrilla o equipo asignado a la máquina (rotación interna A / B / C).</p>
          </div>
          <div className="ot-field">
            <Label className="ot-label">Operador</Label>
            <Input
              className="ot-input-unified h-9"
              value={readString(form.corOperador)}
              onChange={(e) => setKey("corOperador", e.target.value)}
              placeholder="Nombre operador"
            />
          </div>
          <div className="ot-field">
            <Label className="ot-label">Ayudante</Label>
            <Input
              className="ot-input-unified h-9"
              value={readString(form.corAyudante)}
              onChange={(e) => setKey("corAyudante", e.target.value)}
              placeholder="Nombre ayudante"
            />
          </div>
          <div className="ot-field md:col-span-2">
            <Label className="ot-label">Supervisor</Label>
            <Input
              className="ot-input-unified h-9"
              value={readString(form.corSupervisor)}
              onChange={(e) => setKey("corSupervisor", e.target.value)}
              placeholder="Nombre supervisor"
            />
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title="Ingreso de bobinas impresa — Kg"
        subtle
        bodyClassName="mes-section__body--flush"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {entradaBobinas.map((val, idx) => (
            <div key={`ent-cor-${idx}`} className="space-y-1">
              <Label className="ot-label">{idx + 1}</Label>
              <Input
                className="ot-input-unified h-9"
                inputMode="decimal"
                value={val}
                onChange={(e) => {
                  const next = [...entradaBobinas]
                  next[idx] = e.target.value
                  setNumericSeries("corEntradaBobinasKg", next)
                }}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 mes-stat-grid sm:grid-cols-3">
          <MesStatTile label="N° bobinas" value={entradaBobinasCount} />
          <MesStatTile label="Total" value={`${entradaBobinasTotal.toFixed(2)} Kg`} />
          <div className="mes-stat-tile">
            <span className="mes-stat-tile__label">Paletas (300 Kg)</span>
            <div className="mes-stat-tile__value">{paletasEquivalentes.toFixed(2)}</div>
            <p className="text-muted-foreground mt-1 text-xs">Completas: {paletasCompletas}</p>
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={
          <span className="inline-flex items-center gap-2">
            <Scissors className="h-4 w-4 shrink-0" aria-hidden />
            Bobinas de salida por paleta — Peso neto (Kg)
          </span>
        }
        subtle
        bodyClassName="mes-section__body--flush"
        headerRight={
          <Button type="button" size="sm" className="h-8" onClick={addPaleta}>
            <PlusCircle className="mr-1 h-4 w-4" />
            Agregar paleta
          </Button>
        }
      >
        <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
          {salidaPaletas.map((paleta, paletaIdx) => (
            <div key={`paleta-${paletaIdx}`} className="rounded-lg border bg-background">
              <div className="flex items-center justify-between border-b px-2 py-1.5">
                <strong className="text-sm">{corPaletas[paletaIdx]?.label ?? `Paleta #${String(paletaIdx + 1).padStart(2, "0")}`}</strong>
                <div className="inline-flex items-center gap-1">
                  <Badge variant="outline">{`${salidaPaletasRollos[paletaIdx]}/48`}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removePaleta(paletaIdx)}
                    title="Eliminar paleta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 p-2">
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label className="ot-label">Rollos</Label>
                    <Input
                      className="ot-input-unified h-8"
                      value={String(salidaPaletasRollos[paletaIdx] ?? 0)}
                      readOnly
                    />
                  </div>
                  <div>
                    <Label className="ot-label">Total Kg</Label>
                    <Input
                      className="ot-input-unified h-8 font-semibold"
                      value={(salidaPaletasTotales[paletaIdx] ?? 0).toFixed(2)}
                      readOnly
                    />
                  </div>
                </div>

                <div className="grid max-h-72 grid-cols-8 gap-1 overflow-y-auto">
                  {paleta.map((valor, rolloIdx) => (
                    <div key={`p-${paletaIdx}-r-${rolloIdx}`} className="space-y-1">
                      <Label className="ot-label text-[10px]">{rolloIdx + 1}</Label>
                      <Input
                        className="ot-input-unified h-7 px-2 text-xs"
                        inputMode="decimal"
                        value={valor}
                        onChange={(e) => {
                          const next = corPaletas.map((p) => ({ ...p, rollosKg: [...p.rollosKg] }))
                          if (!next[paletaIdx]) return
                          next[paletaIdx].rollosKg[rolloIdx] = e.target.value
                          writePaletas(next)
                        }}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </MesSectionShell>

      <MesSectionShell title="Proceso de corte" subtle bodyClassName="mes-section__body--flush">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Kg ingresados</span><Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={readString(form.kgIngresadosCorte)} onChange={(e) => setKey("kgIngresadosCorte", e.target.value)} placeholder="0" /></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Kg salida</span><Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={readString(form.kgSalidaCorte)} onChange={(e) => setKey("kgSalidaCorte", e.target.value)} placeholder="0" /></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Kg merma</span><Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={readString(form.kgMermaCorte)} onChange={(e) => setKey("kgMermaCorte", e.target.value)} placeholder="0" /></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Metraje</span><Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={readString(form.metrajeCorte)} onChange={(e) => setKey("metrajeCorte", e.target.value)} placeholder="0" /></div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Merma %</span><p className="font-semibold">{mermaPct}%</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Rendimiento</span><p className="font-semibold">{kgHora} Kg/h</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Metraje total</span><p className="font-semibold">{metraje.toFixed(2)} m</p></div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Salida</span><p className="font-semibold">{salidaTotalKg.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Merma</span><p className="font-semibold">{kgMerma.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Paletas</span><p className="font-semibold">{salidaPaletas.length}</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Bobinas</span><p className="font-semibold">{bobinasSalidaCount}</p></div>
        </div>
      </MesSectionShell>

      <MesSectionShell title="Scrap / Refil" subtle>
        <div className="mb-3 space-y-2 rounded border bg-background/80 p-2">
          <Label className="text-muted-foreground text-xs font-medium">Sustrato del desperdicio (reporte)</Label>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Clasificación global de la OT en el reporte (mal corte y «auto» en refile/impreso). «Auto» usa la estructura
            del producto. Transparente aplica cuando el sustrato es film transparente / CPP.
          </p>
          <ToggleGroup
            type="single"
            className="flex flex-wrap justify-start gap-1"
            value={
              (() => {
                const s = readString(form.corDesperdicioSustrato).toLowerCase()
                return s === "bopp" || s === "politerlero" || s === "transparente" ? s : "auto"
              })()
            }
            onValueChange={(v) => {
              if (!v) return
              setKey("corDesperdicioSustrato", v === "auto" ? "" : v)
            }}
          >
            <ToggleGroupItem value="auto" className="text-xs">
              Auto
            </ToggleGroupItem>
            <ToggleGroupItem value="bopp" className="text-xs">
              BOPP
            </ToggleGroupItem>
            <ToggleGroupItem value="politerlero" className="text-xs">
              Polietileno
            </ToggleGroupItem>
            <ToggleGroupItem value="transparente" className="text-xs">
              Transparente
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 rounded border bg-background/80 p-2">
            <Label className="text-muted-foreground text-xs font-medium">Destino refile (BOPP / PE)</Label>
            <p className="text-muted-foreground text-[11px] leading-snug">«Auto» hereda el sustrato global o la estructura.</p>
            <ToggleGroup
              type="single"
              className="flex flex-wrap justify-start gap-1"
              value={
                (() => {
                  const s = readString(form.corScrapRefileDestino).toLowerCase()
                  return s === "bopp" || s === "politerlero" ? s : "auto"
                })()
              }
              onValueChange={(v) => {
                if (!v) return
                setKey("corScrapRefileDestino", v === "auto" ? "" : v)
              }}
            >
              <ToggleGroupItem value="auto" className="text-xs">
                Auto
              </ToggleGroupItem>
              <ToggleGroupItem value="bopp" className="text-xs">
                BOPP
              </ToggleGroupItem>
              <ToggleGroupItem value="politerlero" className="text-xs">
                Polietileno
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1 rounded border bg-background/80 p-2">
            <Label className="text-muted-foreground text-xs font-medium">Destino impreso corte (BOPP / PE)</Label>
            <p className="text-muted-foreground text-[11px] leading-snug">«Auto» hereda el sustrato global o la estructura.</p>
            <ToggleGroup
              type="single"
              className="flex flex-wrap justify-start gap-1"
              value={
                (() => {
                  const s = readString(form.corScrapImpresoDestino).toLowerCase()
                  return s === "bopp" || s === "politerlero" ? s : "auto"
                })()
              }
              onValueChange={(v) => {
                if (!v) return
                setKey("corScrapImpresoDestino", v === "auto" ? "" : v)
              }}
            >
              <ToggleGroupItem value="auto" className="text-xs">
                Auto
              </ToggleGroupItem>
              <ToggleGroupItem value="bopp" className="text-xs">
                BOPP
              </ToggleGroupItem>
              <ToggleGroupItem value="politerlero" className="text-xs">
                Polietileno
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Refile (Kg)</span>
            <Input
              className="ot-input-unified mt-1 h-8"
              inputMode="decimal"
              value={readString(form.corScrapRefileKg)}
              onChange={(e) => setKey("corScrapRefileKg", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Impreso (Kg)</span>
            <Input
              className="ot-input-unified mt-1 h-8"
              inputMode="decimal"
              value={readString(form.corScrapImpresoKg)}
              onChange={(e) => setKey("corScrapImpresoKg", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Mal corte (Kg)</span>
            <Input
              className="ot-input-unified mt-1 h-8"
              inputMode="decimal"
              value={readString(form.corScrapMalCorteKg)}
              onChange={(e) => setKey("corScrapMalCorteKg", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Total scrap</span>
            <p className="font-semibold">{scrapTotal.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">% scrap / ingreso</span>
            <p className="font-semibold">{refilPct}%</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Estado</span>
            <p className="font-semibold">{kgIngresados > 0 ? "Calculado" : "Sin datos"}</p>
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell title="Resúmenes" subtle>
        <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-cyan-200/70 bg-cyan-50/40 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-900">Resumen del turno</div>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">N° Bobinas Usadas</span><p className="font-semibold">{entradaBobinasCount}</p></div>
            <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">N° Rollos</span><p className="font-semibold">{bobinasSalidaCount}</p></div>
            <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Peso Total (Kg)</span><p className="font-semibold">{salidaTotalKg.toFixed(2)}</p></div>
            <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">N° Paletas</span><p className="font-semibold">{salidaPaletas.length}</p></div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Merma (Kg)</span><p className="font-semibold">{kgMerma.toFixed(2)}</p></div>
            <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">% Merma</span><p className="font-semibold">{mermaPct}%</p></div>
          </div>
        </div>

        <div className="rounded-lg border border-cyan-200/70 bg-cyan-50/40 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-900">Resumen de paletas</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 pr-2">Paleta</th>
                  <th className="py-1 pr-2 text-center">Bobinas</th>
                  <th className="py-1 pr-2 text-center">Rollos</th>
                  <th className="py-1 pr-2 text-right">Peso (Kg)</th>
                  <th className="py-1 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {salidaPaletas.map((_, idx) => (
                  <tr key={`res-paleta-${idx}`} className="border-b">
                    <td className="py-1 pr-2">{`Paleta #${String(idx + 1).padStart(2, "0")}`}</td>
                    <td className="py-1 pr-2 text-center">{salidaPaletasRollos[idx] ?? 0}</td>
                    <td className="py-1 pr-2 text-center">{salidaPaletasRollos[idx] ?? 0}</td>
                    <td className="py-1 pr-2 text-right">{(salidaPaletasTotales[idx] ?? 0).toFixed(2)}</td>
                    <td className="py-1 text-center">—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-1 pr-2">TOTAL</td>
                  <td className="pt-1 pr-2 text-center">{bobinasSalidaCount}</td>
                  <td className="pt-1 pr-2 text-center">{bobinasSalidaCount}</td>
                  <td className="pt-1 pr-2 text-right">{salidaTotalKg.toFixed(2)}</td>
                  <td className="pt-1" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </div>
      </MesSectionShell>

      <MesSectionShell title="Observaciones" subtle>
        <Textarea
          className="min-h-24"
          value={readString(form.corObservaciones)}
          onChange={(e) => setKey("corObservaciones", e.target.value)}
          placeholder="Observaciones adicionales..."
        />
      </MesSectionShell>
    </>
  )
}

