import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  AlarmClock,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  CirclePlay,
  ClipboardList,
  Clock,
  Factory,
  Hash,
  History,
  Hourglass,
  IdCard,
  Printer,
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
  Sparkles,
  Sun,
  Timer,
  Trash2,
  TrendingDown,
  Weight,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"

import {
  CortePaletasSectionFooter,
  CortePaletasSectionToolbar,
} from "@/components/axones/CortePaletasSectionFooter"
import { MesBobinaKgSlotCell } from "@/components/axones/MesBobinaKgSlotCell"
import { CortePaletaRollosPaginatedGrid } from "@/components/axones/CortePaletaRollosPaginatedGrid"
import {
  fieldLegend,
  MesSectionHeaderExtras,
  MesSectionShell,
  MesStatTile,
  mesSectionTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  corteOperabilityFromForm,
  explainCannotAddPaleta,
} from "@/lib/corte-paleta-flow"
import { normalizeScrapSubstrate, SCRAP_POLIETILENO } from "@/lib/scrap-substrate"
import { showAxonesSuccessSwal } from "@/lib/axones-success-swal"
import { isBobinaKgSlotFilled, parseBobinaKgSlotNumber } from "@/lib/bobina-kg-slot"
import { cumulativeArranqueSeconds, cumulativeDemountSeconds } from "@/lib/mes-phase-timer-fields"
import { formatHoraArranqueFromMs, horaArranqueMsFromTimer } from "@/lib/mes-timer-band-shared"
import { cn } from "@/lib/utils"

import { MES_TIMER_HELP_TEXT, MesProductionTimerOpsBlock } from "./mes-production-timer-ops-block"
import type { MesTimerActionFlags, MesTimerConfirmKey } from "./mes-timer-actions"

import {
  CORTE_PALETAS_CONTAINER_GRID,
  cortePaletaCardClass,
  getCortePaletaTheme,
} from "@/pages/axones/corte-paleta-rollos-ui"
import {
  clampCortePaletaPage,
  cortePaletaTotalPages,
  useCortePaletaPageSize,
} from "@/pages/axones/use-corte-paleta-page-size"
import {
  COR_ACTUAL_KEY,
  COR_ENTRADA_META_KEY,
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
  emptyBobinaLabelMeta,
  type BobinaLabelMeta,
} from "./corte-turnos"
import { getMetaSeries, normalizeNumericString, validateBobinaLabelSave } from "./laminacion-turnos"
import {
  bobinaLabelDraftFromMeta,
  bobinaLabelTooltipText,
  hasBobinaLabelMeta,
  MesBobinaEntradaLabelDialog,
  normalizeEntradaLabelForSave,
} from "./mes-bobina-entrada-label-dialog"
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
  hasActiveTurno?: boolean
  areaFinalizada?: boolean
  canFinalizeOrder?: boolean
  turnosRegistrados?: number
  ultimoTurnoLabel?: string
  closedTurnos?: CorteTurnoEntry[]
  timerState?: string
  totalSec?: number
  deadSec?: number
  effectiveSec?: number
  demountSec?: number
  /** Tiempo de arranque acumulado (OT o turno según `timerShowsOtAccumulated`). */
  arranqueSec?: number
  timerShowsOtAccumulated?: boolean
  kgHora?: string
  horaArranque?: string
  arranqueRunning?: boolean
  demountRunning?: boolean
  timerRunning?: boolean
  timerPaused?: boolean
  timerActionFlags?: MesTimerActionFlags
  onRequestTimerConfirm?: (key: MesTimerConfirmKey) => void
  onPreviewTimerReport?: () => void
  formatTimerHms?: (s: number) => string
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
  pauseEntries?: CortePauseEntry[]
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

function corteDesperdicioDestinoValue(raw: string): "auto" | "bopp" | typeof SCRAP_POLIETILENO {
  const s = normalizeScrapSubstrate(raw)
  return s === "bopp" || s === SCRAP_POLIETILENO ? s : "auto"
}

function corteDesperdicioSustratoValue(raw: string): "auto" | "bopp" | typeof SCRAP_POLIETILENO | "transparente" {
  const s = normalizeScrapSubstrate(raw)
  return s === "bopp" || s === SCRAP_POLIETILENO || s === "transparente" ? s : "auto"
}

function CorteDesperdicioDestinoToggle({
  idPrefix,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const normalized = corteDesperdicioDestinoValue(value)
  return (
    <div className="mes-scrap-destino space-y-1.5">
      <Label id={`${idPrefix}-label`} className="mes-scrap-destino__label text-muted-foreground">
        {label}
      </Label>
      {hint ? <p className="text-muted-foreground text-[10px] leading-snug">{hint}</p> : null}
      <ToggleGroup
        type="single"
        aria-labelledby={`${idPrefix}-label`}
        className="mes-scrap-toggle-group flex flex-wrap justify-start gap-1"
        value={normalized}
        onValueChange={(v) => {
          if (!v || disabled) return
          onChange(v === "auto" ? "" : v)
        }}
        disabled={disabled}
      >
        <ToggleGroupItem value="auto" className="mes-scrap-toggle-item h-7 px-2 text-xs">
          Auto
        </ToggleGroupItem>
        <ToggleGroupItem value="bopp" className="mes-scrap-toggle-item mes-scrap-toggle-item--bopp h-7 px-2 text-xs">
          BOPP
        </ToggleGroupItem>
        <ToggleGroupItem
          value={SCRAP_POLIETILENO}
          className="mes-scrap-toggle-item mes-scrap-toggle-item--pe h-7 px-2 text-xs"
        >
          Polietileno
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

function CorteDesperdicioSustratoToggle({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const normalized = corteDesperdicioSustratoValue(value)
  return (
    <ToggleGroup
      type="single"
      aria-labelledby={`${idPrefix}-label`}
      className="mes-scrap-toggle-group flex flex-wrap justify-start gap-1"
      value={normalized}
      onValueChange={(v) => {
        if (!v || disabled) return
        onChange(v === "auto" ? "" : v)
      }}
      disabled={disabled}
    >
      <ToggleGroupItem value="auto" className="mes-scrap-toggle-item h-7 px-2 text-xs">
        Auto
      </ToggleGroupItem>
      <ToggleGroupItem value="bopp" className="mes-scrap-toggle-item mes-scrap-toggle-item--bopp h-7 px-2 text-xs">
        BOPP
      </ToggleGroupItem>
      <ToggleGroupItem
        value={SCRAP_POLIETILENO}
        className="mes-scrap-toggle-item mes-scrap-toggle-item--pe h-7 px-2 text-xs"
      >
        Polietileno
      </ToggleGroupItem>
      <ToggleGroupItem value="transparente" className="mes-scrap-toggle-item h-7 px-2 text-xs">
        Transparente
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

const DRAFT_PEOPLE_PAGE_SIZE = 5

const MES_CORTE_CONFIRM_INDIGO = {
  panel:
    "border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-indigo-950/35 dark:to-background",
  iconBox:
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-100/80 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/45 dark:text-indigo-300",
}

type MesCorteConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
}

function MesCorteConfirmDialog(props: MesCorteConfirmDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={MES_CORTE_CONFIRM_INDIGO.panel}>
        <DialogHeader className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className={MES_CORTE_CONFIRM_INDIGO.iconBox}>{props.icon}</div>
            <div className="min-w-0 space-y-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">{props.title}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">{props.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => props.onConfirm()}>
            {props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  hasActiveTurno: hasActiveTurnoProp,
  areaFinalizada = false,
  canFinalizeOrder = false,
  turnosRegistrados: turnosRegistradosProp,
  ultimoTurnoLabel: ultimoTurnoLabelProp,
  closedTurnos: closedTurnosProp,
  timerState: timerStateProp,
  totalSec: totalSecProp,
  deadSec: deadSecProp,
  effectiveSec: effectiveSecProp,
  demountSec: demountSecProp,
  arranqueSec: arranqueSecProp,
  timerShowsOtAccumulated,
  kgHora: kgHoraProp,
  horaArranque: horaArranqueProp,
  arranqueRunning = false,
  demountRunning = false,
  timerRunning: timerRunningProp,
  timerPaused: timerPausedProp,
  timerActionFlags,
  onRequestTimerConfirm,
  onPreviewTimerReport,
  formatTimerHms: formatTimerHmsProp,
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
  pauseEntries: pauseEntriesProp,
}: Props) {
  const opsReadOnly = readOnlyOps ?? readOnly
  const multiPhaseTimer = Boolean(timerActionFlags && onRequestTimerConfirm)
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
  const [cumulativeTurnosDialogOpen, setCumulativeTurnosDialogOpen] = useState(false)
  const [draftTurno, setDraftTurno] = useState<"diurno" | "nocturno">("diurno")
  const [draftGrupo, setDraftGrupo] = useState<"A" | "B" | "C">("A")
  const [draftPeople, setDraftPeople] = useState<DraftPerson[]>([])
  const [draftStaging, setDraftStaging] = useState<{ name: string; role: DraftPersonRole }>({
    name: "",
    role: "operador",
  })
  const [draftPeopleQuery, setDraftPeopleQuery] = useState("")
  const [draftPeoplePage, setDraftPeoplePage] = useState(1)
  const [startTurnConfirmOpen, setStartTurnConfirmOpen] = useState(false)
  const [labelEditorOpen, setLabelEditorOpen] = useState(false)
  const [labelEditorIndex, setLabelEditorIndex] = useState(0)
  const [labelEditorDraft, setLabelEditorDraft] = useState<BobinaLabelMeta>(emptyBobinaLabelMeta())
  const [labelEditorError, setLabelEditorError] = useState("")

  const closedTurnosLocal = useMemo(() => parseCorteTurnos(form[COR_TURNOS_KEY], form), [form])
  const closedTurnos = closedTurnosProp ?? closedTurnosLocal
  const activeTurno = useMemo(() => materializeOpenCorteTurnoActual(form), [form])
  const hasActiveTurno = hasActiveTurnoProp ?? activeTurno !== null

  useEffect(() => {
    if (!hasActiveTurno) {
      setDraftPeople([])
      setDraftStaging({ name: "", role: "operador" })
      setDraftPeopleQuery("")
      setDraftPeoplePage(1)
    }
  }, [hasActiveTurno])

  const turnoUi =
    coerceTurnoUi(activeTurno?.turno ?? "") ||
    coerceTurnoUi(readString(form.corTurno)) ||
    coerceTurnoUi(corTurnoProp)
  const grupoUi =
    coerceGrupoUi(activeTurno?.grupo ?? "") ||
    coerceGrupoUi(readString(form.corGrupo)) ||
    coerceGrupoUi(corGrupoProp)
  const showPersonalTurnoSetup = !hasActiveTurno && !areaFinalizada

  const draftPeopleFiltered = useMemo(() => {
    const q = draftPeopleQuery.trim().toLowerCase()
    if (!q) return draftPeople
    return draftPeople.filter((p) => {
      const turno = (p.turno ?? draftTurno).toLowerCase()
      const grupo = (p.grupo ?? draftGrupo).toLowerCase()
      const role = roleLabelEs(p.role).toLowerCase()
      const name = p.name.toLowerCase()
      return (
        name.includes(q) ||
        role.includes(q) ||
        turno.includes(q) ||
        grupo.includes(q) ||
        `grupo ${grupo}`.includes(q)
      )
    })
  }, [draftGrupo, draftPeople, draftPeopleQuery, draftTurno])
  const draftPeopleTotalPages = Math.max(1, Math.ceil(draftPeopleFiltered.length / DRAFT_PEOPLE_PAGE_SIZE))
  const draftPeopleSafePage = Math.min(draftPeoplePage, draftPeopleTotalPages)
  const draftPeopleStart = (draftPeopleSafePage - 1) * DRAFT_PEOPLE_PAGE_SIZE
  const draftPeopleVisible = draftPeopleFiltered.slice(
    draftPeopleStart,
    draftPeopleStart + DRAFT_PEOPLE_PAGE_SIZE,
  )

  const entradaBobinas = useMemo(() => getNumericSeries(form, "corEntradaBobinasKg", COR_ENTRADA_SLOTS), [form])
  const entradaBobinasMeta = useMemo(
    () => getMetaSeries(form, COR_ENTRADA_META_KEY, COR_ENTRADA_SLOTS),
    [form],
  )
  const doneEntradaImpresa =
    entradaBobinas.some((v) => parseBobinaKgSlotNumber(v) > 0) ||
    entradaBobinasMeta.some((m) => hasBobinaLabelMeta(m))
  const entradaBobinasCount = useMemo(
    () => entradaBobinas.filter((v) => parseBobinaKgSlotNumber(v) > 0).length,
    [entradaBobinas],
  )
  const entradaBobinasTotal = useMemo(
    () => entradaBobinas.reduce((acc, v) => acc + parseBobinaKgSlotNumber(v), 0),
    [entradaBobinas],
  )
  const corPaletas = useMemo(() => getCorPaletas(form), [form])
  const paletaPageSize = useCortePaletaPageSize()
  const [paletaPage, setPaletaPage] = useState(1)
  const paletaTotalPages = useMemo(
    () => cortePaletaTotalPages(corPaletas.length, paletaPageSize),
    [corPaletas.length, paletaPageSize],
  )
  const visiblePaletaIndices = useMemo(() => {
    const start = (paletaPage - 1) * paletaPageSize
    return Array.from({ length: Math.min(paletaPageSize, Math.max(0, corPaletas.length - start)) }, (_, i) => start + i)
  }, [corPaletas.length, paletaPage, paletaPageSize])
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
  const paletasResumenRollosTotal = useMemo(
    () => corPaletas.reduce((acc, p) => acc + countRollosWithKg(p), 0),
    [corPaletas],
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
  const doneResumenCorte =
    entradaBobinasCount > 0 ||
    bobinasSalidaCount > 0 ||
    salidaTotalKg > 0.01 ||
    kgMerma > 0.01 ||
    corPaletas.some((p) => isCorPaletaCerrada(p))
  const metraje = readNumber(form.metrajeCorte)
  const scrapRefile = readNumber(form.corScrapRefileKg)
  const scrapImpreso = readNumber(form.corScrapImpresoKg)
  const scrapMalCorte = readNumber(form.corScrapMalCorteKg)
  const scrapTotal = scrapRefile + scrapImpreso + scrapMalCorte
  const producidoAcumuladoKg = jsonAccum.producidoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = turnosRegistradosProp ?? jsonAccum.turnosRegistrados
  const ultimoTurnoLabel = ultimoTurnoLabelProp ?? (hasActiveTurno ? "Turno en curso" : jsonAccum.ultimoCierreLabel)
  const kgDespachoAcum = useMemo(() => sumSalidaKgFromClosedPaletas(corPaletas), [corPaletas])
  const kgProvisionalDespacho = useMemo(() => sumSalidaKgFromOpenPaletas(corPaletas), [corPaletas])
  const corteOp = useMemo(() => corteOperabilityFromForm(form), [form])
  const inputDisabled = opsReadOnly || !hasActiveTurno
  /** Ingreso de bobinas impresa: editable sin turno de planta (alimenta kg ingresados). */
  const entradaInputDisabled = opsReadOnly
  const paletaInputsDisabled = (p: CorPaleta) => inputDisabled || isCorPaletaCerrada(p)
  const canAddPaletaNow = corteOp.canAddPaleta && !opsReadOnly

  const draftOperadorName = draftPeople.find((p) => p.role === "operador")?.name.trim() ?? ""
  const draftOperadorMissing = draftPeople.every((p) => p.role !== "operador")

  useEffect(() => {
    setPaletaPage((p) => clampCortePaletaPage(p, corPaletas.length, paletaPageSize))
  }, [corPaletas.length, paletaPageSize])

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
  const timerState = (timerStateProp ?? activeTimer.state) || "pending"
  const timerRunning = timerRunningProp ?? timerState === "running"
  const timerPaused = timerPausedProp ?? timerState === "paused"
  const timerStopped = timerState === "stopped" || timerState === "completed"
  const effectiveAcc = activeTimer.effectiveAccSec
  const deadAcc = activeTimer.deadAccSec
  const lastResumeAt = activeTimer.lastResumeAtMs
  const pauseAt = activeTimer.pauseAtMs
  const localEffectiveSec =
    effectiveAcc + (timerRunning && lastResumeAt > 0 ? (nowMs - lastResumeAt) / 1000 : 0)
  const localDeadSec = deadAcc + (timerPaused && pauseAt > 0 ? (nowMs - pauseAt) / 1000 : 0)
  const localTotalSec = localEffectiveSec + deadAcc
  const effectiveSec = effectiveSecProp ?? localEffectiveSec
  const deadSec = deadSecProp ?? localDeadSec
  const totalSec = totalSecProp ?? localTotalSec
  const localDemountSec = useMemo(
    () => cumulativeDemountSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, nowMs],
  )
  const localArranqueSec = useMemo(
    () => cumulativeArranqueSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, nowMs],
  )
  const demountSec = demountSecProp ?? localDemountSec
  const arranqueSec = arranqueSecProp ?? localArranqueSec
  const formatTimerHmsFn = formatTimerHmsProp ?? formatTimerHms
  const doneTemporizador =
    areaFinalizada || timerState === "completed" || timerState === "stopped"
  const kgHora = kgHoraProp ?? (effectiveSec > 0 ? (kgSalida / (effectiveSec / 3600)).toFixed(2) : "0.00")
  const displayHoraArranque =
    horaArranqueProp ?? formatHoraArranqueFromMs(horaArranqueMsFromTimer(activeTimer))
  const mermaPct = kgIngresados > 0 ? ((kgMerma / kgIngresados) * 100).toFixed(2) : "0.00"
  const refilPct = kgIngresados > 0 ? ((scrapTotal / kgIngresados) * 100).toFixed(2) : "0.00"

  const pauseEntries = useMemo<CortePauseEntry[]>(() => {
    if (pauseEntriesProp) return pauseEntriesProp
    const raw = activeTimer.pauses.length > 0 ? activeTimer.pauses : form.corTimerPauses
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
  }, [pauseEntriesProp, activeTimer.pauses, form.corTimerPauses])

  useEffect(() => {
    if (multiPhaseTimer) return
    if (!timerRunning && !timerPaused) return
    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [multiPhaseTimer, timerPaused, timerRunning])

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

  function openEntradaLabelEditor(idx: number) {
    setLabelEditorIndex(idx)
    setLabelEditorDraft(bobinaLabelDraftFromMeta(entradaBobinasMeta[idx]))
    setLabelEditorError("")
    setLabelEditorOpen(true)
  }

  function clearLabelEditor() {
    setLabelEditorDraft({ ...emptyBobinaLabelMeta(), fecha: bobinaLabelDraftFromMeta(undefined).fecha })
    setLabelEditorError("")
  }

  function saveEntradaLabelEditor() {
    const normalized = normalizeEntradaLabelForSave(labelEditorDraft)
    const err = validateBobinaLabelSave(normalized)
    if (err) {
      setLabelEditorError(err)
      return
    }
    if (opsReadOnly) return
    const nextMeta = [...entradaBobinasMeta]
    nextMeta[labelEditorIndex] = normalized
    const nextKg = [...entradaBobinas]
    const pesoLabel = readNumber(normalized.peso)
    if (pesoLabel > 0.005 && readNumber(nextKg[labelEditorIndex]) < 0.005) {
      nextKg[labelEditorIndex] = normalizeNumericString(pesoLabel)
    }
    setForm((prev) => {
      const base = { ...prev, [COR_ENTRADA_META_KEY]: nextMeta, corEntradaBobinasKg: nextKg }
      const synced = syncCorteFormMetrics(base)
      const entradaKg = sumEntradaKgFromForm(synced).toFixed(2)
      if (hasActiveTurno) {
        const cur = parseCorteTurnoActual(synced[COR_ACTUAL_KEY], synced)
        if (cur) {
          const nextTurn: CorteTurnoEntry = {
            ...cur,
            entradaBobinasKg: nextKg,
            entradaBobinasMeta: nextMeta,
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
    setLabelEditorOpen(false)
    setLabelEditorError("")
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
    const nextPaletas = [
      ...corPaletas,
      {
        id: `p-${String(nextIndex).padStart(2, "0")}`,
        label: `Paleta #${String(nextIndex).padStart(2, "0")}`,
        rollosKg: emptyPaletaRollos(),
        status: "en_progreso" as const,
      },
    ]
    writePaletas(nextPaletas)
    setPaletaPage(cortePaletaTotalPages(nextPaletas.length, paletaPageSize))
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
    writePaletas(next)
    toast.success(
      `${target.label} cerrada en pantalla (${kg.toFixed(2)} kg). Pulse Guardar → Guardar para enviar a Despacho.`,
    )
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
    setDraftPeople((prev) => [
      ...prev,
      { id: `draft-${Date.now()}`, role, name: trimmed, grupo: draftGrupo, turno: draftTurno },
    ])
    setDraftStaging({ name: "", role: "operador" })
  }

  function onDraftPersonRemove(id: string) {
    setDraftPeople((prev) => prev.filter((p) => p.id !== id))
  }

  function requestIniciarTurno() {
    if (opsReadOnly) return
    if (hasActiveTurno) return
    if (draftOperadorMissing) {
      toast.error(
        draftPeople.length > 0
          ? "Falta un Operador en la cuadrilla. Guarde al menos una persona con rol Operador (Ayudante no basta)."
          : "Guarde al menos un operador en la cuadrilla antes de iniciar el turno.",
      )
      return
    }
    setStartTurnConfirmOpen(true)
  }

  function confirmIniciarTurno() {
    if (opsReadOnly) return
    if (hasActiveTurno) return
    if (draftOperadorMissing) {
      setStartTurnConfirmOpen(false)
      toast.error(
        draftPeople.length > 0
          ? "Falta un Operador en la cuadrilla. Guarde al menos una persona con rol Operador (Ayudante no basta)."
          : "Guarde al menos un operador en la cuadrilla antes de iniciar el turno.",
      )
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
    const entradaKgArr = [...entradaBobinas]
    const entradaMetaArr = [...entradaBobinasMeta]
    const turnoWithEntrada: CorteTurnoEntry = {
      ...t,
      entradaBobinasKg: entradaKgArr,
      entradaBobinasMeta: entradaMetaArr,
      kgIngresados: sumEntradaKgFromForm({
        corEntradaBobinasKg: entradaKgArr,
      }).toFixed(2),
    }
    const nextForm: Record<string, unknown> = {
      ...form,
      [COR_ACTUAL_KEY]: turnoWithEntrada,
      ...corteTurnoToMirror(turnoWithEntrada),
      [COR_TURNOS_KEY]: parseCorteTurnos(form[COR_TURNOS_KEY], form),
    }
    setForm(nextForm)
    setDraftPeople([])
    setDraftStaging({ name: "", role: "operador" })
    setStartTurnConfirmOpen(false)
    void (async () => {
      if (onRequestSave) {
        const ok = await onRequestSave(nextForm, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          suppressSuccessToast: true,
        })
        if (!ok) {
          toast.error("No se pudo guardar el turno en el servidor. Revise su conexión e intente Guardar.")
          return
        }
      }
      await showAxonesSuccessSwal(
        "Turno de planta abierto",
        "Cuadrilla guardada. Use el cronómetro (play) y, al terminar otro turno, pulse Guardar → Finalizar turno o Cerrar turno en el cronómetro.",
      )
    })()
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
      entradaBobinasMeta: cur.entradaBobinasMeta,
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
      return next
    })
    toast.success(
      "Turno cerrado en pantalla. Pulse Guardar → Finalizar turno para enviar al servidor y limpiar el formulario.",
    )
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
      return nextForm
    })
    setPauseReason("")
    setPauseObs("")
    setPauseMotivoDialogOpen(false)
    toast.message(
      "Parada registrada. Use play para reanudar. Pulse Guardar → Finalizar turno al cerrar la sesión.",
    )
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
        <div
          className={cn(
            "mes-stat-grid mes-stat-grid--4",
            showPersonalTurnoSetup && "is-compact-tiles",
          )}
        >
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

  const savedPeopleSection = (
    <MesSectionShell
      title={mesSectionTitle(Users, `Personal guardado (${draftPeople.length})`)}
      subtle
      className="montaje-personal-turno-section montaje-personal-turno-section--accessible"
    >
      <Collapsible defaultOpen className="montaje-saved-list rounded-md border border-dashed bg-muted/20">
        <CollapsibleTrigger className="montaje-saved-list-trigger flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold hover:bg-muted/40">
          <span className="inline-flex items-center gap-2">
            <Users className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
            Lista de cuadrilla
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 opacity-70" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {draftPeople.length === 0 ? (
            <div className="montaje-saved-list-empty border-t px-4 py-3 text-muted-foreground">
              Aún no hay personas en la lista. Guarde al menos un <strong>operador</strong> antes de pulsar{" "}
              <strong>Iniciar turno</strong>.
            </div>
          ) : (
            <>
              <div className="border-t px-4 py-3">
                <Input
                  value={draftPeopleQuery}
                  onChange={(e) => {
                    setDraftPeoplePage(1)
                    setDraftPeopleQuery(e.target.value)
                  }}
                  placeholder="Buscar por nombre, rol, turno o grupo"
                  className="h-10 text-sm"
                />
              </div>
              {draftPeopleFiltered.length === 0 ? (
                <div className="montaje-saved-list-empty border-t px-4 py-3 text-muted-foreground">
                  No hay coincidencias para <strong>{draftPeopleQuery.trim()}</strong>.
                </div>
              ) : null}
              <ul className="montaje-saved-list-items space-y-2 border-t px-4 py-3">
                {draftPeopleVisible.map((p) => (
                  <li
                    key={p.id}
                    className="montaje-saved-person-row flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Badge
                        className={cn(
                          "min-w-[4.25rem] justify-center border px-2 py-0.5 text-xs uppercase tracking-wide",
                          (p.turno ?? draftTurno) === "diurno" &&
                            "border-slate-800/70 bg-slate-700 text-white dark:border-slate-600 dark:bg-slate-600",
                          (p.turno ?? draftTurno) === "nocturno" &&
                            "border-indigo-800/70 bg-indigo-700 text-white dark:border-indigo-600 dark:bg-indigo-600",
                        )}
                      >
                        {(p.turno ?? draftTurno) === "diurno" ? "Diurno" : "Nocturno"}
                      </Badge>
                      <Badge
                        className={cn(
                          "montaje-grupo-badge min-w-[4.5rem] justify-center border px-2 py-0.5 text-xs uppercase tracking-wide",
                          (p.grupo ?? draftGrupo) === "A" &&
                            "border-blue-800/70 bg-blue-700 text-white dark:border-blue-600 dark:bg-blue-600",
                          (p.grupo ?? draftGrupo) === "B" &&
                            "border-orange-800/70 bg-orange-700 text-white dark:border-orange-600 dark:bg-orange-600",
                          (p.grupo ?? draftGrupo) === "C" &&
                            "border-teal-800/70 bg-teal-700 text-white dark:border-teal-600 dark:bg-teal-600",
                        )}
                      >
                        Grupo {p.grupo ?? draftGrupo}
                      </Badge>
                      <Badge
                        className={cn(
                          "min-w-[5rem] justify-center border px-2 py-0.5 text-xs uppercase tracking-wide",
                          p.role === "operador" &&
                            "border-emerald-800/70 bg-emerald-700 text-white dark:border-emerald-600 dark:bg-emerald-600",
                          p.role === "ayudante" &&
                            "border-amber-800/70 bg-amber-700 text-white dark:border-amber-600 dark:bg-amber-600",
                          p.role === "supervisor" &&
                            "border-violet-800/70 bg-violet-700 text-white dark:border-violet-600 dark:bg-violet-600",
                        )}
                      >
                        {roleLabelEs(p.role)}
                      </Badge>
                      <span className="montaje-saved-person-label truncate">
                        <span className="font-semibold text-foreground">{p.name}</span>
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="montaje-remove-person-btn h-10 w-10 shrink-0"
                      onClick={() => onDraftPersonRemove(p.id)}
                      disabled={opsReadOnly}
                      title="Quitar de la lista"
                      aria-label={`Quitar a ${p.name} de la lista`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </li>
                ))}
              </ul>
              {draftPeopleTotalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
                  <span className="text-muted-foreground">
                    Mostrando {draftPeopleStart + 1}-
                    {Math.min(draftPeopleStart + DRAFT_PEOPLE_PAGE_SIZE, draftPeopleFiltered.length)} de{" "}
                    {draftPeopleFiltered.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDraftPeoplePage((p) => Math.max(1, p - 1))}
                      disabled={draftPeopleSafePage <= 1}
                    >
                      Anterior
                    </Button>
                    <span className="text-muted-foreground text-xs">
                      Página {draftPeopleSafePage} / {draftPeopleTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDraftPeoplePage((p) => Math.min(draftPeopleTotalPages, p + 1))}
                      disabled={draftPeopleSafePage >= draftPeopleTotalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </MesSectionShell>
  )

  return (
    <>
      {showPersonalTurnoSetup ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start xl:gap-5">
          <div className="min-w-0 space-y-4">
            {acumuladoOrdenSection}
            {savedPeopleSection}
          </div>
          <div className="min-w-0">
            <MesSectionShell
              title={mesSectionTitle(Users, "Personal y turno de planta")}
              subtle
              className="montaje-personal-turno-section montaje-personal-turno-section--accessible"
              bodyClassName="mes-section__body--flush"
            >
              <div className="mes-setup-steps mb-4 rounded-md border border-border/70 bg-background p-4">
                <div className="text-foreground text-base font-semibold leading-snug">
                  Siga estos pasos para iniciar el turno:
                </div>
                <ol className="montaje-setup-steps-list mt-2 space-y-2 pl-5 leading-relaxed text-muted-foreground">
                  <li>
                    <span className="font-semibold text-foreground">1)</span> Elija{" "}
                    <span className="font-semibold text-foreground">Turno</span> y{" "}
                    <span className="font-semibold text-foreground">Grupo</span>.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">2)</span> Escriba nombre, seleccione rol y pulse{" "}
                    <span className="font-semibold text-foreground">Guardar persona</span>.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">3)</span> Cuando haya al menos un{" "}
                    <span className="font-semibold text-foreground">Operador</span>, pulse{" "}
                    <span className="font-semibold text-foreground">Iniciar turno</span>.
                  </li>
                </ol>
                <p className="montaje-setup-note mt-3 leading-relaxed text-muted-foreground">
                  Nota: <span className="font-semibold text-foreground">Iniciar turno</span> no arranca el cronómetro
                  de máquina. El tiempo se inicia después en{" "}
                  <span className="font-semibold text-foreground">Cronómetro de producción</span> (botón play).
                </p>
              </div>

              <div className="montaje-personal-panel rounded-lg border bg-background/60 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    {fieldLegend(Clock, "Turno")}
                    <div className="mes-toggle-row mes-toggle-turno">
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        className="w-full"
                        value={draftTurno}
                        onValueChange={(v) => {
                          if (!v) return
                          setDraftTurno(v as "diurno" | "nocturno")
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
                  <div className="space-y-2">
                    {fieldLegend(Users, "Grupo")}
                    <div className="mes-toggle-row mes-toggle-grupo">
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        className="w-full"
                        value={draftGrupo}
                        onValueChange={(v) => {
                          if (!v) return
                          setDraftGrupo(v as "A" | "B" | "C")
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
                    <p className="mes-field-hint">
                      Cuadrilla o equipo asignado a la máquina (rotación interna A / B / C).
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-border/60 pt-5">
                  <div className="montaje-cuadrilla-heading mb-3 font-semibold uppercase tracking-wide text-muted-foreground">
                    Cuadrilla (antes de iniciar)
                  </div>
                  <div className="montaje-cuadrilla-form space-y-4 rounded-md border bg-background p-3 sm:p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="min-w-0 space-y-2">
                        {fieldLabel(
                          mk("draft-person-name"),
                          UserRound,
                          <>
                            Nombre
                            <span className="text-muted-foreground">
                              {draftStaging.role === "operador" ? " (operador)" : " (personal)"}
                            </span>
                          </>,
                        )}
                        <Input
                          id={mk("draft-person-name")}
                          name="corDraftPersonName"
                          className="montaje-person-input ot-input-unified h-11 w-full min-w-0 text-base md:text-base"
                          value={draftStaging.name}
                          onChange={(e) => setDraftStaging((s) => ({ ...s, name: e.target.value }))}
                          placeholder="Nombre"
                          disabled={opsReadOnly}
                        />
                      </div>

                      <div className="min-w-0 space-y-2">
                        {fieldLabel(mk("draft-person-role"), IdCard, "Rol")}
                        <Select
                          value={draftStaging.role}
                          onValueChange={(v) => setDraftStaging((s) => ({ ...s, role: v as DraftPersonRole }))}
                          disabled={opsReadOnly}
                        >
                          <SelectTrigger
                            id={mk("draft-person-role")}
                            className="montaje-person-role-trigger h-11 w-full min-w-0 text-base"
                          >
                            <SelectValue placeholder="Seleccione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operador">Operador</SelectItem>
                            <SelectItem value="ayudante">Ayudante</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="montaje-role-hint text-muted-foreground">
                          {draftStaging.role === "operador"
                            ? "Rol principal requerido para poder iniciar el turno"
                            : draftStaging.role === "supervisor"
                              ? "Control y seguimiento del turno"
                              : "Apoyo operativo de la cuadrilla"}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        className="montaje-save-person-btn h-12 w-full max-w-xs gap-2 text-base font-semibold sm:w-auto sm:min-w-[12rem] sm:shrink-0"
                        onClick={() => onDraftPersonGuardar(draftStaging.name, draftStaging.role)}
                        disabled={opsReadOnly}
                      >
                        <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
                        Guardar persona
                      </Button>
                    </div>
                  </div>

                  {draftOperadorMissing ? (
                    <div className="montaje-operador-warning mt-3 rounded-md border px-3 py-2.5">
                      {draftPeople.length > 0 ? (
                        <>
                          Hay personal en la lista, pero falta un{" "}
                          <span className="font-semibold">Operador</span> (responsable del turno). En{" "}
                          <span className="font-semibold">Rol</span> elija <span className="font-semibold">Operador</span>,
                          escriba el nombre y pulse <span className="font-semibold">Guardar persona</span>.
                        </>
                      ) : (
                        <>
                          Debe guardar al menos un <span className="font-semibold">operador</span> antes de pulsar{" "}
                          <span className="font-semibold">Iniciar turno</span> en esta misma sección.
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </MesSectionShell>
          </div>

          <div className="col-span-1 flex justify-center border-t border-border/60 pt-5 xl:col-span-2">
            <Button
              type="button"
              className="montaje-iniciar-turno-btn h-12 min-w-[14rem] gap-2 px-6 text-base font-semibold"
              onClick={requestIniciarTurno}
              disabled={opsReadOnly || draftOperadorMissing}
              title={
                draftOperadorMissing
                  ? "Guarde al menos una persona con rol Operador en la cuadrilla"
                  : "Abre el registro de turno de planta (no inicia el cronómetro de máquina)"
              }
            >
              <CirclePlay className="h-5 w-5 shrink-0" aria-hidden />
              Iniciar turno
            </Button>
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
          <div
            className="mb-3 rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2.5 text-xs leading-relaxed text-sky-950 dark:text-sky-100"
            role="status"
          >
            <p>
              <span className="font-semibold">Completo</span> solo indica que este turno ya tiene operador registrado;{" "}
              <span className="font-semibold">no</span> significa que el turno terminó.
            </p>
            <p className="mt-1.5">
              Para <span className="font-semibold">otro turno con otra persona</span> (como en Montaje e Impresión): cierre
              este turno y verá la pantalla <span className="font-semibold">Personal y turno de planta</span> con el botón{" "}
              <span className="font-semibold">Iniciar turno</span>.
            </p>
            {onRequestCerrarTurno && !opsReadOnly ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-8 border-sky-600/40 bg-background text-xs font-semibold"
                onClick={onRequestCerrarTurno}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Cerrar turno e iniciar otro
              </Button>
            ) : null}
          </div>
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
            {multiPhaseTimer ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 shrink-0 gap-1.5 border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                      aria-label="Ver turnos acumulativos y personal"
                      onClick={() => setCumulativeTurnosDialogOpen(true)}
                    >
                      <AlarmClock className="h-4 w-4 shrink-0 text-current" aria-hidden />
                      <span className="leading-none">Turnos</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Turnos acumulativos y personal</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <MesSectionHeaderExtras isDone={doneTemporizador} />
            )}
            {multiPhaseTimer && doneTemporizador ? (
              <div className="mes-badge-done">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Completo
              </div>
            ) : null}
            <Badge variant="secondary" className="max-w-[14rem] text-xs leading-snug">
              {areaFinalizada
                ? "Área finalizada"
                : !hasActiveTurno
                  ? timerShowsOtAccumulated
                    ? "Entre turnos · tiempo acumulado"
                    : "Sin turno de planta abierto"
                  : demountRunning
                    ? "Desmontaje en marcha"
                    : arranqueRunning
                      ? "Arranque en marcha"
                      : timerState === "running"
                        ? multiPhaseTimer
                          ? "Producción en marcha"
                          : "Cronómetro en marcha"
                        : timerState === "paused"
                          ? multiPhaseTimer
                            ? "Producción en pausa"
                            : "Cronómetro en pausa"
                          : timerState === "completed"
                            ? "Orden finalizada"
                            : timerState === "stopped"
                              ? "Registro de turno cerrado"
                              : "Cronómetro listo (sin iniciar)"}
            </Badge>
          </div>
        }
      >
        {hasActiveTurno ? (
          <div className="mb-3 rounded-md border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs leading-snug text-foreground">
            {multiPhaseTimer ? (
              MES_TIMER_HELP_TEXT
            ) : (
              <>
                <span className="font-semibold">Cronómetro (máquina):</span> cuenta tiempo efectivo y paradas.{" "}
                <span className="font-semibold">Parada</span> detiene el efectivo y pide motivo (tiempo muerto);{" "}
                <span className="font-semibold">no</span> cierra el turno de planta. Para cerrar la sesión use{" "}
                <span className="font-semibold">Cerrar turno</span>.
              </>
            )}
          </div>
        ) : (
          <div className="mb-3 rounded-md border border-dashed border-slate-400 bg-white px-3 py-2 text-xs text-slate-600">
            Primero abra un <span className="font-semibold text-foreground">turno de planta</span> con{" "}
            <span className="font-semibold text-foreground">Iniciar turno</span> en la sección superior. Después podrá
            usar el <span className="font-semibold text-foreground">cronómetro</span> (play en esta sección) para
            registrar tiempos y paradas con motivo.
          </div>
        )}
        {multiPhaseTimer && onRequestTimerConfirm && onPreviewTimerReport ? (
          <MesProductionTimerOpsBlock
            formatTimerHms={formatTimerHmsFn}
            effectiveSec={effectiveSec}
            deadSec={deadSec}
            demountSec={demountSec}
            arranqueSec={arranqueSec}
            totalSec={totalSec}
            kgHora={kgHora}
            horaArranque={displayHoraArranque}
            timerShowsOtAccumulated={timerShowsOtAccumulated}
            timerRunning={timerRunning}
            arranqueRunning={arranqueRunning}
            demountRunning={demountRunning}
            timerActionFlags={timerActionFlags!}
            onRequestTimerConfirm={onRequestTimerConfirm}
            onPreviewTimerReport={onPreviewTimerReport}
            canFinalizeOrder={canFinalizeOrder}
            areaFinalizada={areaFinalizada}
            areaLabel="corte"
            showTimerActions={hasActiveTurno}
          />
        ) : hasActiveTurno ? (
          <p className="text-muted-foreground text-xs">
            Cronómetro multi-fase disponible en la vista de producción del área de corte.
          </p>
        ) : null}
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
                <span className="text-muted-foreground"> · {formatTimerHmsFn(entry.duration_sec)}</span>
                {entry.obs ? <span className="text-muted-foreground"> · {entry.obs}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Package, "Ingreso de bobinas impresa — Kg")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneEntradaImpresa} />}
        bodyClassName="mes-section__body--flush"
      >
        <p className="text-muted-foreground mb-2 px-3 pt-3 text-xs leading-snug">
          Registre hasta {COR_ENTRADA_SLOTS} bobinas de material impreso que entran al corte. El total alimenta automáticamente{" "}
          <span className="font-medium text-foreground">Kg ingresados</span> en proceso de corte. La salida por paleta ({COR_ROLLOS_PER_PALETA}{" "}
          rollos/paleta) es independiente.
        </p>
        <div className="grid grid-cols-2 gap-2 px-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {entradaBobinas.map((val, idx) => {
            const filled = isBobinaKgSlotFilled(val) || hasBobinaLabelMeta(entradaBobinasMeta[idx])
            return (
              <MesBobinaKgSlotCell
                key={`ent-cor-${idx}`}
                id={mk(`entrada-bobina-${idx}`)}
                name={`corEntradaBobinaKg_${idx + 1}`}
                slotNum={idx + 1}
                value={val}
                filled={filled}
                inputDisabled={entradaInputDisabled}
                onChange={(v) => {
                  const next = [...entradaBobinas]
                  next[idx] = v
                  writeEntradaBobinasKg(next)
                }}
                labelButton={
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant={hasBobinaLabelMeta(entradaBobinasMeta[idx]) ? "default" : "outline"}
                          className="h-5 w-5"
                          onClick={() => openEntradaLabelEditor(idx)}
                          disabled={entradaInputDisabled}
                          title={`Etiqueta bobina impresa #${idx + 1}`}
                        >
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {bobinaLabelTooltipText(entradaBobinasMeta[idx])}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                }
              />
            )
          })}
        </div>
        <div className="mt-2 px-3 pb-3 mes-stat-grid sm:grid-cols-3">
          <MesStatTile label="N° bobinas" value={entradaBobinasCount} />
          <MesStatTile
            label="Total"
            value={`${entradaBobinasTotal.toFixed(2)} Kg`}
            icon={<Weight className="h-3.5 w-3.5" />}
          />
          <div className="mes-stat-tile">
            <span className="mes-stat-tile__label">Paletas (300 Kg)</span>
            <div className="mes-stat-tile__value">{paletasEquivalentesEntrada.toFixed(2)}</div>
            <p className="text-muted-foreground mt-1 text-xs">Completas: {paletasCompletasEntrada}</p>
          </div>
        </div>
      </MesSectionShell>

      {!hasActiveTurno ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Inicie un <span className="font-semibold text-foreground">turno de planta</span> para registrar paletas de salida, desperdicio y resúmenes del turno.
        </div>
      ) : null}

      {hasActiveTurno ? (
      <>
      <MesSectionShell
        title={mesSectionTitle(Scissors, "Bobinas de salida por paleta — Peso neto (Kg)")}
        subtle
        bodyClassName="mes-section__body--flush"
      >
        <p className="text-muted-foreground mb-2 px-3 pt-2 text-xs leading-snug">
          Registre peso en al menos un rollo de la paleta (con todo en 0 no hay saldo en Despacho). Cierre cada paleta al
          terminar el lote: los kg pasan a Despacho · producto terminado sin finalizar el área. Requiere turno abierto y
          cronómetro iniciado (play).
        </p>
        {entradaBobinasTotal > 0 && salidaTotalKg <= 0 ? (
          <div
            className="mx-3 mb-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-950 dark:text-amber-100"
            role="status"
          >
            <span className="font-semibold">Ingreso registrado ({entradaBobinasTotal.toFixed(2)} Kg)</span> no genera
            saldo en Despacho. Escriba kg en los rollos de esta sección, pulse{" "}
            <span className="font-semibold">Guardar</span> y, para la nota de entrega,{" "}
            <span className="font-semibold">Cerrar paleta</span>.
          </div>
        ) : null}

        <CortePaletasSectionToolbar
          totalPaletas={corPaletas.length}
          onAddPaleta={addPaleta}
          canAddPaleta={canAddPaletaNow}
        />

        <div className={cn("px-3 py-3", CORTE_PALETAS_CONTAINER_GRID)}>
          {visiblePaletaIndices.map((paletaIdx) => {
            const paleta = salidaPaletas[paletaIdx]
            if (!paleta) return null
            const meta = corPaletas[paletaIdx]
            const theme = getCortePaletaTheme(paletaIdx)
            const cerrada = Boolean(meta && isCorPaletaCerrada(meta))
            return (
            <div
              key={`paleta-${paletaIdx}`}
              className={cortePaletaCardClass(paletaIdx, cerrada)}
            >
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 shadow-sm",
                  theme.header,
                )}
              >
                <strong className={cn("text-sm", theme.title)}>
                  {corPaletas[paletaIdx]?.label ?? `Paleta #${String(paletaIdx + 1).padStart(2, "0")}`}
                </strong>
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

              <div className="space-y-3 p-3">
                <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                  <div>
                    <Label htmlFor={mk(`paleta-${paletaIdx}-rollos-count`)} className="ot-label">
                      Rollos
                    </Label>
                    <Input
                      id={mk(`paleta-${paletaIdx}-rollos-count`)}
                      name={`corPaleta${paletaIdx + 1}RollosCount`}
                      className={cn("ot-input-unified h-9", theme.summaryInput)}
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
                      className={cn("ot-input-unified h-9 font-semibold", theme.summaryInput)}
                      value={(salidaPaletasTotales[paletaIdx] ?? 0).toFixed(2)}
                      readOnly
                    />
                  </div>
                </div>

                <CortePaletaRollosPaginatedGrid
                  paletaIdx={paletaIdx}
                  rollosKg={paleta}
                  theme={theme}
                  inputsDisabled={meta ? paletaInputsDisabled(meta) : inputDisabled}
                  idFor={mk}
                  onRolloChange={(rolloIdx, value) => {
                    const next = corPaletas.map((p) => ({ ...p, rollosKg: [...p.rollosKg] }))
                    if (!next[paletaIdx]) return
                    next[paletaIdx].rollosKg[rolloIdx] = value
                    writePaletas(next)
                  }}
                />
              </div>
            </div>
            )
          })}
        </div>

        <CortePaletasSectionFooter
          totalPaletas={corPaletas.length}
          page={paletaPage}
          totalPages={paletaTotalPages}
          pageSize={paletaPageSize}
          onPageChange={setPaletaPage}
          onAddPaleta={addPaleta}
          canAddPaleta={canAddPaletaNow}
        />
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PackageSearch, "Proceso de corte")}
        subtle
        bodyClassName="mes-section__body--flush"
        headerRight={
          <MesSectionHeaderExtras
            isDone={
              entradaBobinasTotal > 0.01 ||
              salidaTotalKg > 0.01 ||
              kgMerma > 0.01 ||
              metraje > 0.01
            }
          />
        }
      >
        <div className="space-y-4 px-3 py-3">
          <p className="text-muted-foreground text-xs leading-snug">
            <span className="font-medium text-foreground">Kg salida (plantas)</span> suma paletas abiertas y cerradas.
            Solo las paletas <span className="font-medium text-foreground">cerradas</span> (botón{" "}
            <span className="font-medium text-foreground">Cerrar paleta</span>) pasan a Despacho · producto terminado.
          </p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Flujo de material (Kg)
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
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Captura manual del turno
            </p>
            <div className="mes-stat-grid sm:grid-cols-2">
              <div className="mes-stat-tile">
                <Label htmlFor={mk("kg-merma-corte")} className="mes-stat-tile__label">
                  Kg merma
                </Label>
                <Input
                  id={mk("kg-merma-corte")}
                  name="kgMermaCorte"
                  className="ot-input-unified mt-1 h-9 bg-white dark:bg-white dark:text-slate-900"
                  inputMode="decimal"
                  value={readString(form.kgMermaCorte)}
                  onChange={(e) => setKey("kgMermaCorte", e.target.value)}
                  placeholder="0"
                  disabled={inputDisabled}
                />
              </div>
              <div className="mes-stat-tile">
                <Label htmlFor={mk("metraje-corte")} className="mes-stat-tile__label">
                  Metraje (turno)
                </Label>
                <Input
                  id={mk("metraje-corte")}
                  name="metrajeCorte"
                  className="ot-input-unified mt-1 h-9 bg-white dark:bg-white dark:text-slate-900"
                  inputMode="decimal"
                  value={readString(form.metrajeCorte)}
                  onChange={(e) => setKey("metrajeCorte", e.target.value)}
                  placeholder="0"
                  disabled={inputDisabled}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Indicadores
            </p>
            <div className="mes-stat-grid sm:grid-cols-3">
              <MesStatTile label="Merma %" value={`${mermaPct}%`} icon={<Percent className="h-3.5 w-3.5" />} />
              <MesStatTile
                label="Rendimiento"
                value={`${kgHora} Kg/h`}
                icon={<TrendingDown className="h-3.5 w-3.5" />}
              />
              <MesStatTile
                label="Metraje total"
                value={`${metraje.toFixed(2)} m`}
                icon={<Ruler className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unidades</p>
            <div className="mes-stat-grid sm:grid-cols-2">
              <MesStatTile label="Paletas de salida" value={corPaletas.length} icon={<Package className="h-3.5 w-3.5" />} />
              <MesStatTile
                label="Bobinas de salida"
                value={bobinasSalidaCount}
                icon={<Scissors className="h-3.5 w-3.5" />}
              />
            </div>
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Recycle, "Desperdicio / refil")}
        subtle
        className="mes-section--scrap-premium"
        bodyClassName="mes-section__body--flush"
        headerRight={
          <MesSectionHeaderExtras
            isDone={
              scrapTotal > 0.01 ||
              readString(form.corScrapRefileKg).trim() !== "" ||
              readString(form.corScrapImpresoKg).trim() !== "" ||
              readString(form.corScrapMalCorteKg).trim() !== ""
            }
          />
        }
      >
        <div className="space-y-4 px-3 py-3">
          <p className="text-muted-foreground text-xs leading-snug">
            Clasifique el desperdicio para el reporte de inventario. El destino{" "}
            <span className="font-medium text-foreground">BOPP / Polietileno</span> aplica a refile e impreso de corte.{" "}
            <span className="font-medium text-foreground">Transparente</span> cuando el film es CPP / transparente.
          </p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Clasificación para reporte
            </p>
            <div className="mes-scrap-destino space-y-2">
              <Label id={mk("cor-desperdicio-sustrato-label")} className="mes-scrap-destino__label text-muted-foreground">
                Sustrato del desperdicio (global)
              </Label>
              <p className="text-muted-foreground text-[10px] leading-snug">
                Afecta mal corte y los destinos en «Auto». «Auto» usa la estructura del producto.
              </p>
              <CorteDesperdicioSustratoToggle
                idPrefix={mk("cor-desperdicio-sustrato")}
                value={readString(form.corDesperdicioSustrato)}
                onChange={(v) => setKey("corDesperdicioSustrato", v)}
                disabled={inputDisabled}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Destino por tipo de material
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CorteDesperdicioDestinoToggle
                idPrefix={mk("cor-desperdicio-refile-destino")}
                label="Refile (BOPP / PE)"
                hint="«Auto» hereda el sustrato global o la estructura."
                value={readString(form.corScrapRefileDestino)}
                onChange={(v) => setKey("corScrapRefileDestino", v)}
                disabled={inputDisabled}
              />
              <CorteDesperdicioDestinoToggle
                idPrefix={mk("cor-desperdicio-impreso-destino")}
                label="Impreso corte (BOPP / PE)"
                hint="«Auto» hereda el sustrato global o la estructura."
                value={readString(form.corScrapImpresoDestino)}
                onChange={(v) => setKey("corScrapImpresoDestino", v)}
                disabled={inputDisabled}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kilos registrados
            </p>
            <div className="mes-scrap-grid mes-scrap-grid--corte">
              <div className="mes-scrap-field">
                {fieldLabel(mk("cor-desperdicio-refile-kg"), Recycle, "Refile (Kg)")}
                <Input
                  id={mk("cor-desperdicio-refile-kg")}
                  name="corScrapRefileKg"
                  className="ot-input-unified mes-scrap-input h-9"
                  inputMode="decimal"
                  value={readString(form.corScrapRefileKg)}
                  onChange={(e) => setKey("corScrapRefileKg", e.target.value)}
                  placeholder="0"
                  disabled={inputDisabled}
                />
              </div>
              <div className="mes-scrap-field">
                {fieldLabel(mk("cor-desperdicio-impreso-kg"), Printer, "Impreso (Kg)")}
                <Input
                  id={mk("cor-desperdicio-impreso-kg")}
                  name="corScrapImpresoKg"
                  className="ot-input-unified mes-scrap-input h-9"
                  inputMode="decimal"
                  value={readString(form.corScrapImpresoKg)}
                  onChange={(e) => setKey("corScrapImpresoKg", e.target.value)}
                  placeholder="0"
                  disabled={inputDisabled}
                />
              </div>
              <div className="mes-scrap-field">
                {fieldLabel(mk("cor-desperdicio-mal-corte-kg"), Scissors, "Mal corte (Kg)")}
                <Input
                  id={mk("cor-desperdicio-mal-corte-kg")}
                  name="corScrapMalCorteKg"
                  className="ot-input-unified mes-scrap-input h-9"
                  inputMode="decimal"
                  value={readString(form.corScrapMalCorteKg)}
                  onChange={(e) => setKey("corScrapMalCorteKg", e.target.value)}
                  placeholder="0"
                  disabled={inputDisabled}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen</p>
            <div className="mes-stat-grid sm:grid-cols-3">
              <MesStatTile
                label="Total desperdicio"
                value={`${scrapTotal.toFixed(2)} Kg`}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              />
              <MesStatTile
                label="% desperdicio / ingreso"
                value={`${refilPct}%`}
                icon={<PieChart className="h-3.5 w-3.5" />}
              />
              <MesStatTile
                label="Estado"
                value={kgIngresados > 0 ? "Calculado" : "Sin datos"}
                icon={<BarChart3 className="h-3.5 w-3.5" />}
              />
            </div>
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PieChart, "Resumen de producción del turno")}
        subtle
        className="mes-section--resumen-premium"
        bodyClassName="mes-section__body--flush"
        headerRight={<MesSectionHeaderExtras isDone={doneResumenCorte} />}
      >
        <div className="space-y-4 px-3 py-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Volúmenes del turno
            </p>
            <div className="mes-stat-grid mes-stat-grid--4">
              <MesStatTile
                label="Bobinas usadas (entrada)"
                value={entradaBobinasCount}
                icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
              />
              <MesStatTile
                label="Rollos de salida"
                value={bobinasSalidaCount}
                icon={<Scissors className="h-3.5 w-3.5" />}
              />
              <MesStatTile
                label="Peso total salida"
                value={`${salidaTotalKg.toFixed(2)} Kg`}
                icon={<Weight className="h-3.5 w-3.5" />}
              />
              <MesStatTile
                label="Paletas registradas"
                value={salidaPaletas.length}
                icon={<Package className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Merma</p>
            <div className="mes-stat-grid sm:grid-cols-2">
              <MesStatTile
                label="Merma (Kg)"
                value={`${kgMerma.toFixed(2)} Kg`}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              />
              <MesStatTile
                label="% merma / ingreso"
                value={`${mermaPct}%`}
                icon={<Percent className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          <div className="mes-paletas-resumen-panel rounded-lg border border-slate-200/90 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-900/25">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Paletas de salida
            </p>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-xs">Paleta</TableHead>
                  <TableHead className="h-8 text-center text-xs">Bobinas</TableHead>
                  <TableHead className="h-8 text-center text-xs">Rollos</TableHead>
                  <TableHead className="h-8 text-right text-xs">Peso (Kg)</TableHead>
                  <TableHead className="h-8 text-center text-xs">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corPaletas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                      Sin paletas registradas en este turno.
                    </TableCell>
                  </TableRow>
                ) : (
                  corPaletas.map((p, idx) => (
                    <TableRow key={`res-paleta-${p.id ?? idx}`}>
                      <TableCell className="py-2 text-xs font-medium">
                        {p.label ?? `Paleta #${String(idx + 1).padStart(2, "0")}`}
                      </TableCell>
                      <TableCell className="py-2 text-center text-xs text-muted-foreground">—</TableCell>
                      <TableCell className="py-2 text-center text-xs">{countRollosWithKg(p)}</TableCell>
                      <TableCell className="py-2 text-right text-xs font-medium">
                        {sumKgFromPaleta(p).toFixed(2)}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {isCorPaletaCerrada(p) ? (
                          <Badge variant="outline" className="text-xs border-emerald-500/40 bg-emerald-500/10">
                            En despacho
                          </Badge>
                        ) : sumKgFromPaleta(p) > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                          >
                            Provisional
                          </Badge>
                        ) : (
                          <CerrarPaletaButton
                            variant="ghost"
                            disabled={!canOperateProduction || sumKgFromPaleta(p) <= 0}
                            onClick={() => cerrarPaleta(idx)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {corPaletas.length > 0 ? (
                <TableFooter>
                  <TableRow className="bg-slate-100/80 hover:bg-slate-100/80 dark:bg-slate-800/50">
                    <TableCell className="py-2 text-xs font-semibold">Total</TableCell>
                    <TableCell className="py-2 text-center text-xs font-semibold">{entradaBobinasCount}</TableCell>
                    <TableCell className="py-2 text-center text-xs font-semibold">{paletasResumenRollosTotal}</TableCell>
                    <TableCell className="py-2 text-right text-xs font-semibold">{salidaTotalKg.toFixed(2)}</TableCell>
                    <TableCell className="py-2" />
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
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

      <MesCorteConfirmDialog
        open={startTurnConfirmOpen}
        onOpenChange={setStartTurnConfirmOpen}
        icon={<Sparkles className="h-5 w-5" aria-hidden />}
        title="Abrir turno de planta (registro)"
        description="Confirme para abrir el registro de turno de planta (Diurno/Nocturno y grupo), habilitar el cronómetro y el resumen operativo del turno en curso."
        confirmLabel="Confirmar e iniciar"
        onConfirm={() => confirmIniciarTurno()}
      />

      <MesBobinaEntradaLabelDialog
        open={labelEditorOpen}
        onOpenChange={setLabelEditorOpen}
        slotIndex={labelEditorIndex}
        draft={labelEditorDraft}
        onDraftChange={(key, value) => {
          setLabelEditorDraft((prev) => ({ ...prev, [key]: value }))
          if (key === "fecha" && labelEditorError) setLabelEditorError("")
        }}
        error={labelEditorError}
        onClear={clearLabelEditor}
        onSave={saveEntradaLabelEditor}
        materialLabel="impresa"
      />

      <Dialog open={cumulativeTurnosDialogOpen} onOpenChange={setCumulativeTurnosDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Turnos acumulativos</DialogTitle>
            <DialogDescription>
              Turnos de planta cerrados y turno en curso, con tiempos del cronómetro y personal involucrado. El
              contador en vivo sigue en la sección «Cronómetro de producción».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-md border bg-muted/25 p-3 text-xs leading-relaxed">
              <p>
                <span className="font-semibold text-foreground">Registros / turnos:</span> {turnosRegistrados}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-foreground">Turnos cerrados:</span> {closedTurnos.length}
              </p>
              <p className="mt-1 text-muted-foreground">
                Último estado: <strong className="text-foreground">{ultimoTurnoLabel}</strong>
              </p>
            </div>

            {hasActiveTurno ? (
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Turno en curso</p>
                <p className="mt-2 text-xs">{turnoGrupoLabel(corTurnoProp || readString(form.corTurno), corGrupoProp || readString(form.corGrupo))}</p>
                <p className="mt-2 text-xs font-medium text-foreground">Personal</p>
                {activeSaved.length === 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs">Sin personal guardado en este turno.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-xs">
                    {activeSaved.map((p) => (
                      <li key={p.id}>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground"> — {roleLabelEs(p.role)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-muted-foreground mt-2 border-t pt-2 text-xs">
                  Efectivo {formatTimerHmsFn(effectiveSec)} · Muerto {formatTimerHmsFn(deadSec)} · Total{" "}
                  {formatTimerHmsFn(totalSec)}
                </p>
              </div>
            ) : null}

            {closedTurnos.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Turnos cerrados ({closedTurnos.length})
                </p>
                <ul className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                  {closedTurnos.map((t) => (
                    <li key={t.id} className="rounded-md border bg-background p-3 text-xs">
                      <p className="font-medium text-foreground">
                        {t.closed_at
                          ? new Date(t.closed_at).toLocaleString("es-VE")
                          : "Sin fecha de cierre"}{" "}
                        · {turnoGrupoLabel(t.turno, t.grupo)}
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Salida {readNumber(t.metrics?.salida_total_kg).toFixed(2)} Kg · Efectivo{" "}
                        {formatTimerHmsFn(t.timer.effectiveAccSec)} · Muerto {formatTimerHmsFn(t.timer.deadAccSec)}
                      </p>
                      <p className="text-muted-foreground mt-1">
                        {t.operador.trim() ? `Op. ${t.operador.trim()}` : "—"}
                        {t.ayudante.trim() ? ` · Ay. ${t.ayudante.trim()}` : ""}
                        {t.supervisor.trim() ? ` · Sup. ${t.supervisor.trim()}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCumulativeTurnosDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

