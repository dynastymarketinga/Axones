import { useCallback, useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import {
  AlarmClock,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  BarChart3,
  Beaker,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  CirclePause,
  CirclePlay,
  ClipboardList,
  Clock,
  Droplets,
  Factory,
  FileSearch,
  Flag,
  Hash,
  History,
  Hourglass,
  IdCard,
  Layers,
  LogOut,
  Moon,
  Package,
  PackageCheck,
  PackageSearch,
  PackageX,
  PieChart,
  Printer,
  Recycle,
  ListChecks,
  Undo2,
  RotateCcw,
  Ruler,
  Sun,
  Timer,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  Weight,
} from "lucide-react"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import {
  LAM_PAUSE_REASONS,
  type BobinaLabelMeta,
  type LamLabelEditorMode,
  sumSalidaKgTurno,
  type LaminacionTurnoEntry,
} from "./laminacion-turnos"
import LaminacionChecklistDialog from "./LaminacionChecklistDialog"
import type { LamChecklistEstado } from "./laminacion-checklist-config"

type LaminacionPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

export type DraftPersonRole = "operador" | "ayudante" | "supervisor"
export type DraftPerson = {
  id: string
  role: DraftPersonRole
  name: string
  grupo?: "A" | "B" | "C"
  turno?: "diurno" | "nocturno"
}
const DRAFT_PEOPLE_PAGE_SIZE = 5

function roleLabelEs(role: DraftPersonRole): string {
  if (role === "operador") return "Operador"
  if (role === "supervisor") return "Supervisor"
  return "Ayudante"
}

function sumMermaKg(t: LaminacionTurnoEntry): number {
  const n = Number(String(t.scrapLaminadoKg ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function personnelLinesFromLaminacionTurno(t: LaminacionTurnoEntry): string[] {
  const lines: string[] = []
  const op = t.operador.trim()
  if (op) lines.push(`${op} — Operador`)
  t.ayudante
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n) => lines.push(`${n} — Ayudante`))
  const sup = t.supervisor.trim()
  if (sup) lines.push(`${sup} — Supervisor`)
  return lines
}

function turnoGrupoLabel(turno: string, grupo: string): string {
  const t = turno === "diurno" ? "Diurno" : turno === "nocturno" ? "Nocturno" : turno.trim() || "—"
  const g = grupo === "A" || grupo === "B" || grupo === "C" ? `Grupo ${grupo}` : grupo.trim() || "—"
  return `${t} · ${g}`
}

/** Reconstruye la lista editable a partir de los tres campos persistidos en el turno. */
export function activePersonnelFromStrings(
  operador: string,
  ayudante: string,
  supervisor: string,
): DraftPerson[] {
  const out: DraftPerson[] = []
  const op = operador.trim()
  if (op) out.push({ id: "slot-operador", role: "operador", name: op })
  ayudante
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n, i) => {
      out.push({ id: `slot-ayudante-${i}`, role: "ayudante", name: n })
    })
  const sup = supervisor.trim()
  if (sup) out.push({ id: "slot-supervisor", role: "supervisor", name: sup })
  return out
}

export function stringsFromActivePersonnel(people: DraftPerson[]): {
  operador: string
  ayudante: string
  supervisor: string
} {
  const operador = people.find((p) => p.role === "operador")?.name.trim() ?? ""
  const ayudante = people
    .filter((p) => p.role === "ayudante")
    .map((p) => p.name.trim())
    .filter(Boolean)
    .join("; ")
  const supervisor = people.find((p) => p.role === "supervisor")?.name.trim() ?? ""
  return { operador, ayudante, supervisor }
}

type Props = {
  pedidoTotalKg: number
  producidoAcumuladoKg: number
  faltanteKg: number
  turnosRegistrados: number
  totalProduccionAcumulada: number
  totalScrapAcumulada: number
  ultimoTurnoLabel: string
  timerState: string
  totalSec: number
  deadSec: number
  effectiveSec: number
  /** Si true, effectiveSec/deadSec/totalSec son acumulado OT (todos los turnos). */
  timerShowsOtAccumulated?: boolean
  kgHora: string
  timerRunning: boolean
  timerPaused: boolean
  pauseReasons: string[]
  pauseReason: string
  pauseObs: string
  pauseMotivoDialogOpen: boolean
  onPauseMotivoDialogOpenChange: (open: boolean) => void
  pauseEntries: LaminacionPauseEntry[]
  lamTurno: string
  lamGrupo: string
  lamOperador: string
  lamAyudante: string
  lamSupervisor: string
  metrajeRaw: string
  entradaImpresaBobinas: string[]
  entradaImpresaMeta: BobinaLabelMeta[]
  entradaVirgenBobinas: string[]
  entradaVirgenMeta: BobinaLabelMeta[]
  salidaBobinas: string[]
  salidaMeta: BobinaLabelMeta[]
  totalEntradaImpresa: number
  totalEntradaVirgen: number
  totalSalida: number
  totalScrap: number
  totalEntradaTurno: number
  adhesivoEntradaRaw: string
  adhesivoSobroRaw: string
  catalizadorEntradaRaw: string
  catalizadorSobroRaw: string
  acetatoEntradaRaw: string
  acetatoSobroRaw: string
  adhesivoConsumido?: number
  catalizadorConsumido?: number
  acetatoConsumido?: number
  virgenRechazadasRaw?: string
  virgenMaterialesBuenosRaw?: string
  devolucionBuenaRaw?: string
  devolucionRechazadaRaw?: string
  checklistOpen?: boolean
  checklistCheckedIds?: string[]
  checklistEstado?: LamChecklistEstado
  checklistObs?: string
  checklistElaborado?: string
  checklistRevisado?: string
  checklistAprobadoPor?: string
  onChecklistOpenChange?: (open: boolean) => void
  onChecklistToggleItem?: (id: string, checked: boolean) => void
  onChecklistEstado?: (v: LamChecklistEstado) => void
  onChecklistObs?: (v: string) => void
  onChecklistElaborado?: (v: string) => void
  onChecklistRevisado?: (v: string) => void
  onChecklistAprobadoPor?: (v: string) => void
  scrapTransparenteRaw: string
  scrapImpresoRaw: string
  scrapLaminadoRaw: string
  mermaCalc?: number
  refilPct?: number
  onEntradaImpresaChange: (idx: number, v: string) => void
  onEntradaVirgenChange: (idx: number, v: string) => void
  onSalidaChange: (idx: number, v: string) => void
  onOpenImpresaLabel: (idx: number) => void
  onOpenVirgenLabel: (idx: number) => void
  onOpenSalidaLabel: (idx: number) => void
  onSetAdhesivoEntrada: (v: string) => void
  onSetAdhesivoSobro: (v: string) => void
  onSetCatalizadorEntrada: (v: string) => void
  onSetCatalizadorSobro: (v: string) => void
  onSetAcetatoEntrada: (v: string) => void
  onSetAcetatoSobro: (v: string) => void
  onSetVirgenRechazadas?: (v: string) => void
  onSetVirgenMaterialesBuenos?: (v: string) => void
  onSetDevolucionBuena?: (v: string) => void
  onSetDevolucionRechazada?: (v: string) => void
  onSetScrapTransparente: (v: string) => void
  onSetScrapImpreso: (v: string) => void
  onSetScrapLaminado: (v: string) => void
  labelEditorOpen: boolean
  labelEditorMode: LamLabelEditorMode
  labelEditorIndex: number
  labelEditorDraft: BobinaLabelMeta
  labelEditorError: string
  onLabelOpenChange: (open: boolean) => void
  onLabelDraftChange: (key: keyof BobinaLabelMeta, value: string) => void
  onLabelClear: () => void
  onLabelSave: () => void
  formatTimerHms: (s: number) => string
  setPauseReason: (v: string) => void
  setPauseObs: (v: string) => void
  startProductionTimer: () => void
  pauseProductionTimer: () => void
  confirmPauseAndResume: () => void
  onSetTurno: (v: "diurno" | "nocturno") => void
  onSetGrupo: (v: "A" | "B" | "C") => void
  onActivePersonnelApply: (people: DraftPerson[]) => void
  onSetMetraje: (v: string) => void
  hasActiveTurno: boolean
  areaFinalizada: boolean
  readOnlyOps: boolean
  canFinalizeOrder: boolean
  draftTurno: "diurno" | "nocturno"
  draftGrupo: "A" | "B" | "C"
  draftPeople: DraftPerson[]
  draftOperadorMissing: boolean
  draftStagingName: string
  draftStagingRole: DraftPersonRole
  onDraftTurno: (v: "diurno" | "nocturno") => void
  onDraftGrupo: (v: "A" | "B" | "C") => void
  onDraftStagingName: (v: string) => void
  onDraftStagingRole: (v: DraftPersonRole) => void
  onDraftPersonGuardar: (name: string, role: DraftPersonRole) => void
  onDraftPersonRemove: (id: string) => void
  onIniciarTurno: () => void
  onCerrarTurnoActual: () => void
  onFinalizarAreaLaminacion: () => void | Promise<void>
  closedTurnos: LaminacionTurnoEntry[]
  canPreviewTimerReport: boolean
  onPreviewTimerReport: () => void
  canResetAll: boolean
  onResetAll: () => void
  /** Vista piso: solo play / parada / vista previa en el cronómetro. */
  simplifiedTimerActions?: boolean
}

function fieldLabel(htmlFor: string, icon: LucideIcon, text: ReactNode) {
  const I = icon
  return (
    <Label htmlFor={htmlFor} className="ot-label">
      <span className="inline-flex items-center gap-1.5">
        <I className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span>{text}</span>
      </span>
    </Label>
  )
}

function hasMeta(meta: BobinaLabelMeta | undefined): boolean {
  if (!meta) return false
  return Object.values(meta).some((v) => String(v ?? "").trim() !== "")
}

function labelTooltipText(meta: BobinaLabelMeta | undefined): string {
  if (!meta || !hasMeta(meta)) return "Sin etiqueta registrada"
  const parts: string[] = []
  if (meta.referencia.trim()) parts.push(meta.referencia.trim())
  if (meta.peso.trim()) parts.push(`${meta.peso.trim()} Kg`)
  if (meta.fecha.trim()) parts.push(meta.fecha.trim())
  return parts.length ? parts.join(" · ") : "Etiqueta registrada"
}

function lamLabelModeTitle(mode: LamLabelEditorMode): string {
  if (mode === "impresa") return "Impresa"
  if (mode === "virgen") return "Virgen"
  return "Salida"
}

function fmtKg(n: unknown, decimals = 2): string {
  if (typeof n === "number" && Number.isFinite(n)) return n.toFixed(decimals)
  const parsed = Number(String(n ?? "").trim().replace(",", "."))
  return (Number.isFinite(parsed) ? parsed : 0).toFixed(decimals)
}



export default function WorkOrderLaminacionOpsSection(props: Props) {
  const simplifiedTimer = props.simplifiedTimerActions !== false
  const [activeStageName, setActiveStageName] = useState("")
  const [activeStageRole, setActiveStageRole] = useState<DraftPersonRole>("operador")
  const [cumulativeTurnosDialogOpen, setCumulativeTurnosDialogOpen] = useState(false)
  const [pauseParadaComboOpen, setPauseParadaComboOpen] = useState(false)
  const formFieldId = useId().replace(/:/g, "")
  const mk = (suffix: string) => `${formFieldId}-${suffix}`

  const pauseParadaComboLabel = useMemo(() => {
    const r = props.pauseReason.trim()
    if (!r) return "Seleccionar motivo…"
    return r
  }, [props.pauseReason])
  const [draftPeoplePage, setDraftPeoplePage] = useState(1)
  const [draftPeopleQuery, setDraftPeopleQuery] = useState("")
  const activeSaved = useMemo(
    () => activePersonnelFromStrings(props.lamOperador, props.lamAyudante, props.lamSupervisor),
    [props.lamOperador, props.lamAyudante, props.lamSupervisor],
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
    props.onActivePersonnelApply([...activeSaved, { id, role: activeStageRole, name }])
    setActiveStageName("")
  }, [activeStageName, activeStageRole, activeSaved, props])

  const inputDisabled = props.readOnlyOps || !props.hasActiveTurno
  const num = (v: string | undefined): number => {
    const raw = String(v ?? "").trim().replace(",", ".")
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }

  /** Pedido de cliente cubierto por salida acumulada (no marcar “Completo” sin criterio). */
  const doneAcumulado =
    (props.pedidoTotalKg ?? 0) > 0.01 && (props.faltanteKg ?? 0) <= 0.01

  const autoInfoTurno =
    !!props.lamOperador.trim() ||
    !!props.lamAyudante.trim() ||
    !!props.lamSupervisor.trim() ||
    !!props.lamTurno.trim() ||
    !!props.lamGrupo.trim()
  const doneInfoTurno = autoInfoTurno

  /** “Completo” solo cuando el cronómetro quedó detenido/cerrado (no mientras corre o está en pausa). */
  const doneTemporizador =
    props.areaFinalizada ||
    props.timerState === "completed" ||
    props.timerState === "stopped"

  const doneEntradaImpresa =
    props.entradaImpresaBobinas.some((v) => num(v) > 0) ||
    props.entradaImpresaMeta.some((m) => hasMeta(m))
  const doneEntradaVirgen =
    props.entradaVirgenBobinas.some((v) => num(v) > 0) ||
    props.entradaVirgenMeta.some((m) => hasMeta(m))
  const doneAdhesivo =
    num(props.adhesivoEntradaRaw) > 0 ||
    num(props.catalizadorEntradaRaw) > 0 ||
    num(props.acetatoEntradaRaw) > 0
  const doneSalida =
    props.salidaBobinas.some((v) => num(v) > 0) ||
    props.salidaMeta.some((m) => hasMeta(m)) ||
    num(props.metrajeRaw) > 0
  const doneScrap =
    num(props.scrapTransparenteRaw) > 0 ||
    num(props.scrapImpresoRaw) > 0 ||
    num(props.scrapLaminadoRaw) > 0
  const doneResumen =
    props.totalSalida > 0.01 || props.totalEntradaImpresa + props.totalEntradaVirgen > 0.01
  const numBobinasSalida = props.salidaBobinas.filter((v) => num(v) > 0).length


  const showPersonalTurnoSetup = !props.hasActiveTurno && !props.areaFinalizada
  const draftPeopleFiltered = useMemo(() => {
    const q = draftPeopleQuery.trim().toLowerCase()
    if (!q) return props.draftPeople
    return props.draftPeople.filter((p) => {
      const turno = (p.turno ?? props.draftTurno).toLowerCase()
      const grupo = (p.grupo ?? props.draftGrupo).toLowerCase()
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
  }, [draftPeopleQuery, props.draftGrupo, props.draftPeople, props.draftTurno])
  const draftPeopleTotalPages = Math.max(1, Math.ceil(draftPeopleFiltered.length / DRAFT_PEOPLE_PAGE_SIZE))
  const draftPeopleSafePage = Math.min(draftPeoplePage, draftPeopleTotalPages)
  const draftPeopleStart = (draftPeopleSafePage - 1) * DRAFT_PEOPLE_PAGE_SIZE
  const draftPeopleVisible = draftPeopleFiltered.slice(
    draftPeopleStart,
    draftPeopleStart + DRAFT_PEOPLE_PAGE_SIZE,
  )

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
          value={`${fmtKg(props.pedidoTotalKg)} Kg`}
          icon={<Package className="h-3.5 w-3.5" />}
        />
        <MesStatTile
          label="Producido"
          value={`${fmtKg(props.producidoAcumuladoKg)} Kg`}
          tone="positive"
          icon={<Factory className="h-3.5 w-3.5" />}
        />
        <MesStatTile
          label="Falta por producir"
          value={`${fmtKg(props.faltanteKg)} Kg`}
          tone="negative"
          icon={<Hourglass className="h-3.5 w-3.5" />}
        />
        <MesStatTile
          label="Registros / turnos"
          value={props.turnosRegistrados}
          icon={<ClipboardList className="h-3.5 w-3.5" />}
        />
      </div>
      <div className="mes-footer-bar mes-footer-bar--3">
        <div className="mes-footer-bar__item flex items-start gap-2">
          <Factory className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Producción acumulada:{" "}
            <strong>{fmtKg(props.totalProduccionAcumulada)} Kg</strong>
          </span>
        </div>
        <div className="mes-footer-bar__item flex items-start gap-2">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Merma acumulada (Kg): <strong>{fmtKg(props.totalScrapAcumulada)} Kg</strong>
          </span>
        </div>
        <div className="mes-footer-bar__item flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Último turno: <strong>{props.ultimoTurnoLabel}</strong>
          </span>
        </div>
      </div>
    </MesSectionShell>
  )

  const savedPeopleSection = (
    <MesSectionShell
      title={mesSectionTitle(Users, `Personal guardado (${props.draftPeople.length})`)}
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
          {props.draftPeople.length === 0 ? (
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
                          (p.turno ?? props.draftTurno) === "diurno" &&
                            "border-slate-800/70 bg-slate-700 text-white dark:border-slate-600 dark:bg-slate-600",
                          (p.turno ?? props.draftTurno) === "nocturno" &&
                            "border-indigo-800/70 bg-indigo-700 text-white dark:border-indigo-600 dark:bg-indigo-600",
                        )}
                      >
                        {(p.turno ?? props.draftTurno) === "diurno" ? "Diurno" : "Nocturno"}
                      </Badge>
                      <Badge
                        className={cn(
                          "montaje-grupo-badge min-w-[4.5rem] justify-center border px-2 py-0.5 text-xs uppercase tracking-wide",
                          (p.grupo ?? props.draftGrupo) === "A" &&
                            "border-blue-800/70 bg-blue-700 text-white dark:border-blue-600 dark:bg-blue-600",
                          (p.grupo ?? props.draftGrupo) === "B" &&
                            "border-orange-800/70 bg-orange-700 text-white dark:border-orange-600 dark:bg-orange-600",
                          (p.grupo ?? props.draftGrupo) === "C" &&
                            "border-teal-800/70 bg-teal-700 text-white dark:border-teal-600 dark:bg-teal-600",
                        )}
                      >
                        Grupo {p.grupo ?? props.draftGrupo}
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
                      onClick={() => props.onDraftPersonRemove(p.id)}
                      disabled={props.readOnlyOps}
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
      {props.areaFinalizada ? (
        <div className="rounded-lg border border-violet-300 bg-violet-100/80 p-3 text-sm text-violet-950 dark:bg-violet-950/40 dark:text-violet-100">
          <span className="font-semibold">Área de laminación finalizada.</span>{" "}
          {props.canFinalizeOrder
            ? "Puede revisar datos guardados. Use Guardar si realiza correcciones."
            : "Solo personal autorizado puede reabrir o corregir desde otro rol."}
        </div>
      ) : null}

      <div className="space-y-4">
        {acumuladoOrdenSection}
        {props.closedTurnos.length > 0 ? (
          <Collapsible className="rounded-lg border border-slate-300 bg-white shadow-sm">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium hover:bg-muted/50">
              <span className="inline-flex items-center gap-2">
                <History className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                Turnos registrados ({props.closedTurnos.length})
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="space-y-2 border-t px-3 pb-3 pt-1 text-xs">
                {props.closedTurnos.map((t) => (
                  <li key={t.id} className="rounded border bg-background p-2">
                    <div className="font-medium">
                      {t.closed_at
                        ? new Date(t.closed_at).toLocaleString("es-VE")
                        : "—"}{" "}
                      · {t.turno || "?"} / {t.grupo || "?"} · {t.operador || "—"}
                    </div>
                    <div className="text-muted-foreground mt-1">
                      Producción {sumSalidaKgTurno(t).toFixed(2)} Kg · Salida {sumSalidaKgTurno(t).toFixed(2)} Kg ·
                      Tiempo efectivo {props.formatTimerHms(t.timer.effectiveAccSec)}
                    </div>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>

      {showPersonalTurnoSetup ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start xl:gap-5">
          <div className="min-w-0 space-y-4">{savedPeopleSection}</div>
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
                        value={props.draftTurno}
                        onValueChange={(v) => {
                          if (!v) return
                          props.onDraftTurno(v as "diurno" | "nocturno")
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
                        value={props.draftGrupo}
                        onValueChange={(v) => {
                          if (!v) return
                          props.onDraftGrupo(v as "A" | "B" | "C")
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
                              {props.draftStagingRole === "operador" ? " (operador)" : " (personal)"}
                            </span>
                          </>,
                        )}
                        <Input
                          id={mk("draft-person-name")}
                          name="lamDraftPersonName"
                          className="montaje-person-input ot-input-unified h-11 w-full min-w-0 text-base md:text-base"
                          value={props.draftStagingName}
                          onChange={(e) => props.onDraftStagingName(e.target.value)}
                          placeholder="Nombre"
                          disabled={props.readOnlyOps}
                        />
                      </div>

                      <div className="min-w-0 space-y-2">
                        {fieldLabel(mk("draft-person-role"), IdCard, "Rol")}
                        <Select
                          value={props.draftStagingRole}
                          onValueChange={(v) => props.onDraftStagingRole(v as DraftPersonRole)}
                          disabled={props.readOnlyOps}
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
                          {props.draftStagingRole === "operador"
                            ? "Rol principal requerido para poder iniciar el turno"
                            : props.draftStagingRole === "supervisor"
                              ? "Control y seguimiento del turno"
                              : "Apoyo operativo de la cuadrilla"}
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="montaje-save-person-btn h-12 w-full gap-2 text-base font-semibold sm:w-auto sm:min-w-[12rem] sm:shrink-0"
                      onClick={() =>
                        props.onDraftPersonGuardar(props.draftStagingName, props.draftStagingRole)
                      }
                      disabled={props.readOnlyOps}
                    >
                      <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
                      Guardar persona
                    </Button>
                  </div>

                  {props.draftOperadorMissing ? (
                    <div className="montaje-operador-warning mt-3 rounded-md border px-3 py-2.5">
                      {props.draftPeople.length > 0 ? (
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

                <div className="mt-5 flex justify-center border-t border-border/60 pt-5">
                  <Button
                    type="button"
                    className="montaje-iniciar-turno-btn h-12 min-w-[14rem] gap-2 px-6 text-base font-semibold"
                    onClick={props.onIniciarTurno}
                    disabled={props.readOnlyOps || props.draftOperadorMissing}
                    title={
                      props.draftOperadorMissing
                        ? "Guarde al menos una persona con rol Operador en la cuadrilla"
                        : "Abre el registro de turno de planta (no inicia el cronómetro de máquina)"
                    }
                  >
                    <CirclePlay className="h-5 w-5 shrink-0" aria-hidden />
                    Iniciar turno
                  </Button>
                </div>
              </div>
            </MesSectionShell>
          </div>
        </div>
      ) : null}

      {props.hasActiveTurno ? (
      <MesSectionShell
        title={mesSectionTitle(ClipboardList, "Información del turno")}
        headerRight={<MesSectionHeaderExtras isDone={doneInfoTurno} />}
      >
        <p className="text-muted-foreground mb-3 border-b border-border/50 pb-3 text-xs leading-snug">
          Turno de planta (calendario y cuadrilla) y personal del registro actual. El cronómetro (tiempo efectivo y
          paradas con motivo) está en la sección siguiente.
          {simplifiedTimer ? (
            <>
              {" "}
              Use <span className="font-semibold text-foreground">Guardar</span> o{" "}
              <span className="font-semibold text-foreground">Terminar turno de planta</span> en el panel del cronómetro cuando
              corresponda.
            </>
          ) : (
            <>
              {" "}
              Para cerrar la sesión use <span className="font-semibold text-foreground">Cerrar turno</span> en el
              cronómetro.
            </>
          )}
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            {fieldLegend(Clock, "Turno")}
            <div className="mes-toggle-row mes-toggle-turno">
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                value={props.lamTurno}
                onValueChange={(v) => {
                  if (!v) return
                  props.onSetTurno(v as "diurno" | "nocturno")
                }}
                disabled={props.readOnlyOps}
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
                value={props.lamGrupo}
                onValueChange={(v) => {
                  if (!v) return
                  props.onSetGrupo(v as "A" | "B" | "C")
                }}
                disabled={props.readOnlyOps}
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
                    name="lamActivePersonName"
                    className="ot-input-unified h-9 w-full min-w-0 bg-white dark:bg-white dark:text-slate-900"
                    value={activeStageName}
                    onChange={(e) => setActiveStageName(e.target.value)}
                    placeholder="Nombre"
                    disabled={props.readOnlyOps}
                  />
                </div>

                <div className="min-w-0 space-y-1">
                  {fieldLabel(mk("active-person-role"), IdCard, "Rol")}
                  <Select
                    value={activeStageRole}
                    onValueChange={(v) => setActiveStageRole(v as DraftPersonRole)}
                    disabled={props.readOnlyOps}
                  >
                    <SelectTrigger
                      id={mk("active-person-role")}
                      className="h-9 w-full min-w-0 bg-white dark:bg-white dark:text-slate-900"
                    >
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operador">Operador</SelectItem>
                      <SelectItem value="ayudante">Ayudante</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-[11px] text-muted-foreground">
                    {activeStageRole === "operador"
                      ? "Responsable del turno"
                      : activeStageRole === "supervisor"
                        ? "Máximo 1 por turno"
                        : "Apoyo operativo"}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="h-9 w-full gap-1.5 sm:w-auto sm:shrink-0"
                onClick={guardarPersonaTurnoActivo}
                disabled={props.readOnlyOps}
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
                          onClick={() =>
                            props.onActivePersonnelApply(activeSaved.filter((x) => x.id !== p.id))
                          }
                          disabled={props.readOnlyOps}
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
          {simplifiedTimer && props.hasActiveTurno && !props.areaFinalizada ? (
            <div className="mt-4 border-t border-border/50 pt-4">
              <p className="text-muted-foreground text-xs leading-snug">
                El cierre del turno se realiza con{" "}
                <span className="font-semibold text-foreground">Guardar</span> o Terminar turno de planta en el panel del cronómetro.
              </p>
            </div>
          ) : null}
        </div>
      </MesSectionShell>
      ) : null}

      <MesSectionShell
        title={mesSectionTitle(Timer, "Cronómetro de producción")}
        headerRight={
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            {doneTemporizador ? (
              <div className="mes-badge-done">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Completo
              </div>
            ) : null}
            <Badge variant="secondary" className="max-w-[14rem] text-xs leading-snug">
              {props.areaFinalizada
                ? "Área finalizada"
                : !props.hasActiveTurno
                  ? props.timerShowsOtAccumulated
                    ? "Entre turnos · tiempo acumulado"
                    : "Sin turno de planta abierto"
                  : props.timerState === "running"
                    ? "Cronómetro en marcha"
                    : props.timerState === "paused"
                      ? "Cronómetro en pausa"
                      : props.timerState === "completed"
                        ? "Orden finalizada"
                        : props.timerState === "stopped"
                          ? "Registro de turno cerrado"
                          : "Cronómetro listo (sin iniciar)"}
            </Badge>
          </div>
        }
      >
        {props.hasActiveTurno ? (
          <div className="mb-3 rounded-md border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs leading-snug text-foreground">
            <span className="font-semibold">Cronómetro (máquina):</span> cuenta tiempo efectivo y paradas.{" "}
            <span className="font-semibold">Parada</span> detiene el efectivo y pide motivo (tiempo muerto);{" "}
            <span className="font-semibold">no</span> cierra el turno de planta.
            {simplifiedTimer ? (
              <>
                {" "}
                Use <span className="font-semibold">Guardar</span> o{" "}
                <span className="font-semibold">Terminar turno de planta</span> (mismo efecto): cierran el turno y lo
                dejan en el historial.
              </>
            ) : (
              <>
                {" "}
                Para cerrar la sesión use <span className="font-semibold">Cerrar turno</span>.
              </>
            )}
          </div>
        ) : null}
        {!props.hasActiveTurno ? (
          <div className="mb-3 rounded-md border border-dashed border-slate-400 bg-white px-3 py-2 text-xs text-slate-600">
            Primero abra un <span className="font-semibold text-foreground">turno de planta</span> con{" "}
            <span className="font-semibold text-foreground">Iniciar turno</span> en la sección superior. Después podrá
            usar el <span className="font-semibold text-foreground">cronómetro</span> (play en esta sección) para
            registrar tiempos y paradas con motivo.
          </div>
        ) : null}
        <div className="mes-timer-grid">
          <MesTimerFace
            elapsedLabel={props.formatTimerHms(props.effectiveSec)}
            elapsedCaption={
              props.timerShowsOtAccumulated
                ? "Tiempo efectivo acumulado (todos los turnos de la OT)"
                : "Tiempo efectivo (se detiene al registrar parada)"
            }
            deadHms={props.formatTimerHms(props.deadSec)}
            effectiveHms={props.formatTimerHms(props.totalSec)}
            productiveMetricLabel={
              props.timerShowsOtAccumulated
                ? "Total acumulado (efectivo + paradas)"
                : "Total (efectivo + paradas)"
            }
            kgHora={props.kgHora}
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
                        className="mes-timer-action-btn mes-btn-primary"
                        aria-label="Iniciar cronómetro de producción"
                        onClick={props.startProductionTimer}
                        disabled={
                          props.readOnlyOps ||
                          !props.hasActiveTurno ||
                          props.timerRunning ||
                          props.areaFinalizada ||
                          props.timerState === "completed"
                        }
                      >
                        <CirclePlay className="shrink-0" aria-hidden />
                        <span>Iniciar</span>
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
                        className="mes-timer-action-btn mes-btn-secondary"
                        aria-label="Pausar cronómetro y registrar motivo de parada"
                        onClick={props.pauseProductionTimer}
                        disabled={props.readOnlyOps || !props.timerRunning}
                      >
                        <CirclePause className="shrink-0" aria-hidden />
                        <span>Parada</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      Detiene el tiempo efectivo y solicita motivo de parada (tiempo muerto). No cierra el turno de
                      planta.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="mes-timer-action-btn mes-btn-muted"
                        aria-label="Vista previa"
                        onClick={props.onPreviewTimerReport}
                        disabled={props.readOnlyOps || !props.canPreviewTimerReport}
                      >
                        <FileSearch className="shrink-0" aria-hidden />
                        <span>Vista previa</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {props.canPreviewTimerReport
                        ? "Vista previa del reporte del cronómetro"
                        : "Inicie el cronómetro para habilitar la vista previa"}
                    </TooltipContent>
                  </Tooltip>
                </div>
                {props.hasActiveTurno ? (
                  <div className="mes-timer-action-labeled mt-2 border-t border-border/60 pt-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="mes-timer-action-btn mes-btn-danger-outline"
                          aria-label="Terminar turno de planta"
                          onClick={props.onCerrarTurnoActual}
                          disabled={props.readOnlyOps || props.areaFinalizada}
                        >
                          <LogOut className="shrink-0" aria-hidden />
                          <span>Terminar turno de planta</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Mismo efecto que Guardar: cierra el turno, guarda en historial y deja las rejillas en cero.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : null}
                {props.canFinalizeOrder && !props.areaFinalizada ? (
                  <div className="mes-timer-action-labeled">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="mes-timer-action-btn mes-btn-destructive-solid"
                          aria-label="Finalizar área de laminación"
                          onClick={() => void props.onFinalizarAreaLaminacion()}
                          disabled={props.readOnlyOps && !props.canFinalizeOrder}
                        >
                          <Flag className="shrink-0" aria-hidden />
                          <span>Finalizar área de laminación</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Marca el área de laminación como finalizada en la OT (historial en bandeja).
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : null}
                {!simplifiedTimer ? (
                  <div className="mes-timer-action-labeled">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="mes-timer-action-btn mes-btn-warn-outline"
                          aria-label="Reiniciar (desde cero)"
                          onClick={props.onResetAll}
                          disabled={!props.canResetAll}
                        >
                          <RotateCcw className="shrink-0" aria-hidden />
                          <span>Reiniciar</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Borra turnos, cronómetro y checks para esta OT (Laminación)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : null}
              </div>
            </TooltipProvider>
          </div>
        </div>
        {props.timerPaused && !props.pauseMotivoDialogOpen ? (
          <div className="mt-2 flex justify-center md:justify-end">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-normal text-amber-800 underline-offset-4 hover:text-amber-950"
              onClick={() => props.onPauseMotivoDialogOpenChange(true)}
            >
              Motivo de parada
            </Button>
          </div>
        ) : null}
        {props.pauseEntries.length > 0 ? (
          <div className="mt-3 space-y-1 rounded-md border border-slate-200 bg-white p-2">
            <p className="text-muted-foreground text-xs">Paradas registradas</p>
            {props.pauseEntries.map((entry, idx) => (
              <div key={`${entry.at}-${idx}`} className="text-xs">
                <span className="font-medium">{idx + 1}. {entry.reason}</span>
                <span className="text-muted-foreground"> · {props.formatTimerHms(entry.duration_sec)}</span>
                {entry.obs ? <span className="text-muted-foreground"> · {entry.obs}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </MesSectionShell>

      {props.hasActiveTurno ? (
      <>
      <MesSectionShell
        title={mesSectionTitle(Printer, "Ingreso bobinas impresas")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneEntradaImpresa} />}
        bodyClassName="mes-section__body--flush"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {props.entradaImpresaBobinas.map((val, idx) => (
            <div key={`lam-imp-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={mk(`impresa-bobina-${idx}`)} className="ot-label">
                  <span className="inline-flex items-center gap-1">
                    <Hash className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                    {idx + 1}
                  </span>
                </Label>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant={hasMeta(props.entradaImpresaMeta[idx]) ? "default" : "outline"}
                        className="h-5 w-5"
                        onClick={() => props.onOpenImpresaLabel(idx)}
                        disabled={inputDisabled}
                        title={`Etiqueta bobina impresa #${idx + 1}`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{labelTooltipText(props.entradaImpresaMeta[idx])}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id={mk(`impresa-bobina-${idx}`)}
                name={`lamEntradaImpresaBobinaKg_${idx + 1}`}
                className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                inputMode="decimal"
                value={val}
                onChange={(e) => props.onEntradaImpresaChange(idx, e.target.value)}
                placeholder="0"
                disabled={inputDisabled}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 mes-stat-grid">
          <MesStatTile
            label="Total impreso (Kg)"
            value={`${fmtKg(props.totalEntradaImpresa)} Kg`}
            icon={<Weight className="h-3.5 w-3.5" />}
          />
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Package, "Ingreso bobinas virgen")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneEntradaVirgen} />}
        bodyClassName="mes-section__body--flush"
      >
        <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
          Registre el peso por bobina virgen utilizada en laminación. Use la flecha para capturar datos de etiqueta
          (inventario / lote).
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {props.entradaVirgenBobinas.map((val, idx) => (
            <div key={`lam-vir-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={mk(`virgen-bobina-${idx}`)} className="ot-label">
                  <span className="inline-flex items-center gap-1">
                    <Hash className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                    {idx + 1}
                  </span>
                </Label>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant={hasMeta(props.entradaVirgenMeta[idx]) ? "default" : "outline"}
                        className="h-5 w-5"
                        onClick={() => props.onOpenVirgenLabel(idx)}
                        disabled={inputDisabled}
                        title={`Etiqueta bobina virgen #${idx + 1}`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{labelTooltipText(props.entradaVirgenMeta[idx])}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id={mk(`virgen-bobina-${idx}`)}
                name={`lamEntradaVirgenBobinaKg_${idx + 1}`}
                className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                inputMode="decimal"
                value={val}
                onChange={(e) => props.onEntradaVirgenChange(idx, e.target.value)}
                placeholder="0"
                disabled={inputDisabled}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 mes-stat-grid sm:grid-cols-3">
          <MesStatTile
            label="Total virgen (Kg)"
            value={`${fmtKg(props.totalEntradaVirgen)} Kg`}
            icon={<Weight className="h-3.5 w-3.5" />}
          />
          <div className="space-y-1">
            {fieldLabel(mk("virgen-rech"), PackageX, "Virgen rechazada (Kg)")}
            <Input
              id={mk("virgen-rech")}
              name="lamEntradaVirgenRechazadasKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.virgenRechazadasRaw ?? ""}
              onChange={(e) => props.onSetVirgenRechazadas?.(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("virgen-buena"), PackageCheck, "Material bueno devuelto (Kg)")}
            <Input
              id={mk("virgen-buena")}
              name="lamEntradaVirgenMaterialesBuenosKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.virgenMaterialesBuenosRaw ?? ""}
              onChange={(e) => props.onSetVirgenMaterialesBuenos?.(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Beaker, "Control adhesivo del turno")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneAdhesivo} />}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            {fieldLabel(mk("adhesivo-entrada"), Beaker, "Adhesivo entrada (Kg)")}
            <Input
              id={mk("adhesivo-entrada")}
              name="lamAdhesivoEntradaKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.adhesivoEntradaRaw}
              onChange={(e) => props.onSetAdhesivoEntrada(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("adhesivo-sobro"), Beaker, "Adhesivo sobro (Kg)")}
            <Input
              id={mk("adhesivo-sobro")}
              name="lamAdhesivoSobroKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.adhesivoSobroRaw}
              onChange={(e) => props.onSetAdhesivoSobro(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
          <MesStatTile
            label="Adhesivo consumido"
            value={`${fmtKg(props.adhesivoConsumido)} Kg`}
            icon={<Beaker className="h-3.5 w-3.5" />}
          />
          <div className="space-y-1">
            {fieldLabel(mk("catalizador-entrada"), Droplets, "Catalizador entrada (Kg)")}
            <Input
              id={mk("catalizador-entrada")}
              name="lamCatalizadorEntradaKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.catalizadorEntradaRaw}
              onChange={(e) => props.onSetCatalizadorEntrada(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("catalizador-sobro"), Droplets, "Catalizador sobro (Kg)")}
            <Input
              id={mk("catalizador-sobro")}
              name="lamCatalizadorSobroKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.catalizadorSobroRaw}
              onChange={(e) => props.onSetCatalizadorSobro(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("acetato-entrada"), Droplets, "Acetato entrada (Lt)")}
            <Input
              id={mk("acetato-entrada")}
              name="lamAcetatoEntradaLt"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.acetatoEntradaRaw}
              onChange={(e) => props.onSetAcetatoEntrada(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("acetato-sobro"), Droplets, "Acetato sobro (Lt)")}
            <Input
              id={mk("acetato-sobro")}
              name="lamAcetatoSobroLt"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.acetatoSobroRaw}
              onChange={(e) => props.onSetAcetatoSobro(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
          <MesStatTile
            label="Catalizador consumido"
            value={`${fmtKg(props.catalizadorConsumido)} Kg`}
            icon={<Droplets className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Acetato consumido"
            value={`${fmtKg(props.acetatoConsumido)} Lt`}
            icon={<Droplets className="h-3.5 w-3.5" />}
          />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Consumo: adhesivo {fmtKg(props.adhesivoConsumido)} Kg · catalizador{" "}
          {fmtKg(props.catalizadorConsumido)} Kg · acetato {fmtKg(props.acetatoConsumido)} Lt
        </p>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PackageSearch, "Salida laminada del turno")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneSalida} />}
        bodyClassName="mes-section__body--flush"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {props.salidaBobinas.map((val, idx) => (
            <div key={`lam-sal-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={mk(`salida-bobina-${idx}`)} className="ot-label">
                  <span className="inline-flex items-center gap-1">
                    <Hash className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                    {idx + 1}
                  </span>
                </Label>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant={hasMeta(props.salidaMeta[idx]) ? "default" : "outline"}
                        className="h-5 w-5"
                        onClick={() => props.onOpenSalidaLabel(idx)}
                        disabled={inputDisabled}
                        title={`Etiqueta bobina laminada #${idx + 1}`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{labelTooltipText(props.salidaMeta[idx])}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id={mk(`salida-bobina-${idx}`)}
                name={`lamSalidaBobinaKg_${idx + 1}`}
                className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                inputMode="decimal"
                value={val}
                onChange={(e) => props.onSalidaChange(idx, e.target.value)}
                placeholder="0"
                disabled={inputDisabled}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 mes-stat-grid sm:grid-cols-2 lg:grid-cols-4">
          <MesStatTile label="N° bobinas" value={numBobinasSalida} icon={<Hash className="h-3.5 w-3.5" />} />
          <MesStatTile
            label="Peso total salida"
            value={`${fmtKg(props.totalSalida)} Kg`}
            icon={<Weight className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Merma calculada"
            value={`${fmtKg(props.mermaCalc)} Kg`}
            icon={<Recycle className="h-3.5 w-3.5" />}
          />
          <div className="space-y-1">
            {fieldLabel(mk("metraje"), Ruler, "Metraje producción")}
            <Input
              id={mk("metraje")}
              name="lamMetrajeProduccion"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.metrajeRaw}
              onChange={(e) => props.onSetMetraje(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Undo2, "Devolución del turno")}
        subtle
        headerRight={
          <MesSectionHeaderExtras
            isDone={num(props.devolucionBuenaRaw) > 0 || num(props.devolucionRechazadaRaw) > 0}
          />
        }
      >
        <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
          Registre devolución buena (repone inventario al guardar producción) y rechazada (reclamo proveedor), como en
          el formulario de planta legacy.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3">
            {fieldLabel(mk("dev-buena"), PackageCheck, "Devolución buena (Kg)")}
            <Input
              id={mk("dev-buena")}
              name="lamDevolucionBuenaKg"
              className="ot-input-unified mt-1 h-9 bg-white"
              inputMode="decimal"
              value={props.devolucionBuenaRaw ?? ""}
              onChange={(e) => props.onSetDevolucionBuena?.(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
          <div className="rounded-md border border-red-200 bg-red-50/80 p-3">
            {fieldLabel(mk("dev-rech"), PackageX, "Devolución rechazada (Kg)")}
            <Input
              id={mk("dev-rech")}
              name="lamDevolucionRechazadaKg"
              className="ot-input-unified mt-1 h-9 bg-white"
              inputMode="decimal"
              value={props.devolucionRechazadaRaw ?? ""}
              onChange={(e) => props.onSetDevolucionRechazada?.(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Recycle, "Scrap / refil del turno (Kg)")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneScrap} />}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {fieldLabel(mk("scrap-transparente"), Layers, "Transparente")}
            <Input
              id={mk("scrap-transparente")}
              name="lamScrapTransparenteKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.scrapTransparenteRaw}
              onChange={(e) => props.onSetScrapTransparente(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
          </div>
          <div>
            {fieldLabel(mk("scrap-impreso"), Printer, "Impreso")}
            <Input
              id={mk("scrap-impreso")}
              name="lamScrapImpresoKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.scrapImpresoRaw}
              onChange={(e) => props.onSetScrapImpreso(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
          </div>
          <div>
            {fieldLabel(mk("scrap-laminado"), PackageSearch, "Laminado")}
            <Input
              id={mk("scrap-laminado")}
              name="lamScrapLaminadoKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.scrapLaminadoRaw}
              onChange={(e) => props.onSetScrapLaminado(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
          </div>
          <MesStatTile
            label="Total scrap"
            value={`${fmtKg(props.totalScrap)} Kg`}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
        </div>
        <div className="mt-2 mes-stat-grid sm:grid-cols-2">
          <MesStatTile
            label="% refil (scrap / salida)"
            value={`${fmtKg(props.refilPct)} %`}
            icon={<PieChart className="h-3.5 w-3.5" />}
          />
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PieChart, "Resumen de producción del turno")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneResumen} />}
      >
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Bobinas impresas (entrada)", `${fmtKg(props.totalEntradaImpresa)} Kg`],
                ["Devolución buena", `${fmtKg(num(props.devolucionBuenaRaw))} Kg`],
                ["Devolución rechazada", `${fmtKg(num(props.devolucionRechazadaRaw))} Kg`],
                [
                  "Consumido impresas (aprox.)",
                  `${fmtKg(
                    Math.max(
                      0,
                      (props.totalEntradaImpresa ?? 0) -
                        num(props.devolucionBuenaRaw) -
                        num(props.devolucionRechazadaRaw),
                    ),
                  )} Kg`,
                ],
                ["Bobinas virgen (entrada)", `${fmtKg(props.totalEntradaVirgen)} Kg`],
                ["Virgen rechazada", `${fmtKg(num(props.virgenRechazadasRaw))} Kg`],
                ["Material bueno devuelto", `${fmtKg(num(props.virgenMaterialesBuenosRaw))} Kg`],
                [
                  "Consumido virgen (aprox.)",
                  `${fmtKg(
                    Math.max(0, (props.totalEntradaVirgen ?? 0) - num(props.virgenMaterialesBuenosRaw)),
                  )} Kg`,
                ],
                ["Total salida laminada", `${fmtKg(props.totalSalida)} Kg`],
                ["Total scrap", `${fmtKg(props.totalScrap)} Kg`],
                ["Adhesivo consumido", `${fmtKg(props.adhesivoConsumido)} Kg`],
                ["Merma calculada", `${fmtKg(props.mermaCalc)} Kg`],
                ["% refil (scrap / salida)", `${fmtKg(props.refilPct)} %`],
              ].map(([label, value]) => (
                <tr key={label} className="border-b last:border-b-0">
                  <td className="bg-muted/30 px-3 py-2 font-medium">{label}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MesSectionShell>

      {props.onChecklistOpenChange ? (
        <LaminacionChecklistDialog
          open={props.checklistOpen ?? false}
          onOpenChange={props.onChecklistOpenChange}
          checkedIds={props.checklistCheckedIds ?? []}
          estado={props.checklistEstado ?? ""}
          observaciones={props.checklistObs ?? ""}
          elaborado={props.checklistElaborado ?? ""}
          revisado={props.checklistRevisado ?? ""}
          aprobadoPor={props.checklistAprobadoPor ?? ""}
          disabled={inputDisabled}
          onToggleItem={props.onChecklistToggleItem ?? (() => {})}
          onEstado={props.onChecklistEstado ?? (() => {})}
          onObservaciones={props.onChecklistObs ?? (() => {})}
          onElaborado={props.onChecklistElaborado ?? (() => {})}
          onRevisado={props.onChecklistRevisado ?? (() => {})}
          onAprobadoPor={props.onChecklistAprobadoPor ?? (() => {})}
        />
      ) : null}
      </>
      ) : null}

      <Dialog open={props.labelEditorOpen} onOpenChange={props.onLabelOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Etiqueta bobina {lamLabelModeTitle(props.labelEditorMode)} #{props.labelEditorIndex + 1}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={mk("label-fecha")}>Fecha bobina</Label>
              <Input
                id={mk("label-fecha")}
                name="lamLabelFecha"
                value={props.labelEditorDraft.fecha}
                onChange={(e) => props.onLabelDraftChange("fecha", e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-hora")}>Hora</Label>
              <Input
                id={mk("label-hora")}
                name="lamLabelHora"
                value={props.labelEditorDraft.hora}
                onChange={(e) => props.onLabelDraftChange("hora", e.target.value)}
                placeholder="--:--"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-referencia")}>Referencia bobina</Label>
              <Input
                id={mk("label-referencia")}
                name="lamLabelReferencia"
                value={props.labelEditorDraft.referencia}
                onChange={(e) => props.onLabelDraftChange("referencia", e.target.value)}
                placeholder="Ref. o lote"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-pedido-lote")}>Pedido / Lote</Label>
              <Input
                id={mk("label-pedido-lote")}
                name="lamLabelPedidoLote"
                value={props.labelEditorDraft.pedido_lote}
                onChange={(e) => props.onLabelDraftChange("pedido_lote", e.target.value)}
                placeholder="N° pedido o lote"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-proveedor")}>Proveedor</Label>
              <Input
                id={mk("label-proveedor")}
                name="lamLabelProveedor"
                value={props.labelEditorDraft.proveedor}
                onChange={(e) => props.onLabelDraftChange("proveedor", e.target.value)}
                placeholder="Nombre proveedor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-operador")}>Operador</Label>
              <Input
                id={mk("label-operador")}
                name="lamLabelOperador"
                value={props.labelEditorDraft.operador}
                onChange={(e) => props.onLabelDraftChange("operador", e.target.value)}
                placeholder="Nombre operador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-peso")}>Peso (Kg)</Label>
              <Input
                id={mk("label-peso")}
                name="lamLabelPeso"
                value={props.labelEditorDraft.peso}
                onChange={(e) => props.onLabelDraftChange("peso", e.target.value)}
                placeholder="Ej: 120"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-metraje")}>Metraje</Label>
              <Input
                id={mk("label-metraje")}
                name="lamLabelMetraje"
                value={props.labelEditorDraft.metraje}
                onChange={(e) => props.onLabelDraftChange("metraje", e.target.value)}
                placeholder="Metros"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-medida-ancho")}>Medida / Ancho (mm)</Label>
              <Input
                id={mk("label-medida-ancho")}
                name="lamLabelMedidaAncho"
                value={props.labelEditorDraft.medida_ancho}
                onChange={(e) => props.onLabelDraftChange("medida_ancho", e.target.value)}
                placeholder="Ej: 610"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-maquina-origen")}>Máquina origen</Label>
              <Input
                id={mk("label-maquina-origen")}
                name="lamLabelMaquinaOrigen"
                value={props.labelEditorDraft.maquina_origen}
                onChange={(e) => props.onLabelDraftChange("maquina_origen", e.target.value)}
                placeholder="Máquina"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={mk("label-lote")}>Lote</Label>
              <Input
                id={mk("label-lote")}
                name="lamLabelLote"
                value={props.labelEditorDraft.lote}
                onChange={(e) => props.onLabelDraftChange("lote", e.target.value)}
                placeholder="Lote"
              />
            </div>
          </div>
          {props.labelEditorError ? (
            <p className="text-sm text-destructive">{props.labelEditorError}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={props.onLabelClear}>
              Limpiar
            </Button>
            <Button type="button" onClick={props.onLabelSave}>
              Guardar etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={props.pauseMotivoDialogOpen}
        onOpenChange={(open) => {
          props.onPauseMotivoDialogOpenChange(open)
          if (!open) setPauseParadaComboOpen(false)
        }}
      >
        <DialogContent className="max-w-md border-amber-300 bg-background shadow-xl">
          <DialogHeader>
            <DialogTitle>Registrar motivo de parada</DialogTitle>
            <DialogDescription>
              Indique el motivo de esta parada y guárdelo. El cronómetro{" "}
              <span className="font-medium text-foreground">sigue en pausa</span> hasta que pulse play para reanudar
              el tiempo efectivo. Si cierra sin guardar, el cronómetro también sigue en pausa (sin registrar motivo
              aún).
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
                    name="lamPauseMotivo"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pauseParadaComboOpen}
                    className="h-9 w-full justify-between gap-2 rounded-md border border-input bg-background px-3 font-normal shadow-sm"
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-left text-sm",
                        !props.pauseReason.trim() && "text-muted-foreground",
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
                        <CommandItem
                          value="limpiar motivo parada"
                          onSelect={() => {
                            props.setPauseReason("")
                            setPauseParadaComboOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              !props.pauseReason.trim() ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          <span className="text-muted-foreground">— (sin motivo)</span>
                        </CommandItem>
                        {props.pauseReasons.map((reason) => (
                          <CommandItem
                            key={reason}
                            value={reason}
                            onSelect={() => {
                              props.setPauseReason(reason)
                              setPauseParadaComboOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                reason === props.pauseReason ? "opacity-100" : "opacity-0",
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
                name="lamPauseObs"
                value={props.pauseObs}
                onChange={(e) => props.setPauseObs(e.target.value)}
                placeholder="Detalle breve (opcional)"
                className="ot-input-unified h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => props.onPauseMotivoDialogOpenChange(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={props.confirmPauseAndResume}>
              Registrar parada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <span className="font-semibold text-foreground">Registros / turnos:</span>{" "}
                {props.turnosRegistrados}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-foreground">Turnos cerrados:</span>{" "}
                {props.closedTurnos.length}
              </p>
              <p className="mt-1 text-muted-foreground">
                Último estado: <strong className="text-foreground">{props.ultimoTurnoLabel}</strong>
              </p>
            </div>

            {props.hasActiveTurno ? (
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Turno en curso
                </p>
                <p className="mt-2 text-xs">
                  {turnoGrupoLabel(props.lamTurno, props.lamGrupo)}
                </p>
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
                  Efectivo {props.formatTimerHms(props.effectiveSec)} · Muerto{" "}
                  {props.formatTimerHms(props.deadSec)} · Total {props.formatTimerHms(props.totalSec)}
                </p>
              </div>
            ) : null}

            {props.closedTurnos.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Turnos cerrados ({props.closedTurnos.length})
                </p>
                <ul className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                  {props.closedTurnos.map((t) => {
                    const people = personnelLinesFromLaminacionTurno(t)
                    return (
                      <li key={t.id} className="rounded-md border bg-background p-3 text-xs">
                        <p className="font-medium text-foreground">
                          {t.closed_at
                            ? new Date(t.closed_at).toLocaleString("es-VE")
                            : "Sin fecha de cierre"}{" "}
                          · {turnoGrupoLabel(t.turno, t.grupo)}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          Producción {sumSalidaKgTurno(t).toFixed(2)} Kg · Salida {sumSalidaKgTurno(t).toFixed(2)} Kg · Efectivo{" "}
                          {props.formatTimerHms(t.timer.effectiveAccSec)} · Muerto{" "}
                          {props.formatTimerHms(t.timer.deadAccSec)}
                        </p>
                        <p className="mt-2 font-medium text-foreground">Personal</p>
                        {people.length === 0 ? (
                          <p className="text-muted-foreground mt-1">Sin personal registrado.</p>
                        ) : (
                          <ul className="mt-1 space-y-0.5">
                            {people.map((line, i) => (
                              <li key={`${t.id}-p-${i}`}>{line}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : !props.hasActiveTurno ? (
              <p className="text-muted-foreground text-xs">
                Aún no hay turnos cerrados. Al cerrar un turno, aparecerá aquí con tiempos y personal.
              </p>
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
