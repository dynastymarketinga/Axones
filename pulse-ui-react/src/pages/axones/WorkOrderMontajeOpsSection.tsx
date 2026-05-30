import { useCallback, useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import {
  AlarmClock,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  CirclePause,
  CirclePlay,
  ClipboardList,
  Clock,
  Factory,
  FileSearch,
  Flag,
  History,
  Hourglass,
  IdCard,
  LogOut,
  Moon,
  Package,
  RotateCcw,
  Sun,
  Timer,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react"

import {
  fieldLegend,
  MesSectionHeaderExtras,
  MesSectionShell,
  MesStatTile,
  mesSectionTitle,
  MesTimerFace,
} from "@/components/axones/mes"

import type { MontajeTimerActionFlags, MontajeTimerConfirmKey } from "./montaje-timer-actions"
import { MES_TIMER_HELP_TEXT, MesProductionTimerOpsBlock } from "./mes-production-timer-ops-block"
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
  sumProduccionKg,
  type MontajeTurnoEntry,
} from "./montaje-turnos"

type MontajePauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

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

function sumMermaKg(t: MontajeTurnoEntry): number {
  void t
  return 0
}

function personnelLinesFromMontajeTurno(t: MontajeTurnoEntry): string[] {
  const lines: string[] = []
  t.operador
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n) => lines.push(`${n} — Operador`))
  t.ayudante
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n) => lines.push(`${n} — Ayudante`))
  t.supervisor
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n) => lines.push(`${n} — Supervisor`))
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
  operador
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n, i) => {
      out.push({ id: `slot-operador-${i}`, role: "operador", name: n })
    })
  ayudante
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n, i) => {
      out.push({ id: `slot-ayudante-${i}`, role: "ayudante", name: n })
    })
  supervisor
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n, i) => {
      out.push({ id: `slot-supervisor-${i}`, role: "supervisor", name: n })
    })
  return out
}

export function stringsFromActivePersonnel(people: DraftPerson[]): {
  operador: string
  ayudante: string
  supervisor: string
} {
  const operador = people
    .filter((p) => p.role === "operador")
    .map((p) => p.name.trim())
    .filter(Boolean)
    .join("; ")
  const ayudante = people
    .filter((p) => p.role === "ayudante")
    .map((p) => p.name.trim())
    .filter(Boolean)
    .join("; ")
  const supervisor = people
    .filter((p) => p.role === "supervisor")
    .map((p) => p.name.trim())
    .filter(Boolean)
    .join("; ")
  return { operador, ayudante, supervisor }
}

type Props = {
  pedidoTotalKg: number
  producidoAcumuladoKg: number
  faltanteKg: number
  turnosRegistrados: number
  totalProduccionAcumulada: number
  totalMermaAcumulada: number
  ultimoTurnoLabel: string
  timerState: string
  totalSec: number
  deadSec: number
  /** Tiempo de desmontaje acumulado (OT o turno según `timerShowsOtAccumulated`). */
  demountSec: number
  effectiveSec: number
  /** Si true, effectiveSec/deadSec/totalSec son acumulado OT (todos los turnos). */
  timerShowsOtAccumulated?: boolean
  kgHora: string
  /** Hora de arranque del cronómetro del turno en curso (reloj, no duración). */
  horaArranque: string
  arranqueRunning?: boolean
  montajeOpRunning?: boolean
  demountRunning?: boolean
  timerRunning: boolean
  timerPaused: boolean
  timerActionFlags?: MontajeTimerActionFlags
  onRequestTimerConfirm?: (key: MontajeTimerConfirmKey) => void
  pauseReasons: string[]
  pauseReason: string
  pauseObs: string
  pauseMotivoDialogOpen: boolean
  onPauseMotivoDialogOpenChange: (open: boolean) => void
  pauseEntries: MontajePauseEntry[]
  montTurno: string
  montGrupo: string
  montOperador: string
  montAyudante: string
  montSupervisor: string
  formatTimerHms: (s: number) => string
  setPauseReason: (v: string) => void
  setPauseObs: (v: string) => void
  startProductionTimer?: () => void
  pauseProductionTimer?: () => void
  confirmPauseAndResume: () => void
  onSetTurno: (v: "diurno" | "nocturno") => void
  onSetGrupo: (v: "A" | "B" | "C") => void
  onActivePersonnelApply: (people: DraftPerson[]) => void
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
  onFinalizarAreaMontaje: () => void | Promise<void>
  closedTurnos: MontajeTurnoEntry[]
  lastClosedTurno: MontajeTurnoEntry | null
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



export default function WorkOrderMontajeOpsSection(props: Props) {
  const simplifiedTimer = props.simplifiedTimerActions !== false
  const [activeStageName, setActiveStageName] = useState("")
  const [activeStageRole, setActiveStageRole] = useState<DraftPersonRole>("operador")
  const [draftPeoplePage, setDraftPeoplePage] = useState(1)
  const [draftPeopleQuery, setDraftPeopleQuery] = useState("")
  const [cumulativeTurnosDialogOpen, setCumulativeTurnosDialogOpen] = useState(false)
  const [pauseParadaComboOpen, setPauseParadaComboOpen] = useState(false)
  const formFieldId = useId().replace(/:/g, "")
  const mk = (suffix: string) => `${formFieldId}-${suffix}`

  const pauseParadaComboLabel = useMemo(() => {
    const r = props.pauseReason.trim()
    if (!r) return "Seleccionar motivo…"
    return r
  }, [props.pauseReason])
  const activeSaved = useMemo(
    () => activePersonnelFromStrings(props.montOperador, props.montAyudante, props.montSupervisor),
    [props.montOperador, props.montAyudante, props.montSupervisor],
  )
  const visibleTurno = props.hasActiveTurno ? null : props.lastClosedTurno

  const guardarPersonaTurnoActivo = useCallback(() => {
    const name = activeStageName.trim()
    if (!name) {
      toast.error("Escriba el nombre antes de guardar.")
      return
    }
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    props.onActivePersonnelApply([...activeSaved, { id, role: activeStageRole, name }])
    setActiveStageName("")
  }, [activeStageName, activeStageRole, activeSaved, props])

  /** Pedido de cliente cubierto por salida acumulada (no marcar “Completo” sin criterio). */
  const doneAcumulado =
    props.pedidoTotalKg > 0.01 && props.faltanteKg <= 0.01

  const autoInfoTurno =
    !!props.montOperador.trim() ||
    !!props.montAyudante.trim() ||
    !!props.montSupervisor.trim() ||
    !!props.montTurno.trim() ||
    !!props.montGrupo.trim()
  const doneInfoTurno = autoInfoTurno

  /** “Completo” solo cuando el cronómetro quedó detenido/cerrado (no mientras corre o está en pausa). */
  const doneTemporizador =
    props.areaFinalizada ||
    props.timerState === "completed" ||
    props.timerState === "stopped"

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
          value={`${props.pedidoTotalKg.toFixed(2)} Kg`}
          icon={<Package className="h-3.5 w-3.5" />}
        />
        <MesStatTile
          label="Producido"
          value={`${props.producidoAcumuladoKg.toFixed(2)} Kg`}
          tone="positive"
          icon={<Factory className="h-3.5 w-3.5" />}
        />
        <MesStatTile
          label="Falta por producir"
          value={`${props.faltanteKg.toFixed(2)} Kg`}
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
            <strong>{props.totalProduccionAcumulada.toFixed(2)} Kg</strong>
          </span>
        </div>
        <div className="mes-footer-bar__item flex items-start gap-2">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Merma acumulada (Kg): <strong>{props.totalMermaAcumulada.toFixed(2)} Kg</strong>
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
          <span className="font-semibold">Área de montaje finalizada.</span>{" "}
          {props.canFinalizeOrder
            ? "Puede revisar datos guardados. Use Guardar si realiza correcciones."
            : "Solo personal autorizado puede reabrir o corregir desde otro rol."}
        </div>
      ) : null}

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
                          name="montDraftPersonName"
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
      ) : (
        acumuladoOrdenSection
      )}

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
                    Producción {sumProduccionKg(t).toFixed(2)} Kg · Merma {sumMermaKg(t).toFixed(2)} Kg · Tiempo efectivo{" "}
                    {props.formatTimerHms(t.timer.effectiveAccSec)}
                  </div>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {props.hasActiveTurno || !!visibleTurno ? (
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
              Al terminar la jornada pulse <span className="font-semibold text-foreground">Guardar</span> al pie de
              página y elija <span className="font-semibold text-foreground">Finalizar turno</span> o{" "}
              <span className="font-semibold text-foreground">Finalizar área Montaje</span> (también disponibles en el
              cronómetro).
            </>
          ) : (
            <>
              {" "}
              Para cerrar la sesión use <span className="font-semibold text-foreground">Finalizar turno</span> en el
              cronómetro.
            </>
          )}
        </p>
        {props.hasActiveTurno ? (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            {fieldLegend(Clock, "Turno")}
            <div className="mes-toggle-row mes-toggle-turno">
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                value={props.montTurno}
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
                value={props.montGrupo}
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
                    name="montActivePersonName"
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
                Para cerrar el turno y enviar al sistema, pulse{" "}
                <span className="font-semibold text-foreground">Guardar</span> al pie de página o use{" "}
                <span className="font-semibold text-foreground">Finalizar turno</span> en el cronómetro.
              </p>
            </div>
          ) : null}
        </div>
        ) : visibleTurno ? (
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos visibles del ultimo turno (solo lectura)
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md border bg-background px-3 py-2 text-xs">
                <span className="text-muted-foreground">Turno: </span>
                <span className="font-medium text-foreground">
                  {visibleTurno.turno === "diurno"
                    ? "Diurno"
                    : visibleTurno.turno === "nocturno"
                      ? "Nocturno"
                      : "—"}
                </span>
              </div>
              <div className="rounded-md border bg-background px-3 py-2 text-xs">
                <span className="text-muted-foreground">Grupo: </span>
                <span className="font-medium text-foreground">{visibleTurno.grupo || "—"}</span>
              </div>
              <div className="md:col-span-2 rounded-md border bg-background px-3 py-2 text-xs">
                <span className="text-muted-foreground">Personal: </span>
                <span className="font-medium text-foreground">
                  {personnelLinesFromMontajeTurno(visibleTurno).join(" · ") || "Sin personal registrado"}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs leading-snug">
              Para capturar nuevos datos, inicie un nuevo turno.
            </p>
          </div>
        ) : null}
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
                  : props.demountRunning
                    ? "Desmontaje en marcha"
                    : props.montajeOpRunning
                      ? "Montaje en marcha"
                      : props.arranqueRunning
                    ? "Arranque en marcha"
                    : props.timerState === "running"
                      ? "Producción en marcha"
                      : props.timerState === "paused"
                        ? "Producción en pausa"
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
            {simplifiedTimer && props.timerActionFlags ? (
              <> {MES_TIMER_HELP_TEXT}</>
            ) : simplifiedTimer ? (
              <>
                {" "}
                Cierre con <span className="font-semibold">Guardar</span>,{" "}
                <span className="font-semibold">Fin del turno</span> o{" "}
                <span className="font-semibold">Finalizar orden</span>.
              </>
            ) : (
              <>
                {" "}
                Para cerrar la sesión use <span className="font-semibold">Finalizar turno</span>.
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
        {simplifiedTimer && props.timerActionFlags && props.onRequestTimerConfirm ? (
          <MesProductionTimerOpsBlock
            formatTimerHms={props.formatTimerHms}
            effectiveSec={props.effectiveSec}
            deadSec={props.deadSec}
            demountSec={props.demountSec}
            totalSec={props.totalSec}
            kgHora={props.kgHora}
            horaArranque={props.horaArranque}
            timerShowsOtAccumulated={props.timerShowsOtAccumulated}
            timerRunning={props.timerRunning}
            demountRunning={props.demountRunning}
            timerActionFlags={props.timerActionFlags}
            onRequestTimerConfirm={props.onRequestTimerConfirm}
            onPreviewTimerReport={props.onPreviewTimerReport}
            canFinalizeOrder={props.canFinalizeOrder}
            areaFinalizada={props.areaFinalizada}
            areaLabel="montaje"
          />
        ) : (
        <div className="mes-timer-grid">
          <MesTimerFace
            elapsedLabel={props.formatTimerHms(props.effectiveSec)}
            elapsedCaption="Tiempo efectivo (se detiene al registrar parada)"
            deadHms={props.formatTimerHms(props.deadSec)}
            effectiveHms={props.formatTimerHms(props.totalSec)}
            productiveMetricLabel="Total (efectivo + paradas)"
            totalMetricLive={props.timerRunning}
            kgHora={props.kgHora}
            horaArranque={props.horaArranque}
          />
          <div className="mes-timer-actions w-full min-w-0">
            {false ? (
              null
            ) : (
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
                        Borra turnos, cronómetro y checks para esta OT (Montaje)
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
                            aria-label="Finalizar turno"
                            onClick={props.onCerrarTurnoActual}
                            disabled={props.readOnlyOps || props.areaFinalizada}
                          >
                            <LogOut className="shrink-0" aria-hidden />
                            <span>Finalizar turno</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          Cierra el registro de turno de planta actual (sesión). No es una parada del cronómetro ni
                          «Finalizar OT».
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
                            aria-label="Finalizar OT"
                            onClick={() => void props.onFinalizarAreaMontaje()}
                            disabled={props.readOnlyOps && !props.canFinalizeOrder}
                          >
                            <Flag className="shrink-0" aria-hidden />
                            <span>Finalizar OT</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          Cierra el área de montaje en la orden (paso de gestión). No sustituye a «Finalizar turno» ni a
                          «Parada» del cronómetro.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : null}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
        )}
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
                    name="montPauseMotivo"
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
                name="montPauseObs"
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
                  {turnoGrupoLabel(props.montTurno, props.montGrupo)}
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
                    const people = personnelLinesFromMontajeTurno(t)
                    return (
                      <li key={t.id} className="rounded-md border bg-background p-3 text-xs">
                        <p className="font-medium text-foreground">
                          {t.closed_at
                            ? new Date(t.closed_at).toLocaleString("es-VE")
                            : "Sin fecha de cierre"}{" "}
                          · {turnoGrupoLabel(t.turno, t.grupo)}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          Producción {sumProduccionKg(t).toFixed(2)} Kg · Merma {sumMermaKg(t).toFixed(2)} Kg · Efectivo{" "}
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
