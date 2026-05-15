import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  ChevronDown,
  CirclePause,
  CirclePlay,
  ClipboardList,
  Clock,
  Factory,
  History,
  Hourglass,
  IdCard,
  LogOut,
  Moon,
  NotebookPen,
  Package,
  PackageSearch,
  Percent,
  PieChart,
  PlusCircle,
  Recycle,
  Ruler,
  Scissors,
  Sun,
  Timer,
  Trash2,
  TrendingDown,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"

import {
  fieldLegend,
  MesSectionHeaderExtras,
  MesSectionShell,
  MesStatTile,
  mesSectionTitle,
  MesTimerFace,
} from "@/components/axones/mes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import {
  COR_ACTUAL_KEY,
  COR_ENTRADA_SLOTS,
  COR_PAUSE_REASONS,
  COR_ROLLOS_PER_PALETA,
  COR_TURNOS_KEY,
  accumulateCorteFromJson,
  clearCorteMirrorKeys,
  corteTurnoToMirror,
  createNewCorteTurno,
  emptyPaletaRollos,
  finalizeTurnTimerNow,
  formatTimerHms,
  getCorPaletas,
  parseCorteTurnoActual,
  parseCorteTurnos,
  snapshotCorteTurnMetrics,
  sumSalidaKgFromClosedTurno,
  sumSalidaKgFromForm,
  syncCorteFormMetrics,
  syncCorteSalidaFields,
  sumEntradaKgFromForm,
  timerFromLegacyFlatForm,
  type CorPaleta,
  type CortePauseEntry,
  type CorteTurnoEntry,
} from "./corte-turnos"
import {
  activePersonnelFromStrings,
  stringsFromActivePersonnel,
  type DraftPerson,
  type DraftPersonRole,
} from "./WorkOrderMontajeOpsSection"

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

function getNumericSeries(form: Record<string, unknown>, key: string, size: number): string[] {
  const raw = form[key]
  if (!Array.isArray(raw)) return Array.from({ length: size }, () => "")
  const out = raw.slice(0, size).map((v) => readString(v))
  while (out.length < size) out.push("")
  return out
}

type Props = {
  form: Record<string, unknown>
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  pedidoTotalKg: number
  readOnly?: boolean
  /** Tras cerrar turno u otras acciones críticas, persistir en servidor. */
  onRequestSave?: (srcBase?: Record<string, unknown>) => void
  /** Cierre de turno con persistencia (panel padre). */
  onApplyCerrarTurno?: (cur: CorteTurnoEntry) => void | Promise<void>
  /** Abre confirmación de cierre en el panel padre. */
  onRequestCerrarTurno?: () => void
}

const MIN_PALETAS = 1

function roleLabelEs(role: DraftPersonRole): string {
  if (role === "operador") return "Operador"
  if (role === "supervisor") return "Supervisor"
  return "Ayudante"
}

function turnoGrupoLabel(turno: string, grupo: string): string {
  const t = turno === "diurno" ? "Diurno" : turno === "nocturno" ? "Nocturno" : turno.trim() || "—"
  const g = grupo === "A" || grupo === "B" || grupo === "C" ? `Grupo ${grupo}` : grupo.trim() || "—"
  return `${t} · ${g}`
}

export default function WorkOrderCorteOpsSection({
  form,
  setForm,
  pedidoTotalKg,
  readOnly = false,
  onRequestSave,
  onApplyCerrarTurno,
  onRequestCerrarTurno,
}: Props) {
  const mk = useId().replace(/:/g, "")
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [draftTurno, setDraftTurno] = useState<"diurno" | "nocturno">("diurno")
  const [draftGrupo, setDraftGrupo] = useState<"A" | "B" | "C">("A")
  const [draftPeople, setDraftPeople] = useState<DraftPerson[]>([])
  const [draftStaging, setDraftStaging] = useState<{ name: string; role: DraftPersonRole }>({
    name: "",
    role: "operador",
  })

  const closedTurnos = useMemo(() => parseCorteTurnos(form[COR_TURNOS_KEY], form), [form])
  const activeTurno = useMemo(() => parseCorteTurnoActual(form[COR_ACTUAL_KEY], form), [form])
  const hasActiveTurno = activeTurno !== null
  const showPersonalTurnoSetup = !hasActiveTurno

  const entradaBobinas = useMemo(() => getNumericSeries(form, "corEntradaBobinasKg", COR_ENTRADA_SLOTS), [form])
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
  const paletasEquivalentesEntrada = useMemo(
    () => entradaBobinasTotal / paletteKgBase,
    [entradaBobinasTotal],
  )
  const paletasCompletasEntrada = useMemo(
    () => Math.floor(paletasEquivalentesEntrada),
    [paletasEquivalentesEntrada],
  )

  const jsonAccum = useMemo(
    () => accumulateCorteFromJson(closedTurnos, activeTurno, salidaTotalKg),
    [closedTurnos, activeTurno, salidaTotalKg],
  )
  const kgIngresados = entradaBobinasTotal
  const kgSalida = salidaTotalKg
  const kgMerma = readNumber(form.kgMermaCorte)
  const metraje = readNumber(form.metrajeCorte)
  const scrapRefile = readNumber(form.corScrapRefileKg)
  const scrapImpreso = readNumber(form.corScrapImpresoKg)
  const scrapMalCorte = readNumber(form.corScrapMalCorteKg)
  const scrapTotal = scrapRefile + scrapImpreso + scrapMalCorte
  const producidoAcumuladoKg = jsonAccum.producidoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = jsonAccum.turnosRegistrados
  const ultimoTurnoLabel = hasActiveTurno ? "Turno en curso" : jsonAccum.ultimoCierreLabel
  const inputDisabled = !hasActiveTurno

  const draftOperadorName = draftPeople.find((p) => p.role === "operador")?.name.trim() ?? ""
  const draftOperadorMissing = draftPeople.every((p) => p.role !== "operador")

  useEffect(() => {
    const salidaStr = salidaTotalKg.toFixed(2)
    const entradaStr = entradaBobinasTotal.toFixed(2)
    const salidaOk =
      readString(form.kgSalidaCorte) === salidaStr && readNumber(form.corAcumuladoProducidoKg) === salidaTotalKg
    const entradaOk = readString(form.kgIngresadosCorte) === entradaStr
    if (salidaOk && entradaOk) return
    setForm((prev) => ({ ...prev, ...syncCorteFormMetrics(prev) }))
  }, [salidaTotalKg, entradaBobinasTotal, form.kgSalidaCorte, form.corAcumuladoProducidoKg, form.kgIngresadosCorte, setForm])

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
    if (readOnly) return
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setNumericSeries(key: string, values: string[]) {
    if (readOnly) return
    setForm((prev) => ({ ...prev, [key]: values }))
  }

  function writeEntradaBobinasKg(next: string[]) {
    if (readOnly) return
    setForm((prev) => {
      const base = { ...prev, corEntradaBobinasKg: next }
      const synced = syncCorteFormMetrics(base)
      const entradaKg = sumEntradaKgFromForm(synced).toFixed(2)
      if (hasActiveTurno) {
        const cur = parseCorteTurnoActual(synced[COR_ACTUAL_KEY], synced)
        if (cur) {
          const nextTurn: CorteTurnoEntry = {
            ...cur,
            entradaBobinasKg: next,
            kgIngresados: entradaKg,
          }
          return {
            ...synced,
            [COR_ACTUAL_KEY]: nextTurn,
            ...corteTurnoToMirror(nextTurn),
          }
        }
      }
      return synced
    })
  }

  const patchActiveTurn = useCallback((updater: (t: CorteTurnoEntry) => CorteTurnoEntry) => {
    if (readOnly) return
    setForm((prev) => {
      const cur = parseCorteTurnoActual(prev[COR_ACTUAL_KEY], prev)
      if (!cur) return prev
      const nextTurn = updater(cur)
      return {
        ...prev,
        [COR_ACTUAL_KEY]: nextTurn,
        ...corteTurnoToMirror(nextTurn),
        ...syncCorteFormMetrics({ ...prev, cor_paletas: nextTurn.paletas }),
      }
    })
  }, [readOnly, setForm])

  function writePaletas(nextPaletas: CorPaleta[]) {
    if (readOnly) return
    setForm((prev) => {
      const patch = {
        cor_paletas: nextPaletas,
        corSalidaPaletasKg: nextPaletas.map((p) => p.rollosKg),
      }
      return { ...prev, ...patch, ...syncCorteFormMetrics({ ...prev, ...patch }) }
    })
    if (hasActiveTurno) {
      patchActiveTurn((t) => ({ ...t, paletas: nextPaletas }))
    }
  }

  function addPaleta() {
    if (inputDisabled) return
    const nextIndex = corPaletas.length + 1
    writePaletas([
      ...corPaletas,
      {
        id: `p-${String(nextIndex).padStart(2, "0")}`,
        label: `Paleta #${String(nextIndex).padStart(2, "0")}`,
        rollosKg: emptyPaletaRollos(),
        status: "en_progreso",
      },
    ])
  }

  function removePaleta(index: number) {
    if (inputDisabled) return
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
        rollosKg: emptyPaletaRollos(),
        status: "en_progreso",
      },
    ])
  }

  function onDraftPersonGuardar(name: string, role: DraftPersonRole) {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Indique el nombre de la persona.")
      return
    }
    if (role === "operador" && draftPeople.some((p) => p.role === "operador")) {
      toast.warning("Solo puede haber un operador principal en el turno.")
      return
    }
    if (role === "supervisor" && draftPeople.some((p) => p.role === "supervisor")) {
      toast.warning("Solo puede haber un supervisor en el turno.")
      return
    }
    setDraftPeople((prev) => [...prev, { id: `draft-${Date.now()}`, role, name: trimmed }])
    setDraftStaging({ name: "", role: "operador" })
  }

  function onIniciarTurno() {
    if (readOnly) return
    if (hasActiveTurno) return
    if (draftOperadorMissing) {
      toast.error("Guarde al menos un operador antes de iniciar el turno.")
      return
    }
    const { operador, ayudante, supervisor } = stringsFromActivePersonnel(draftPeople)
    const t = createNewCorteTurno({
      turno: draftTurno,
      grupo: draftGrupo,
      operador,
      ayudante,
      supervisor,
    })
    setForm((prev) => ({
      ...prev,
      [COR_ACTUAL_KEY]: t,
      ...corteTurnoToMirror(t),
      [COR_TURNOS_KEY]: parseCorteTurnos(prev[COR_TURNOS_KEY], prev),
    }))
    setDraftPeople([])
    setDraftStaging({ name: "", role: "operador" })
    toast.success(
      "Turno de planta abierto. Use el cronómetro (play) para registrar tiempos. La salida (Kg) se calcula desde los rollos.",
    )
  }

  function applyCerrarTurno(cur: CorteTurnoEntry) {
    const finalizedTimer = finalizeTurnTimerNow(cur.timer)
    const closed: CorteTurnoEntry = {
      ...cur,
      timer: finalizedTimer,
      closed_at: new Date().toISOString(),
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
    setForm((prev) => {
      const next = {
        ...prev,
        [COR_TURNOS_KEY]: [...parseCorteTurnos(prev[COR_TURNOS_KEY], prev), closed],
        [COR_ACTUAL_KEY]: null,
        corRegistrosTurnos: parseCorteTurnos(prev[COR_TURNOS_KEY], prev).length + 1,
        ...clearCorteMirrorKeys(),
        ...syncCorteSalidaFields({ ...prev, cor_paletas: clearCorteMirrorKeys().cor_paletas }),
      }
      queueMicrotask(() => onRequestSave?.(next))
      return next
    })
    toast.success("Turno cerrado. Puede iniciar otro turno cuando corresponda.")
  }

  function cerrarTurnoActual() {
    if (readOnly) return
    const cur = parseCorteTurnoActual(form[COR_ACTUAL_KEY], form)
    if (!cur) return
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador.")
      return
    }
    if (onRequestCerrarTurno) {
      onRequestCerrarTurno()
      return
    }
    if (onApplyCerrarTurno) {
      void onApplyCerrarTurno(cur)
      return
    }
    applyCerrarTurno(cur)
  }

  function onSetTurno(v: "diurno" | "nocturno") {
    patchActiveTurn((t) => ({ ...t, turno: v }))
  }

  function onSetGrupo(v: "A" | "B" | "C") {
    patchActiveTurn((t) => ({ ...t, grupo: v }))
  }

  function onActivePersonnelApply(people: DraftPerson[]) {
    const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
    patchActiveTurn((t) => ({ ...t, operador, ayudante, supervisor }))
  }

  const [activeStageName, setActiveStageName] = useState("")
  const [activeStageRole, setActiveStageRole] = useState<DraftPersonRole>("operador")
  const activeSaved = useMemo(
    () =>
      activePersonnelFromStrings(
        readString(form.corOperador),
        readString(form.corAyudante),
        readString(form.corSupervisor),
      ),
    [form.corOperador, form.corAyudante, form.corSupervisor],
  )

  const guardarPersonaTurnoActivo = useCallback(() => {
    const trimmed = activeStageName.trim()
    if (!trimmed) {
      toast.error("Indique el nombre de la persona.")
      return
    }
    const next = [...activeSaved]
    if (activeStageRole === "operador") {
      const idx = next.findIndex((p) => p.role === "operador")
      if (idx >= 0) next[idx] = { ...next[idx], name: trimmed }
      else next.push({ id: "slot-operador", role: "operador", name: trimmed })
    } else if (activeStageRole === "supervisor") {
      if (next.some((p) => p.role === "supervisor" && p.name !== trimmed)) {
        toast.warning("Solo puede haber un supervisor en el turno.")
        return
      }
      const idx = next.findIndex((p) => p.role === "supervisor")
      if (idx >= 0) next[idx] = { ...next[idx], name: trimmed }
      else next.push({ id: "slot-supervisor", role: "supervisor", name: trimmed })
    } else {
      next.push({ id: `slot-ayudante-${Date.now()}`, role: "ayudante", name: trimmed })
    }
    onActivePersonnelApply(next)
    setActiveStageName("")
    setActiveStageRole("operador")
  }, [activeSaved, activeStageName, activeStageRole, onActivePersonnelApply])

  function fieldLabel(id: string, Icon: LucideIcon, children: ReactNode) {
    return (
      <Label htmlFor={id} className="ot-label inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        {children}
      </Label>
    )
  }

  function startProductionTimer() {
    if (readOnly) return
    if (!hasActiveTurno) {
      toast.error("Primero inicie un turno de planta.")
      return
    }
    const now = Date.now()
    patchActiveTurn((t) => ({
      ...t,
      timer: {
        ...t.timer,
        state: "running",
        startedAtMs: t.timer.startedAtMs || now,
        lastResumeAtMs: now,
        pauseAtMs: 0,
      },
    }))
    setForm((prev) => ({
      ...prev,
      corTimerState: "running",
      corTimerStartedAtMs: readNumber(prev.corTimerStartedAtMs) || now,
      corTimerLastResumeAtMs: now,
      corTimerPauseAtMs: 0,
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

  const doneAcumulado = pedidoTotalKg > 0.01 && faltanteKg <= 0.01
  const doneInfoTurno =
    !!readString(form.corOperador).trim() ||
    !!readString(form.corAyudante).trim() ||
    !!readString(form.corSupervisor).trim() ||
    !!readString(form.corTurno).trim() ||
    !!readString(form.corGrupo).trim()

  const acumuladoOrdenSection = (
    <MesSectionShell
      title={mesSectionTitle(BarChart3, "Acumulado de la orden (todos los turnos)")}
      headerRight={<MesSectionHeaderExtras isDone={doneAcumulado} />}
    >
        <div className="mes-stat-grid mes-stat-grid--4">
          <MesStatTile
            label="Pedido total"
            value={`${pedidoTotalKg.toFixed(2)} Kg`}
            icon={<Package className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Producido"
            value={`${producidoAcumuladoKg.toFixed(2)} Kg`}
            tone="positive"
            icon={<Factory className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Falta por producir"
            value={`${faltanteKg.toFixed(2)} Kg`}
            tone="negative"
            icon={<Hourglass className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Registros / turnos"
            value={turnosRegistrados}
            icon={<ClipboardList className="h-3.5 w-3.5" />}
          />
        </div>
        <div className="mes-footer-bar mes-footer-bar--3">
          <div className="mes-footer-bar__item flex items-start gap-2">
            <ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span>
              Kg entrada: <strong>{kgIngresados.toFixed(2)} Kg</strong>
            </span>
          </div>
          <div className="mes-footer-bar__item flex items-start gap-2">
            <ArrowUpFromLine className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span>
              Kg salida: <strong>{kgSalida.toFixed(2)} Kg</strong>
            </span>
          </div>
          <div className="mes-footer-bar__item flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span>
              Último turno: <strong>{ultimoTurnoLabel}</strong>
            </span>
          </div>
        </div>
      </MesSectionShell>
  )

  return (
    <>
      {showPersonalTurnoSetup ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start xl:gap-5">
          <div className="min-w-0">{acumuladoOrdenSection}</div>
          <div className="min-w-0">
            <MesSectionShell title={mesSectionTitle(Users, "Personal y turno de planta")} subtle bodyClassName="mes-section__body--flush">
              <p className="text-muted-foreground mb-3 text-xs leading-snug">
                Elija turno y grupo, guarde la cuadrilla (mínimo un operador) y pulse{" "}
                <span className="font-semibold text-foreground">Iniciar turno</span>. El cronómetro se inicia después con play.
              </p>
              <div className="rounded-lg border bg-background/60 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    {fieldLegend(Clock, "Turno")}
                    <ToggleGroup type="single" variant="outline" className="mes-toggle-row mes-toggle-turno w-full" value={draftTurno} onValueChange={(v) => v && setDraftTurno(v as "diurno" | "nocturno")}>
                      <ToggleGroupItem value="diurno" className="flex-1 gap-2"><Sun className="h-4 w-4" />Diurno</ToggleGroupItem>
                      <ToggleGroupItem value="nocturno" className="flex-1 gap-2"><Moon className="h-4 w-4" />Nocturno</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div className="space-y-1">
                    {fieldLegend(Users, "Grupo")}
                    <ToggleGroup type="single" variant="outline" className="mes-toggle-row mes-toggle-grupo w-full" value={draftGrupo} onValueChange={(v) => v && setDraftGrupo(v as "A" | "B" | "C")}>
                      {(["A", "B", "C"] as const).map((g) => (
                        <ToggleGroupItem key={g} value={g} className={cn("flex-1", g === "A" && "mes-grupo-a", g === "B" && "mes-grupo-b", g === "C" && "mes-grupo-c")}>{g}</ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t pt-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input className="h-9" value={draftStaging.name} onChange={(e) => setDraftStaging((s) => ({ ...s, name: e.target.value }))} placeholder="Nombre" />
                    <Select value={draftStaging.role} onValueChange={(v) => setDraftStaging((s) => ({ ...s, role: v as DraftPersonRole }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="ayudante">Ayudante</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={() => onDraftPersonGuardar(draftStaging.name, draftStaging.role)}><UserPlus className="mr-1 h-4 w-4" />Guardar persona</Button>
                  {draftPeople.map((p) => (
                    <div key={p.id} className="flex justify-between rounded border px-2 py-1 text-xs">
                      <span>{p.name} — {roleLabelEs(p.role)}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDraftPeople((prev) => prev.filter((x) => x.id !== p.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                  <Button type="button" className="w-full" onClick={onIniciarTurno} disabled={readOnly || draftOperadorMissing}><CirclePlay className="mr-2 h-4 w-4" />Iniciar turno</Button>
                </div>
              </div>
            </MesSectionShell>
          </div>
        </div>
      ) : (
        acumuladoOrdenSection
      )}

      {closedTurnos.length > 0 ? (
        <Collapsible className="mb-4 rounded-lg border bg-white shadow-sm">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-sm font-medium">
            <span className="inline-flex items-center gap-2"><History className="h-4 w-4" />Turnos registrados ({closedTurnos.length})</span>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t px-3 pb-3 text-xs">
            {closedTurnos.map((t) => (
              <div key={t.id} className="mt-2 rounded border p-2">
                {t.closed_at ? new Date(t.closed_at).toLocaleString("es-VE") : "—"} · {turnoGrupoLabel(t.turno, t.grupo)} · Salida{" "}
                {sumSalidaKgFromClosedTurno(t).toFixed(2)} Kg
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {hasActiveTurno ? (
        <MesSectionShell title={mesSectionTitle(ClipboardList, "Información del turno")} headerRight={<MesSectionHeaderExtras isDone={doneInfoTurno} />}>
          <p className="text-muted-foreground mb-3 text-xs">Personal y turno del registro en curso. Cierre la sesión con <strong>Cerrar turno</strong> en el cronómetro.</p>
          <div className="grid gap-2 md:grid-cols-2">
            <ToggleGroup type="single" variant="outline" className="mes-toggle-row mes-toggle-turno w-full" value={readString(form.corTurno)} onValueChange={(v) => v && onSetTurno(v as "diurno" | "nocturno")}>
              <ToggleGroupItem value="diurno" className="flex-1 gap-2"><Sun className="h-4 w-4" />Diurno</ToggleGroupItem>
              <ToggleGroupItem value="nocturno" className="flex-1 gap-2"><Moon className="h-4 w-4" />Nocturno</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="single" variant="outline" className="mes-toggle-row mes-toggle-grupo w-full" value={readString(form.corGrupo)} onValueChange={(v) => v && onSetGrupo(v as "A" | "B" | "C")}>
              {(["A", "B", "C"] as const).map((g) => <ToggleGroupItem key={g} value={g} className="flex-1">{g}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
        </MesSectionShell>
      ) : null}

      <MesSectionShell
        title={mesSectionTitle(Timer, "Cronómetro de producción")}
        headerRight={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MesSectionHeaderExtras isDone={timerState === "completed" || timerState === "stopped"} />
            <Badge variant="secondary" className="max-w-[14rem] text-xs leading-snug">
              {timerState === "running"
                ? "Cronómetro en marcha"
                : timerState === "paused"
                  ? "Cronómetro en pausa"
                  : timerState === "completed"
                    ? "Orden finalizada"
                    : timerState === "stopped"
                      ? "Turno cerrado"
                      : "Cronómetro listo (sin iniciar)"}
            </Badge>
          </div>
        }
      >
        <div className="mb-3 rounded-md border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs leading-snug text-foreground">
          <span className="font-semibold">Cronómetro (máquina):</span> cuenta tiempo efectivo y paradas.{" "}
          <span className="font-semibold">Parada</span> detiene el efectivo y pide motivo (tiempo muerto).{" "}
          <span className="font-semibold">Fin turno</span> cierra el registro sin finalizar la orden.
        </div>
        <div className="mes-timer-grid">
          <MesTimerFace
            elapsedLabel={formatTimerHms(effectiveSec)}
            elapsedCaption="Tiempo efectivo (se detiene al registrar parada)"
            deadHms={formatTimerHms(deadSec)}
            effectiveHms={formatTimerHms(totalSec)}
            productiveMetricLabel="Total (efectivo + paradas)"
            kgHora={kgHora}
          />
          <div className="mes-timer-actions w-full min-w-0">
            <TooltipProvider delayDuration={200}>
              <div className="mes-timer-action-stack">
                <div className="mes-timer-action-labeled">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-primary shrink-0"
                        aria-label="Iniciar cronómetro de producción"
                        onClick={startProductionTimer}
                        disabled={readOnly || !hasActiveTurno || timerRunning}
                      >
                        <CirclePlay className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Iniciar cronómetro (tiempo efectivo)</TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-secondary shrink-0"
                        aria-label="Pausar cronómetro y registrar motivo de parada"
                        onClick={pauseProductionTimer}
                        disabled={readOnly || !hasActiveTurno || !timerRunning}
                      >
                        <CirclePause className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Pausar cronómetro (parada)</TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-danger-outline shrink-0"
                        aria-label="Fin turno"
                        onClick={cerrarTurnoActual}
                        disabled={readOnly || !hasActiveTurno}
                      >
                        <LogOut className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Cerrar turno sin finalizar la orden</TooltipContent>
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
                {COR_PAUSE_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
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

      {!hasActiveTurno ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Inicie un <span className="font-semibold text-foreground">turno de planta</span> para registrar ingreso, paletas, scrap y resúmenes.
        </div>
      ) : null}

      {hasActiveTurno ? (
      <>
      <MesSectionShell
        title={mesSectionTitle(Package, "Ingreso de bobinas impresa — Kg")}
        subtle
        bodyClassName="mes-section__body--flush"
      >
        <p className="text-muted-foreground mb-2 text-xs leading-snug">
          Registre hasta {COR_ENTRADA_SLOTS} bobinas de material impreso que entran al corte. El total alimenta automáticamente{" "}
          <span className="font-medium text-foreground">Kg ingresados</span> en proceso de corte. La salida por paleta ({COR_ROLLOS_PER_PALETA}{" "}
          rollos/paleta) es independiente.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10">
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
                  writeEntradaBobinasKg(next)
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
            <div className="mes-stat-tile__value">{paletasEquivalentesEntrada.toFixed(2)}</div>
            <p className="text-muted-foreground mt-1 text-xs">Completas: {paletasCompletasEntrada}</p>
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Scissors, "Bobinas de salida por paleta — Peso neto (Kg)")}
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
                  <Badge variant="outline">{`${salidaPaletasRollos[paletaIdx]}/${COR_ROLLOS_PER_PALETA}`}</Badge>
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

                <div
                  className="grid max-h-[22rem] grid-cols-8 gap-1 overflow-y-auto"
                  role="group"
                  aria-label={`Rollos 1 a ${COR_ROLLOS_PER_PALETA}`}
                >
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

      <MesSectionShell
        title={mesSectionTitle(PackageSearch, "Proceso de corte")}
        subtle
        bodyClassName="mes-section__body--flush"
      >
        <div className="mes-stat-grid mes-stat-grid--4">
          <MesStatTile
            label="Kg ingresados"
            value={`${entradaBobinasTotal.toFixed(2)} Kg`}
            icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
          />
          <MesStatTile label="Kg salida" value={`${salidaTotalKg.toFixed(2)} Kg`} icon={<ArrowUpFromLine className="h-3.5 w-3.5" />} />
          <div className="mes-stat-tile"><span className="mes-stat-tile__label">Kg merma</span><Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={readString(form.kgMermaCorte)} onChange={(e) => setKey("kgMermaCorte", e.target.value)} placeholder="0" /></div>
          <div className="mes-stat-tile"><span className="mes-stat-tile__label">Metraje</span><Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={readString(form.metrajeCorte)} onChange={(e) => setKey("metrajeCorte", e.target.value)} placeholder="0" /></div>
        </div>
        <div className="mes-stat-grid mt-2 sm:grid-cols-3">
          <MesStatTile label="Merma %" value={`${mermaPct}%`} icon={<Percent className="h-3.5 w-3.5" />} />
          <MesStatTile label="Rendimiento" value={`${kgHora} Kg/h`} icon={<TrendingDown className="h-3.5 w-3.5" />} />
          <MesStatTile label="Metraje total" value={`${metraje.toFixed(2)} m`} icon={<Ruler className="h-3.5 w-3.5" />} />
        </div>
        <div className="mes-stat-grid mt-2 mes-stat-grid--4">
          <MesStatTile label="Salida" value={`${salidaTotalKg.toFixed(2)} Kg`} icon={<ArrowUpFromLine className="h-3.5 w-3.5" />} />
          <MesStatTile label="Merma" value={`${kgMerma.toFixed(2)} Kg`} icon={<Trash2 className="h-3.5 w-3.5" />} />
          <MesStatTile label="Paletas" value={salidaPaletas.length} />
          <MesStatTile label="Bobinas" value={bobinasSalidaCount} />
        </div>
      </MesSectionShell>

      <MesSectionShell title={mesSectionTitle(Recycle, "Scrap / Refil")} subtle>
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

      <MesSectionShell title={mesSectionTitle(PieChart, "Resúmenes")} subtle>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen del turno</p>
        <div className="mes-stat-grid mes-stat-grid--4">
          <MesStatTile label="N° Bobinas Usadas" value={entradaBobinasCount} />
          <MesStatTile label="N° Rollos" value={bobinasSalidaCount} />
          <MesStatTile label="Peso Total (Kg)" value={salidaTotalKg.toFixed(2)} />
          <MesStatTile label="N° Paletas" value={salidaPaletas.length} />
        </div>
        <div className="mes-stat-grid mt-2 sm:grid-cols-2">
          <MesStatTile label="Merma (Kg)" value={kgMerma.toFixed(2)} icon={<Trash2 className="h-3.5 w-3.5" />} />
          <MesStatTile label="% Merma" value={`${mermaPct}%`} icon={<Percent className="h-3.5 w-3.5" />} />
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen de paletas</p>
        <div className="overflow-x-auto rounded-md border border-[var(--ax-mes-border,#cbd5e1)] bg-[var(--ax-mes-panel,#fff)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-2 pl-2">Paleta</th>
                <th className="py-2 pr-2 text-center">Bobinas</th>
                <th className="py-2 pr-2 text-center">Rollos</th>
                <th className="py-2 pr-2 text-right">Peso (Kg)</th>
                <th className="py-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {salidaPaletas.map((_, idx) => (
                <tr key={`res-paleta-${idx}`} className="border-b">
                  <td className="py-1.5 pl-2 pr-2">{`Paleta #${String(idx + 1).padStart(2, "0")}`}</td>
                  <td className="py-1.5 pr-2 text-center">{salidaPaletasRollos[idx] ?? 0}</td>
                  <td className="py-1.5 pr-2 text-center">{salidaPaletasRollos[idx] ?? 0}</td>
                  <td className="py-1.5 pr-2 text-right">{(salidaPaletasTotales[idx] ?? 0).toFixed(2)}</td>
                  <td className="py-1.5 text-center">—</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-2 pb-2 pl-2 pr-2">TOTAL</td>
                <td className="pt-2 pb-2 pr-2 text-center">{bobinasSalidaCount}</td>
                <td className="pt-2 pb-2 pr-2 text-center">{bobinasSalidaCount}</td>
                <td className="pt-2 pb-2 pr-2 text-right">{salidaTotalKg.toFixed(2)}</td>
                <td className="pt-2 pb-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </MesSectionShell>

      <MesSectionShell title={mesSectionTitle(NotebookPen, "Observaciones")} subtle>
        <Textarea
          className="min-h-24"
          value={readString(form.corObservaciones)}
          onChange={(e) => setKey("corObservaciones", e.target.value)}
          placeholder="Observaciones adicionales..."
        />
      </MesSectionShell>
      </>
      ) : null}
    </>
  )
}

