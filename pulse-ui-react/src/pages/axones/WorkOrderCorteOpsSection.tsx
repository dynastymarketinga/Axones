import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Check,
  ChevronDown,
  ChevronsUpDown,
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
  PackageCheck,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import {
  corteOperabilityFromForm,
  explainCannotAddPaleta,
} from "@/lib/corte-paleta-flow"
import { normalizeScrapSubstrate, SCRAP_POLIETILENO } from "@/lib/scrap-substrate"
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
  materializeOpenCorteTurnoActual,
  resolveCorteDisplayTimer,
  createNewCorteTurno,
  emptyPaletaRollos,
  finalizeTurnTimerNow,
  formatTimerHms,
  countRollosWithKg,
  getCorPaletas,
  isCorPaletaCerrada,
  newCorteTurnoId,
  parseCorteTurnoActual,
  parseCorteTurnos,
  snapshotCorteTurnMetrics,
  pauseCorteProductionTimerOnForm,
  startCorteProductionTimerOnForm,
  sumKgFromPaleta,
  sumSalidaKgFromClosedPaletas,
  sumSalidaKgFromClosedTurno,
  sumSalidaKgFromForm,
  sumSalidaKgFromOpenPaletas,
  syncCorteFormMetrics,
  syncCorteSalidaFields,
  sumEntradaKgFromForm,
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

function coerceTurnoUi(v: string): "diurno" | "nocturno" | "" {
  const t = v.toLowerCase()
  return t === "diurno" || t === "nocturno" ? t : ""
}

function coerceGrupoUi(v: string): "A" | "B" | "C" | "" {
  const g = v.toUpperCase()
  return g === "A" || g === "B" || g === "C" ? g : ""
}

type Props = {
  form: Record<string, unknown>
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  pedidoTotalKg: number
  readOnly?: boolean
  /** Solo lectura operativa (área finalizada sin jefatura). Paridad impresión. */
  readOnlyOps?: boolean
  /** Tras cerrar paleta u otras acciones críticas, persistir en servidor. */
  onRequestSave?: (
    srcBase?: Record<string, unknown>,
    options?: {
      suppressSuccessToast?: boolean
      skipProductionSaveGuard?: boolean
      notifyProductionSave?: boolean
      clearTurnoActual?: boolean
    },
  ) => void | Promise<boolean>
  /** Cierre de turno con persistencia (panel padre). */
  onApplyCerrarTurno?: (cur: CorteTurnoEntry) => void | Promise<void>
  /** Abre confirmación de cierre en el panel padre. */
  onRequestCerrarTurno?: () => void
  /** Turno abierto y cronómetro iniciado al menos una vez (operación en planta activa). */
  canOperateProduction?: boolean
  /** Espejo planilla (paridad impresión: impTurno / impGrupo). */
  corTurno?: string
  corGrupo?: string
  corOperador?: string
  corAyudante?: string
  corSupervisor?: string
  onSetTurno?: (v: "diurno" | "nocturno") => void
  onSetGrupo?: (v: "A" | "B" | "C") => void
  onActivePersonnelApply?: (people: DraftPerson[]) => void
  /** Actualiza corTurnoActual + espejo (desde panel padre). */
  patchActiveTurn?: (updater: (t: CorteTurnoEntry) => CorteTurnoEntry) => void
  /** Inicia/reanuda cronómetro (panel padre persiste en servidor). */
  startProductionTimer?: () => void
  /** Pausa cronómetro (panel padre persiste en servidor). */
  pauseProductionTimer?: () => void
  confirmPauseAndResume?: () => void
  pauseReason?: string
  pauseObs?: string
  setPauseReason?: (v: string) => void
  setPauseObs?: (v: string) => void
  pauseMotivoDialogOpen?: boolean
  onPauseMotivoDialogOpenChange?: (open: boolean) => void
}

const MIN_PALETAS = 1
const CERRAR_PALETA_OPERATE_TOOLTIP =
  "Inicie turno de planta y pulse play en el cronómetro antes de cerrar la paleta"

function CerrarPaletaButton({
  disabled,
  onClick,
  className,
  variant = "outline",
}: {
  disabled: boolean
  onClick: () => void
  className?: string
  variant?: "outline" | "ghost"
}) {
  const btn = (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={cn(variant === "outline" ? "h-7 gap-1 px-2 text-xs" : "h-7 text-xs", className)}
      onClick={onClick}
      disabled={disabled}
    >
      {variant === "outline" ? <PackageCheck className="h-3.5 w-3.5" /> : null}
      Cerrar paleta
    </Button>
  )
  if (!disabled) return btn
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{btn}</span>
        </TooltipTrigger>
        <TooltipContent side="top">{CERRAR_PALETA_OPERATE_TOOLTIP}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

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
  readOnlyOps,
  onRequestSave,
  onApplyCerrarTurno,
  onRequestCerrarTurno,
  canOperateProduction = false,
  corTurno: corTurnoProp = "",
  corGrupo: corGrupoProp = "",
  corOperador: corOperadorProp = "",
  corAyudante: corAyudanteProp = "",
  corSupervisor: corSupervisorProp = "",
  onSetTurno: onSetTurnoProp,
  onSetGrupo: onSetGrupoProp,
  onActivePersonnelApply: onActivePersonnelApplyProp,
  patchActiveTurn: patchActiveTurnProp,
  startProductionTimer: startProductionTimerProp,
  pauseProductionTimer: pauseProductionTimerProp,
  confirmPauseAndResume: confirmPauseAndResumeProp,
  pauseReason: pauseReasonProp = "",
  pauseObs: pauseObsProp = "",
  setPauseReason: setPauseReasonProp,
  setPauseObs: setPauseObsProp,
  pauseMotivoDialogOpen: pauseMotivoDialogOpenProp,
  onPauseMotivoDialogOpenChange: onPauseMotivoDialogOpenChangeProp,
}: Props) {
  const opsReadOnly = readOnlyOps ?? readOnly
  const formFieldId = useId().replace(/:/g, "")
  const mk = (suffix: string) => `${formFieldId}-${suffix}`
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [pauseReasonLocal, setPauseReasonLocal] = useState("")
  const [pauseObsLocal, setPauseObsLocal] = useState("")
  const [pauseMotivoDialogOpenLocal, setPauseMotivoDialogOpenLocal] = useState(false)
  const pauseReason = pauseReasonProp || pauseReasonLocal
  const setPauseReason = setPauseReasonProp ?? setPauseReasonLocal
  const pauseObs = pauseObsProp || pauseObsLocal
  const setPauseObs = setPauseObsProp ?? setPauseObsLocal
  const pauseMotivoDialogOpen = pauseMotivoDialogOpenProp ?? pauseMotivoDialogOpenLocal
  const setPauseMotivoDialogOpen =
    onPauseMotivoDialogOpenChangeProp ?? setPauseMotivoDialogOpenLocal
  const [pauseParadaComboOpen, setPauseParadaComboOpen] = useState(false)
  const [draftTurno, setDraftTurno] = useState<"diurno" | "nocturno">("diurno")
  const [draftGrupo, setDraftGrupo] = useState<"A" | "B" | "C">("A")
  const [draftPeople, setDraftPeople] = useState<DraftPerson[]>([])
  const [draftStaging, setDraftStaging] = useState<{ name: string; role: DraftPersonRole }>({
    name: "",
    role: "operador",
  })

  const closedTurnos = useMemo(() => parseCorteTurnos(form[COR_TURNOS_KEY], form), [form])
  const activeTurno = useMemo(() => materializeOpenCorteTurnoActual(form), [form])
  const hasActiveTurno = activeTurno !== null
  const turnoUi =
    coerceTurnoUi(activeTurno?.turno ?? "") ||
    coerceTurnoUi(readString(form.corTurno)) ||
    coerceTurnoUi(corTurnoProp)
  const grupoUi =
    coerceGrupoUi(activeTurno?.grupo ?? "") ||
    coerceGrupoUi(readString(form.corGrupo)) ||
    coerceGrupoUi(corGrupoProp)
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
  const kgDespachoAcum = useMemo(() => sumSalidaKgFromClosedPaletas(corPaletas), [corPaletas])
  const kgProvisionalDespacho = useMemo(() => sumSalidaKgFromOpenPaletas(corPaletas), [corPaletas])
  const corteOp = useMemo(() => corteOperabilityFromForm(form), [form])
  const inputDisabled = opsReadOnly || !hasActiveTurno
  const paletaInputsDisabled = (p: CorPaleta) => inputDisabled || isCorPaletaCerrada(p)
  const canAddPaletaNow = corteOp.canAddPaleta && !opsReadOnly

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

  const activeTimer = resolveCorteDisplayTimer(activeTurno, form)
  const timerState = activeTimer.state || "pending"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const timerStopped = timerState === "stopped" || timerState === "completed"
  const effectiveAcc = activeTimer.effectiveAccSec
  const deadAcc = activeTimer.deadAccSec
  const lastResumeAt = activeTimer.lastResumeAtMs
  const pauseAt = activeTimer.pauseAtMs
  const effectiveSec = effectiveAcc + (timerRunning && lastResumeAt > 0 ? (nowMs - lastResumeAt) / 1000 : 0)
  const deadSec = deadAcc + (timerPaused && pauseAt > 0 ? (nowMs - pauseAt) / 1000 : 0)
  const totalSec = effectiveSec + deadSec
  const kgHora = effectiveSec > 0 ? (kgSalida / (effectiveSec / 3600)).toFixed(2) : "0.00"
  const mermaPct = kgIngresados > 0 ? ((kgMerma / kgIngresados) * 100).toFixed(2) : "0.00"
  const refilPct = kgIngresados > 0 ? ((scrapTotal / kgIngresados) * 100).toFixed(2) : "0.00"

  const pauseEntries = useMemo<CortePauseEntry[]>(() => {
    const raw =
      activeTimer.pauses.length > 0 ? activeTimer.pauses : form.corTimerPauses
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
  }, [activeTimer.pauses, form.corTimerPauses])

  useEffect(() => {
    if (!timerRunning && !timerPaused) return
    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerPaused, timerRunning])

  function setKey(key: string, value: unknown) {
    if (opsReadOnly) return
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setNumericSeries(key: string, values: string[]) {
    if (opsReadOnly) return
    setForm((prev) => ({ ...prev, [key]: values }))
  }

  function writeEntradaBobinasKg(next: string[]) {
    if (opsReadOnly) return
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

  const patchActiveTurnLocal = useCallback((updater: (t: CorteTurnoEntry) => CorteTurnoEntry) => {
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
  }, [setForm])
  const patchActiveTurn = patchActiveTurnProp ?? patchActiveTurnLocal

  function writePaletas(nextPaletas: CorPaleta[]) {
    if (opsReadOnly) return
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
    if (opsReadOnly) {
      toast.error("El área de corte está en solo lectura.")
      return
    }
    if (!corteOp.canAddPaleta) {
      toast.error(explainCannotAddPaleta(corteOp))
      return
    }
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

  function cerrarPaleta(index: number) {
    if (opsReadOnly) return
    if (!canOperateProduction) {
      toast.error("Abra turno de planta e inicie el cronómetro (play) antes de cerrar una paleta.")
      return
    }
    const target = corPaletas[index]
    if (!target || isCorPaletaCerrada(target)) return
    const kg = sumKgFromPaleta(target)
    if (kg <= 0) {
      toast.error("Registre al menos un rollo con peso antes de cerrar la paleta.")
      return
    }
    const ok = window.confirm(
      `¿Cerrar ${target.label}? Los ${kg.toFixed(2)} Kg pasarán a Despacho · producto terminado. Podrá seguir en otra paleta sin finalizar el área.`,
    )
    if (!ok) return

    const closed: CorPaleta = {
      ...target,
      status: "cerrada",
      closed_at: new Date().toISOString(),
    }
    let next = corPaletas.map((p, i) => (i === index ? closed : p))
    if (!next.some((p) => !isCorPaletaCerrada(p))) {
      const n = next.length + 1
      next = [
        ...next,
        {
          id: newCorteTurnoId(),
          label: `Paleta #${String(n).padStart(2, "0")}`,
          rollosKg: emptyPaletaRollos(),
          status: "en_progreso" as const,
        },
      ]
    }
    const patch = {
      cor_paletas: next,
      corSalidaPaletasKg: next.map((p) => p.rollosKg),
    }
    const toSave = syncCorteFormMetrics({ ...form, ...patch })
    writePaletas(next)
    void (async () => {
      if (!onRequestSave) {
        toast.success(`${target.label} cerrada. Saldo visible en Despacho · producto terminado.`)
        return
      }
      const ok = await onRequestSave(toSave, {
        suppressSuccessToast: true,
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
      })
      if (ok) {
        toast.success(
          `${target.label} cerrada (${kg.toFixed(2)} kg). Consulte Despacho · producto terminado; si no aparece, revise el aviso al guardar.`,
        )
      } else {
        toast.error(
          `${target.label} quedó cerrada en pantalla pero no se guardó en el servidor. Pulse Guardar de nuevo.`,
        )
      }
    })()
  }

  function removePaleta(index: number) {
    if (inputDisabled) return
    const target = corPaletas[index]
    if (target && isCorPaletaCerrada(target)) {
      toast.error("No se puede eliminar una paleta ya cerrada (está en despacho).")
      return
    }
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
    if (opsReadOnly) return
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
    setForm((prev) => {
      const nextForm: Record<string, unknown> = {
        ...prev,
        [COR_ACTUAL_KEY]: t,
        ...corteTurnoToMirror(t),
        [COR_TURNOS_KEY]: parseCorteTurnos(prev[COR_TURNOS_KEY], prev),
      }
      queueMicrotask(() => {
        void onRequestSave?.(nextForm, {
          suppressSuccessToast: true,
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
        })
      })
      return nextForm
    })
    setDraftPeople([])
    setDraftStaging({ name: "", role: "operador" })
    toast.success(
      "Turno de planta abierto y guardado. Use el cronómetro (play) para registrar tiempos.",
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
      queueMicrotask(() =>
        onRequestSave?.(next, { clearTurnoActual: true, suppressSuccessToast: true }),
      )
      return next
    })
    toast.success("Turno cerrado. Puede iniciar otro turno cuando corresponda.")
  }

  function cerrarTurnoActual() {
    if (opsReadOnly) return
    const cur = activeTurno
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

  const onSetTurno =
    onSetTurnoProp ??
    ((v: "diurno" | "nocturno") => {
      patchActiveTurn((t) => ({ ...t, turno: v }))
    })

  const onSetGrupo =
    onSetGrupoProp ??
    ((v: "A" | "B" | "C") => {
      patchActiveTurn((t) => ({ ...t, grupo: v }))
    })

  const onActivePersonnelApply =
    onActivePersonnelApplyProp ??
    ((people: DraftPerson[]) => {
      const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
      patchActiveTurn((t) => ({ ...t, operador, ayudante, supervisor }))
    })

  const [activeStageName, setActiveStageName] = useState("")
  const [activeStageRole, setActiveStageRole] = useState<DraftPersonRole>("operador")
  const activeSaved = useMemo(
    () =>
      activePersonnelFromStrings(
        corOperadorProp || readString(form.corOperador),
        corAyudanteProp || readString(form.corAyudante),
        corSupervisorProp || readString(form.corSupervisor),
      ),
    [corOperadorProp, corAyudanteProp, corSupervisorProp, form.corOperador, form.corAyudante, form.corSupervisor],
  )

  const guardarPersonaTurnoActivo = useCallback(() => {
    const name = activeStageName.trim()
    if (!name) {
      toast.error("Escriba el nombre antes de guardar.")
      return
    }
    if (activeStageRole === "supervisor" && activeSaved.some((p) => p.role === "supervisor")) {
      toast.warning("Solo puede haber un Supervisor en el turno.")
      return
    }
    if (activeStageRole === "operador" && activeSaved.some((p) => p.role === "operador")) {
      toast.warning("Solo puede haber un Operador principal en el turno.")
      return
    }
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    onActivePersonnelApply([...activeSaved, { id, role: activeStageRole, name }])
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

  function startProductionTimerLocal() {
    if (opsReadOnly) return
    if (!hasActiveTurno) {
      toast.error("Primero inicie un turno de planta.")
      return
    }
    setForm((prev) => startCorteProductionTimerOnForm(prev) ?? prev)
  }

  const startProductionTimer = startProductionTimerProp ?? startProductionTimerLocal

  function pauseProductionTimerLocal() {
    if (opsReadOnly) return
    if (!timerRunning) {
      toast.message("El cronómetro no está en marcha.")
      return
    }
    const now = Date.now()
    setForm((prev) => {
      const next = pauseCorteProductionTimerOnForm(prev, now)
      if (!next) {
        toast.error("No se pudo pausar el cronómetro. Guarde el turno e intente de nuevo.")
        return prev
      }
      queueMicrotask(() => onRequestSave?.(next, { suppressSuccessToast: true }))
      return next
    })
    setPauseMotivoDialogOpen(true)
  }

  const pauseProductionTimer = pauseProductionTimerProp ?? pauseProductionTimerLocal

  function confirmPauseAndResumeLocal() {
    const reason = pauseReason.trim()
    if (!reason) {
      toast.error("Seleccione el motivo de parada.")
      return
    }
    const now = Date.now()
    setForm((prev) => {
      const cur = materializeOpenCorteTurnoActual(prev)
      if (!cur || cur.timer.state !== "paused") return prev
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
              obs: pauseObs.trim(),
              duration_sec: pauseDurationSec,
            },
          ],
        },
      }
      const nextForm = {
        ...prev,
        [COR_ACTUAL_KEY]: nextTurn,
        ...corteTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => onRequestSave?.(nextForm, { suppressSuccessToast: true }))
      return nextForm
    })
    setPauseReason("")
    setPauseObs("")
    setPauseMotivoDialogOpen(false)
    toast.message("Parada registrada. Use play para reanudar el tiempo efectivo.")
  }

  const confirmPauseAndResume = confirmPauseAndResumeProp ?? confirmPauseAndResumeLocal

  const pauseParadaComboLabel = pauseReason.trim() || "Seleccione motivo…"

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
          <div className="mes-footer-bar__item flex items-start gap-2">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              Kg despacho (cerradas): <strong>{kgDespachoAcum.toFixed(2)} Kg</strong>
            </span>
          </div>
          <div className="mes-footer-bar__item flex items-start gap-2">
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span>
              Kg despacho (provisional): <strong>{kgProvisionalDespacho.toFixed(2)} Kg</strong>
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
                    <div className="space-y-1">
                      {fieldLabel(mk("draft-person-name"), UserRound, "Nombre")}
                      <Input
                        id={mk("draft-person-name")}
                        name="corDraftPersonName"
                        className="h-9"
                        value={draftStaging.name}
                        onChange={(e) => setDraftStaging((s) => ({ ...s, name: e.target.value }))}
                        placeholder="Nombre"
                      />
                    </div>
                    <div className="space-y-1">
                      {fieldLabel(mk("draft-person-role"), IdCard, "Rol")}
                      <Select
                        value={draftStaging.role}
                        onValueChange={(v) => setDraftStaging((s) => ({ ...s, role: v as DraftPersonRole }))}
                      >
                        <SelectTrigger id={mk("draft-person-role")} className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operador">Operador</SelectItem>
                          <SelectItem value="ayudante">Ayudante</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={() => onDraftPersonGuardar(draftStaging.name, draftStaging.role)}><UserPlus className="mr-1 h-4 w-4" />Guardar persona</Button>
                  {draftPeople.map((p) => (
                    <div key={p.id} className="flex justify-between rounded border px-2 py-1 text-xs">
                      <span>{p.name} — {roleLabelEs(p.role)}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDraftPeople((prev) => prev.filter((x) => x.id !== p.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                  <Button type="button" className="w-full" onClick={onIniciarTurno} disabled={opsReadOnly || draftOperadorMissing}><CirclePlay className="mr-2 h-4 w-4" />Iniciar turno</Button>
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
        <MesSectionShell
          title={mesSectionTitle(ClipboardList, "Información del turno")}
          headerRight={<MesSectionHeaderExtras isDone={doneInfoTurno} />}
        >
          <p className="text-muted-foreground mb-3 border-b border-border/50 pb-3 text-xs leading-snug">
            Turno de planta (calendario y cuadrilla) y personal del registro actual. El cronómetro está en la sección
            siguiente. Para cerrar la sesión use{" "}
            <span className="font-semibold text-foreground">Cerrar turno</span> en el cronómetro.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              {fieldLegend(Clock, "Turno")}
              <div className="mes-toggle-row mes-toggle-turno">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  className="w-full"
                  value={turnoUi || undefined}
                  onValueChange={(v) => {
                    if (!v) return
                    onSetTurno(v as "diurno" | "nocturno")
                  }}
                  disabled={opsReadOnly}
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
              {fieldLegend(Users, "Grupo")}
              <div className="mes-toggle-row mes-toggle-grupo">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  className="w-full"
                  value={grupoUi || undefined}
                  onValueChange={(v) => {
                    if (!v) return
                    onSetGrupo(v as "A" | "B" | "C")
                  }}
                  disabled={opsReadOnly}
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
              <p className="mes-field-hint">Cuadrilla o equipo asignado (rotación A / B / C).</p>
            </div>
            <div className="md:col-span-2 mt-1 rounded-lg border bg-background/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Personal del turno
              </div>
              <div className="space-y-3 rounded-md border bg-background p-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2">
                  <div className="min-w-0 space-y-1">
                    {fieldLabel(
                      mk("active-person-name"),
                      UserRound,
                      <>
                        Nombre
                        {activeStageRole === "operador" ? (
                          <span className="text-muted-foreground"> (operador)</span>
                        ) : null}
                      </>,
                    )}
                    <Input
                      id={mk("active-person-name")}
                      name="corActivePersonName"
                      className="ot-input-unified h-9 w-full min-w-0"
                      value={activeStageName}
                      onChange={(e) => setActiveStageName(e.target.value)}
                      placeholder="Nombre"
                      disabled={opsReadOnly}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    {fieldLabel(mk("active-person-role"), IdCard, "Rol")}
                    <Select
                      value={activeStageRole}
                      onValueChange={(v) => setActiveStageRole(v as DraftPersonRole)}
                      disabled={opsReadOnly}
                    >
                      <SelectTrigger id={mk("active-person-role")} className="h-9 w-full min-w-0">
                        <SelectValue placeholder="Seleccione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="ayudante">Ayudante</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 w-full gap-1.5 sm:w-auto"
                  onClick={guardarPersonaTurnoActivo}
                  disabled={opsReadOnly}
                >
                  <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                  Guardar persona
                </Button>
              </div>
              <Collapsible defaultOpen className="mt-3 rounded-md border border-dashed bg-muted/20">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted/40">
                  <span className="inline-flex items-center gap-2">
                    <History className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                    Personal en este turno ({activeSaved.length})
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {activeSaved.length === 0 ? (
                    <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                      Nadie registrado aún. Guarde operador, ayudantes o supervisor con el botón de arriba.
                    </div>
                  ) : (
                    <ul className="space-y-1 border-t px-3 py-2">
                      {activeSaved.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-xs"
                        >
                          <span>
                            <span className="font-medium text-foreground">{p.name}</span>
                            <span className="text-muted-foreground"> — {roleLabelEs(p.role)}</span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => onActivePersonnelApply(activeSaved.filter((x) => x.id !== p.id))}
                            disabled={opsReadOnly}
                            title="Quitar de la lista"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
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
        {hasActiveTurno ? (
          <div className="mb-3 rounded-md border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs leading-snug text-foreground">
            <span className="font-semibold">Cronómetro (máquina):</span> cuenta tiempo efectivo y paradas.{" "}
            <span className="font-semibold">Parada</span> detiene el efectivo y pide motivo (tiempo muerto);{" "}
            <span className="font-semibold">no</span> cierra el turno de planta. Use{" "}
            <span className="font-semibold">Cerrar turno</span> para terminar la sesión.
          </div>
        ) : (
          <div className="mb-3 rounded-md border border-dashed border-slate-400 bg-white px-3 py-2 text-xs text-slate-600">
            Primero abra un <span className="font-semibold text-foreground">turno de planta</span> con{" "}
            <span className="font-semibold text-foreground">Iniciar turno</span> arriba. Después use play aquí para el
            cronómetro.
          </div>
        )}
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
                        disabled={opsReadOnly || !hasActiveTurno || timerRunning}
                      >
                        <CirclePlay className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Iniciar cronómetro (tiempo efectivo)</TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <span className="mes-timer-action-label flex flex-col items-center gap-0 leading-tight">
                    <span>Parada</span>
                    <span className="text-[10px] font-normal text-muted-foreground">motivo</span>
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-secondary shrink-0"
                        aria-label="Pausar cronómetro y registrar motivo de parada"
                        onClick={pauseProductionTimer}
                        disabled={opsReadOnly || !timerRunning}
                      >
                        <CirclePause className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Pausar cronómetro (parada)</TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <span className="mes-timer-action-label">Cerrar turno</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-danger-outline shrink-0"
                        aria-label="Fin turno"
                        onClick={cerrarTurnoActual}
                        disabled={opsReadOnly || !hasActiveTurno}
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
        {timerPaused && !pauseMotivoDialogOpen ? (
          <div className="mt-2 flex justify-center md:justify-end">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-normal text-amber-800 underline-offset-4 hover:text-amber-950"
              onClick={() => setPauseMotivoDialogOpen(true)}
            >
              Motivo de parada
            </Button>
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
              <Label htmlFor={mk(`entrada-bobina-${idx}`)} className="ot-label">
                {idx + 1}
              </Label>
              <Input
                id={mk(`entrada-bobina-${idx}`)}
                name={`corEntradaBobinaKg_${idx + 1}`}
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
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={!canAddPaletaNow}
            onClick={addPaleta}
          >
            <PlusCircle className="mr-1 h-4 w-4" />
            Agregar paleta
          </Button>
        }
      >
        <p className="text-muted-foreground mb-2 text-xs leading-snug">
          Registre peso en al menos un rollo de la paleta (con todo en 0 no hay saldo en Despacho). Cierre cada paleta al
          terminar el lote: los kg pasan a Despacho · producto terminado sin finalizar el área. Requiere turno abierto y
          cronómetro iniciado (play).
        </p>
        {entradaBobinasTotal > 0 && salidaTotalKg <= 0 ? (
          <div
            className="mb-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-950 dark:text-amber-100"
            role="status"
          >
            <span className="font-semibold">Ingreso registrado ({entradaBobinasTotal.toFixed(2)} Kg)</span> no genera
            saldo en Despacho. Escriba kg en los rollos de esta sección, pulse{" "}
            <span className="font-semibold">Guardar</span> y, para la nota de entrega,{" "}
            <span className="font-semibold">Cerrar paleta</span>.
          </div>
        ) : null}
        <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
          {salidaPaletas.map((paleta, paletaIdx) => {
            const meta = corPaletas[paletaIdx]
            return (
            <div
              key={`paleta-${paletaIdx}`}
              className={cn(
                "rounded-lg border bg-background",
                corPaletas[paletaIdx] &&
                  isCorPaletaCerrada(corPaletas[paletaIdx]) &&
                  "border-emerald-500/35 bg-emerald-500/[0.04]",
              )}
            >
              <div className="flex items-center justify-between border-b px-2 py-1.5">
                <strong className="text-sm">{corPaletas[paletaIdx]?.label ?? `Paleta #${String(paletaIdx + 1).padStart(2, "0")}`}</strong>
                <div className="inline-flex flex-wrap items-center justify-end gap-1">
                  {corPaletas[paletaIdx] && isCorPaletaCerrada(corPaletas[paletaIdx]) ? (
                    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-950">En despacho</Badge>
                  ) : null}
                  <Badge variant="outline">{`${salidaPaletasRollos[paletaIdx]}/${COR_ROLLOS_PER_PALETA}`}</Badge>
                  {corPaletas[paletaIdx] && !isCorPaletaCerrada(corPaletas[paletaIdx]) ? (
                    <CerrarPaletaButton
                      disabled={
                        !canOperateProduction ||
                        sumKgFromPaleta(corPaletas[paletaIdx]!) <= 0
                      }
                      onClick={() => cerrarPaleta(paletaIdx)}
                    />
                  ) : null}
                  {corPaletas[paletaIdx] && !isCorPaletaCerrada(corPaletas[paletaIdx]) ? (
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
                  ) : null}
                </div>
              </div>

              <div className="space-y-2 p-2">
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label htmlFor={mk(`paleta-${paletaIdx}-rollos-count`)} className="ot-label">
                      Rollos
                    </Label>
                    <Input
                      id={mk(`paleta-${paletaIdx}-rollos-count`)}
                      name={`corPaleta${paletaIdx + 1}RollosCount`}
                      className="ot-input-unified h-8"
                      value={String(salidaPaletasRollos[paletaIdx] ?? 0)}
                      readOnly
                    />
                  </div>
                  <div>
                    <Label htmlFor={mk(`paleta-${paletaIdx}-total-kg`)} className="ot-label">
                      Total Kg
                    </Label>
                    <Input
                      id={mk(`paleta-${paletaIdx}-total-kg`)}
                      name={`corPaleta${paletaIdx + 1}TotalKg`}
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
                      <Label
                        htmlFor={mk(`paleta-${paletaIdx}-rollo-${rolloIdx}`)}
                        className="ot-label text-[10px]"
                      >
                        {rolloIdx + 1}
                      </Label>
                      <Input
                        id={mk(`paleta-${paletaIdx}-rollo-${rolloIdx}`)}
                        name={`corPaleta${paletaIdx + 1}RolloKg_${rolloIdx + 1}`}
                        className="ot-input-unified h-7 px-2 text-xs"
                        inputMode="decimal"
                        value={valor}
                        disabled={meta ? paletaInputsDisabled(meta) : inputDisabled}
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
            )
          })}
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PackageSearch, "Proceso de corte")}
        subtle
        bodyClassName="mes-section__body--flush"
      >
        <p className="text-muted-foreground mb-3 text-xs leading-snug">
          <span className="font-medium text-foreground">Kg salida</span> incluye paletas abiertas y cerradas.
          Solo las paletas <span className="font-medium text-foreground">cerradas</span> (botón Cerrar paleta) pasan a
          Despacho · producto terminado.
        </p>
        <div className="mes-stat-grid mes-stat-grid--4">
          <MesStatTile
            label="Kg ingresados"
            value={`${entradaBobinasTotal.toFixed(2)} Kg`}
            icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Kg salida (plantas)"
            value={`${salidaTotalKg.toFixed(2)} Kg`}
            icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Kg en despacho (cerradas)"
            value={`${kgDespachoAcum.toFixed(2)} Kg`}
            tone="positive"
            icon={<PackageCheck className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Kg despacho (provisional)"
            value={`${kgProvisionalDespacho.toFixed(2)} Kg`}
            icon={<Package className="h-3.5 w-3.5" />}
          />
          <div className="mes-stat-tile"><Label htmlFor={mk("kg-merma-corte")} className="mes-stat-tile__label">
              Kg merma
            </Label>
            <Input
              id={mk("kg-merma-corte")}
              name="kgMermaCorte"
              className="ot-input-unified mt-1 h-8"
              inputMode="decimal"
              value={readString(form.kgMermaCorte)}
              onChange={(e) => setKey("kgMermaCorte", e.target.value)}
              placeholder="0"
            /></div>
          <div className="mes-stat-tile">
            <Label htmlFor={mk("metraje-corte")} className="mes-stat-tile__label">
              Metraje
            </Label>
            <Input
              id={mk("metraje-corte")}
              name="metrajeCorte"
              className="ot-input-unified mt-1 h-8"
              inputMode="decimal"
              value={readString(form.metrajeCorte)}
              onChange={(e) => setKey("metrajeCorte", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="mes-stat-grid mt-2 sm:grid-cols-3">
          <MesStatTile label="Merma %" value={`${mermaPct}%`} icon={<Percent className="h-3.5 w-3.5" />} />
          <MesStatTile label="Rendimiento" value={`${kgHora} Kg/h`} icon={<TrendingDown className="h-3.5 w-3.5" />} />
          <MesStatTile label="Metraje total" value={`${metraje.toFixed(2)} m`} icon={<Ruler className="h-3.5 w-3.5" />} />
        </div>
        <div className="mes-stat-grid mt-2 mes-stat-grid--4">
          <MesStatTile label="Salida total" value={`${salidaTotalKg.toFixed(2)} Kg`} icon={<ArrowUpFromLine className="h-3.5 w-3.5" />} />
          <MesStatTile
            label="Despacho (cerradas)"
            value={`${kgDespachoAcum.toFixed(2)} Kg`}
            tone="positive"
            icon={<PackageCheck className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Despacho (provisional)"
            value={`${kgProvisionalDespacho.toFixed(2)} Kg`}
            icon={<Package className="h-3.5 w-3.5" />}
          />
          <MesStatTile label="Merma" value={`${kgMerma.toFixed(2)} Kg`} icon={<Trash2 className="h-3.5 w-3.5" />} />
          <MesStatTile label="Paletas" value={salidaPaletas.length} />
          <MesStatTile label="Bobinas" value={bobinasSalidaCount} />
        </div>
      </MesSectionShell>

      <MesSectionShell title={mesSectionTitle(Recycle, "Scrap / Refil")} subtle>
        <div className="mb-3 space-y-2 rounded border bg-background/80 p-2">
          <Label id={mk("cor-desperdicio-sustrato-label")} className="text-muted-foreground text-xs font-medium">
            Sustrato del desperdicio (reporte)
          </Label>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Clasificación global de la OT en el reporte (mal corte y «auto» en refile/impreso). «Auto» usa la estructura
            del producto. Transparente aplica cuando el sustrato es film transparente / CPP.
          </p>
          <ToggleGroup
            type="single"
            aria-labelledby={mk("cor-desperdicio-sustrato-label")}
            className="flex flex-wrap justify-start gap-1"
            value={
              (() => {
                const s = normalizeScrapSubstrate(readString(form.corDesperdicioSustrato))
                return s === "bopp" || s === SCRAP_POLIETILENO || s === "transparente" ? s : "auto"
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
            <ToggleGroupItem value={SCRAP_POLIETILENO} className="text-xs">
              Polietileno
            </ToggleGroupItem>
            <ToggleGroupItem value="transparente" className="text-xs">
              Transparente
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 rounded border bg-background/80 p-2">
            <Label id={mk("cor-scrap-refile-destino-label")} className="text-muted-foreground text-xs font-medium">
              Destino refile (BOPP / PE)
            </Label>
            <p className="text-muted-foreground text-[11px] leading-snug">«Auto» hereda el sustrato global o la estructura.</p>
            <ToggleGroup
              type="single"
              aria-labelledby={mk("cor-scrap-refile-destino-label")}
              className="flex flex-wrap justify-start gap-1"
              value={
                (() => {
                  const s = normalizeScrapSubstrate(readString(form.corScrapRefileDestino))
                  return s === "bopp" || s === SCRAP_POLIETILENO ? s : "auto"
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
              <ToggleGroupItem value={SCRAP_POLIETILENO} className="text-xs">
                Polietileno
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1 rounded border bg-background/80 p-2">
            <Label id={mk("cor-scrap-impreso-destino-label")} className="text-muted-foreground text-xs font-medium">
              Destino impreso corte (BOPP / PE)
            </Label>
            <p className="text-muted-foreground text-[11px] leading-snug">«Auto» hereda el sustrato global o la estructura.</p>
            <ToggleGroup
              type="single"
              aria-labelledby={mk("cor-scrap-impreso-destino-label")}
              className="flex flex-wrap justify-start gap-1"
              value={
                (() => {
                  const s = normalizeScrapSubstrate(readString(form.corScrapImpresoDestino))
                  return s === "bopp" || s === SCRAP_POLIETILENO ? s : "auto"
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
              <ToggleGroupItem value={SCRAP_POLIETILENO} className="text-xs">
                Polietileno
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border bg-background p-2 text-sm">
            <Label htmlFor={mk("cor-scrap-refile-kg")} className="text-muted-foreground">
              Refile (Kg)
            </Label>
            <Input
              id={mk("cor-scrap-refile-kg")}
              name="corScrapRefileKg"
              className="ot-input-unified mt-1 h-8"
              inputMode="decimal"
              value={readString(form.corScrapRefileKg)}
              onChange={(e) => setKey("corScrapRefileKg", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <Label htmlFor={mk("cor-scrap-impreso-kg")} className="text-muted-foreground">
              Impreso (Kg)
            </Label>
            <Input
              id={mk("cor-scrap-impreso-kg")}
              name="corScrapImpresoKg"
              className="ot-input-unified mt-1 h-8"
              inputMode="decimal"
              value={readString(form.corScrapImpresoKg)}
              onChange={(e) => setKey("corScrapImpresoKg", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <Label htmlFor={mk("cor-scrap-mal-corte-kg")} className="text-muted-foreground">
              Mal corte (Kg)
            </Label>
            <Input
              id={mk("cor-scrap-mal-corte-kg")}
              name="corScrapMalCorteKg"
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
              {corPaletas.map((p, idx) => (
                <tr key={`res-paleta-${p.id ?? idx}`} className="border-b">
                  <td className="py-1.5 pl-2 pr-2">{p.label ?? `Paleta #${String(idx + 1).padStart(2, "0")}`}</td>
                  <td className="py-1.5 pr-2 text-center">—</td>
                  <td className="py-1.5 pr-2 text-center">{countRollosWithKg(p)}</td>
                  <td className="py-1.5 pr-2 text-right">{sumKgFromPaleta(p).toFixed(2)}</td>
                  <td className="py-1.5 text-center">
                    {isCorPaletaCerrada(p) ? (
                      <Badge variant="outline" className="text-xs border-emerald-500/40 bg-emerald-500/10">
                        En despacho
                      </Badge>
                    ) : sumKgFromPaleta(p) > 0 ? (
                      <Badge
                        variant="outline"
                        className="text-xs border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                      >
                        Provisional en despacho
                      </Badge>
                    ) : (
                      <CerrarPaletaButton
                        variant="ghost"
                        disabled={!canOperateProduction || sumKgFromPaleta(p) <= 0}
                        onClick={() => cerrarPaleta(idx)}
                      />
                    )}
                  </td>
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
        <Label htmlFor={mk("cor-observaciones")} className="sr-only">
          Observaciones
        </Label>
        <Textarea
          id={mk("cor-observaciones")}
          name="corObservaciones"
          className="min-h-24"
          value={readString(form.corObservaciones)}
          onChange={(e) => setKey("corObservaciones", e.target.value)}
          placeholder="Observaciones adicionales..."
        />
      </MesSectionShell>
      </>
      ) : null}

      <Dialog
        open={pauseMotivoDialogOpen}
        onOpenChange={(open) => {
          setPauseMotivoDialogOpen(open)
          if (!open) setPauseParadaComboOpen(false)
        }}
      >
        <DialogContent className="max-w-md border-amber-300 bg-background shadow-xl">
          <DialogHeader>
            <DialogTitle>Registrar motivo de parada</DialogTitle>
            <DialogDescription>
              Indique el motivo de esta parada y guárdelo. El cronómetro{" "}
              <span className="font-medium text-foreground">sigue en pausa</span> hasta que pulse play para reanudar el
              tiempo efectivo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor={mk("pause-motivo")}>Motivo</Label>
              <Popover open={pauseParadaComboOpen} onOpenChange={setPauseParadaComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    id={mk("pause-motivo")}
                    variant="outline"
                    role="combobox"
                    aria-expanded={pauseParadaComboOpen}
                    className="h-9 w-full justify-between gap-2 rounded-md border border-input bg-background px-3 font-normal shadow-sm"
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-left text-sm",
                        !pauseReason.trim() && "text-muted-foreground",
                      )}
                    >
                      {pauseParadaComboLabel}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar motivo…" className="h-9" />
                    <CommandList className="max-h-60">
                      <CommandEmpty>Sin coincidencias.</CommandEmpty>
                      <CommandGroup>
                        {COR_PAUSE_REASONS.map((reason) => (
                          <CommandItem
                            key={reason}
                            value={reason}
                            onSelect={() => {
                              setPauseReason(reason)
                              setPauseParadaComboOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                reason === pauseReason ? "opacity-100" : "opacity-0",
                              )}
                              aria-hidden
                            />
                            {reason}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor={mk("pause-obs")}>Observación (opcional)</Label>
              <Input
                id={mk("pause-obs")}
                name="corPauseObs"
                value={pauseObs}
                onChange={(e) => setPauseObs(e.target.value)}
                placeholder="Detalle breve (opcional)"
                className="ot-input-unified h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPauseMotivoDialogOpen(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={confirmPauseAndResume}>
              Registrar parada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

