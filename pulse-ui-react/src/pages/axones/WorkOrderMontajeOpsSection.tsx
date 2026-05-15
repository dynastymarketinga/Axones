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
  Ruler,
  Sun,
  Timer,
  Trash2,
  TrendingDown,
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
  MON_PAUSE_REASONS,
  sumProduccionKg,
  type MontajeTurnoEntry,
} from "./montaje-turnos"

type MontajePauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

export type DraftPersonRole = "operador" | "ayudante" | "supervisor"
export type DraftPerson = { id: string; role: DraftPersonRole; name: string }

function roleLabelEs(role: DraftPersonRole): string {
  if (role === "operador") return "Operador"
  if (role === "supervisor") return "Supervisor"
  return "Ayudante"
}

function sumMermaKg(t: MontajeTurnoEntry): number {
  const n = Number(String(t.mermaKg ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function personnelLinesFromMontajeTurno(t: MontajeTurnoEntry): string[] {
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
  kgProduccionTurno: number
  totalMermaAcumulada: number
  ultimoTurnoLabel: string
  timerState: string
  totalSec: number
  deadSec: number
  effectiveSec: number
  kgHora: string
  timerRunning: boolean
  timerPaused: boolean
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
  kgProduccionRaw: string
  mermaRaw: string
  metrajeRaw: string
  formatTimerHms: (s: number) => string
  setPauseReason: (v: string) => void
  setPauseObs: (v: string) => void
  startProductionTimer: () => void
  pauseProductionTimer: () => void
  confirmPauseAndResume: () => void
  onSetTurno: (v: "diurno" | "nocturno") => void
  onSetGrupo: (v: "A" | "B" | "C") => void
  onActivePersonnelApply: (people: DraftPerson[]) => void
  onSetKgProduccion: (v: string) => void
  onSetMerma: (v: string) => void
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
  onFinalizarAreaMontaje: () => void | Promise<void>
  closedTurnos: MontajeTurnoEntry[]
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
  const num = (v: string): number => {
    const raw = String(v ?? "").trim().replace(",", ".")
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }

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

  const doneProduccion =
    num(props.kgProduccionRaw) > 0 || num(props.mermaRaw) > 0 || num(props.metrajeRaw) > 0


  const showPersonalTurnoSetup = !props.hasActiveTurno && !props.areaFinalizada

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
          <div className="min-w-0">{acumuladoOrdenSection}</div>
          <div className="min-w-0">
            <MesSectionShell
              title={mesSectionTitle(Users, "Personal y turno de planta")}
              subtle
              bodyClassName="mes-section__body--flush"
            >
              <p className="text-muted-foreground mb-3 text-xs leading-snug">
                Elija <span className="font-semibold text-foreground">Diurno / Nocturno</span> y{" "}
                <span className="font-semibold text-foreground">grupo A / B / C</span>. Arme la cuadrilla con nombre y
                rol usando <span className="font-semibold text-foreground">Guardar persona</span> (al menos un{" "}
                <span className="font-semibold text-foreground">operador</span>). Luego pulse{" "}
                <span className="font-semibold text-foreground">Iniciar turno</span> para abrir el registro de
                producción de esta OT. Eso <span className="font-semibold text-foreground">no</span> arranca el
                cronómetro de máquina: el contador está en{" "}
                <span className="font-semibold text-foreground">Cronómetro de producción</span> más abajo (botón play
                allí).
              </p>

              <div className="rounded-lg border bg-background/60 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
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
                  <div className="space-y-1">
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

                <div className="mt-4 border-t border-border/60 pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cuadrilla (antes de iniciar)
                  </div>
                  <div className="space-y-3 rounded-md border bg-background p-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2">
                      <div className="min-w-0 space-y-1">
                        {fieldLabel(
                          mk("draft-person-name"),
                          UserRound,
                          <>
                            Nombre
                            {props.draftStagingRole === "operador" ? (
                              <span className="text-muted-foreground"> (operador)</span>
                            ) : null}
                          </>,
                        )}
                        <Input
                          id={mk("draft-person-name")}
                          name="montDraftPersonName"
                          className="ot-input-unified h-9 w-full min-w-0"
                          value={props.draftStagingName}
                          onChange={(e) => props.onDraftStagingName(e.target.value)}
                          placeholder="Nombre"
                          disabled={props.readOnlyOps}
                        />
                      </div>

                      <div className="min-w-0 space-y-1">
                        {fieldLabel(mk("draft-person-role"), IdCard, "Rol")}
                        <Select
                          value={props.draftStagingRole}
                          onValueChange={(v) => props.onDraftStagingRole(v as DraftPersonRole)}
                          disabled={props.readOnlyOps}
                        >
                          <SelectTrigger id={mk("draft-person-role")} className="h-9 w-full min-w-0">
                            <SelectValue placeholder="Seleccione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operador">Operador</SelectItem>
                            <SelectItem value="ayudante">Ayudante</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-[11px] text-muted-foreground">
                          {props.draftStagingRole === "operador"
                            ? "Responsable del turno"
                            : props.draftStagingRole === "supervisor"
                              ? "Máximo 1 por turno"
                              : "Apoyo operativo"}
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 w-full gap-1.5 sm:w-auto sm:shrink-0"
                      onClick={() =>
                        props.onDraftPersonGuardar(props.draftStagingName, props.draftStagingRole)
                      }
                      disabled={props.readOnlyOps}
                    >
                      <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                      Guardar persona
                    </Button>
                  </div>

                  <Collapsible defaultOpen className="mt-3 rounded-md border border-dashed bg-muted/20">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted/40">
                      <span className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                        Personal guardado ({props.draftPeople.length})
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {props.draftPeople.length === 0 ? (
                        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                          Aún no hay personas en la lista. Guarde al menos un <strong>operador</strong> antes de pulsar{" "}
                          <strong>Iniciar turno</strong>.
                        </div>
                      ) : (
                        <ul className="space-y-1 border-t px-3 py-2">
                          {props.draftPeople.map((p) => (
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
                                onClick={() => props.onDraftPersonRemove(p.id)}
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

                  {props.draftOperadorMissing ? (
                    <div className="mt-2 text-xs text-rose-700">
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

                <div className="mt-4 flex justify-center border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    onClick={props.onIniciarTurno}
                    disabled={props.readOnlyOps || props.draftOperadorMissing}
                    title={
                      props.draftOperadorMissing
                        ? "Guarde al menos una persona con rol Operador en la cuadrilla"
                        : "Abre el registro de turno de planta (no inicia el cronómetro de máquina)"
                    }
                  >
                    <CirclePlay className="mr-2 h-4 w-4 shrink-0" aria-hidden />
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
              Al terminar la jornada de registro use <span className="font-semibold text-foreground">Terminar turno de planta</span>{" "}
              (abajo en esta sección) y luego <span className="font-semibold text-foreground">Guardar</span>.
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
            <div className="mt-4 flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-xs leading-snug">
                Cierra el registro de este turno de planta (cuadrilla y datos del turno). Puede abrir otro turno
                después.
              </p>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-orange-300 text-orange-950 hover:bg-orange-50"
                onClick={props.onCerrarTurnoActual}
                disabled={props.readOnlyOps}
              >
                <LogOut className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                Terminar turno de planta
              </Button>
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
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="Ver turnos acumulativos y personal"
                    onClick={() => setCumulativeTurnosDialogOpen(true)}
                  >
                    <AlarmClock className="h-4 w-4 shrink-0" aria-hidden />
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
                  ? "Sin turno de planta abierto"
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
              <> Use <span className="font-semibold">Terminar turno de planta</span> en la sección anterior cuando corresponda.</>
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
            elapsedCaption="Tiempo efectivo (se detiene al registrar parada)"
            deadHms={props.formatTimerHms(props.deadSec)}
            effectiveHms={props.formatTimerHms(props.totalSec)}
            productiveMetricLabel="Total (efectivo + paradas)"
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
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-primary shrink-0"
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
                        onClick={props.pauseProductionTimer}
                        disabled={props.readOnlyOps || !props.timerRunning}
                      >
                        <CirclePause className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      Detiene el tiempo efectivo y solicita motivo de parada (tiempo muerto). No cierra el turno de
                      planta.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="mes-timer-action-labeled">
                  <span className="mes-timer-action-label">Vista previa</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-muted shrink-0"
                        aria-label="Vista previa"
                        onClick={props.onPreviewTimerReport}
                        disabled={props.readOnlyOps || !props.canPreviewTimerReport}
                      >
                        <FileSearch className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {props.canPreviewTimerReport
                        ? "Vista previa del reporte del cronómetro"
                        : "Inicie el cronómetro para habilitar la vista previa"}
                    </TooltipContent>
                  </Tooltip>
                </div>
                {!simplifiedTimer ? (
                <div className="mes-timer-action-labeled">
                  <span className="mes-timer-action-label">Reiniciar (desde cero)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mes-timer-fab-btn mes-btn-warn-outline shrink-0"
                        aria-label="Reiniciar (desde cero)"
                        onClick={props.onResetAll}
                        disabled={!props.canResetAll}
                      >
                        <RotateCcw className="shrink-0" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Borra turnos, cronómetro y checks para esta OT (Montaje)
                    </TooltipContent>
                  </Tooltip>
                </div>
                ) : null}
                {!simplifiedTimer && props.hasActiveTurno ? (
                  <div className="mes-timer-action-labeled">
                    <span className="mes-timer-action-label">Cerrar turno</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="mes-timer-fab-btn mes-btn-danger-outline shrink-0"
                          aria-label="Cerrar turno"
                          onClick={props.onCerrarTurnoActual}
                          disabled={props.readOnlyOps || props.areaFinalizada}
                        >
                          <LogOut className="shrink-0" aria-hidden />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Cierra el registro de turno de planta actual (sesión). No es una parada del cronómetro ni
                        «Finalizar OT».
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : null}
                {!simplifiedTimer && props.canFinalizeOrder && !props.areaFinalizada ? (
                  <div className="mes-timer-action-labeled">
                    <span className="mes-timer-action-label">Finalizar OT</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="mes-timer-fab-btn mes-btn-destructive-solid shrink-0"
                          aria-label="Finalizar OT"
                          onClick={() => void props.onFinalizarAreaMontaje()}
                          disabled={props.readOnlyOps && !props.canFinalizeOrder}
                        >
                          <Flag className="shrink-0" aria-hidden />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Cierra el área de montaje en la orden (paso de gestión). No sustituye a «Cerrar turno» ni a
                        «Parada» del cronómetro.
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
        title={mesSectionTitle(Weight, "Producción del turno")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneProduccion} />}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            {fieldLabel(mk("kg-prod"), Weight, "Kg producción")}
            <Input
              id={mk("kg-prod")}
              name="montKgProduccion"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.kgProduccionRaw}
              onChange={(e) => props.onSetKgProduccion(e.target.value)}
              disabled={inputDisabled}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("merma"), TrendingDown, "Merma (Kg)")}
            <Input
              id={mk("merma")}
              name="montMermaKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.mermaRaw}
              onChange={(e) => props.onSetMerma(e.target.value)}
              disabled={inputDisabled}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("metraje"), Ruler, "Metraje montaje")}
            <Input
              id={mk("metraje")}
              name="montMetraje"
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
      </>
      ) : null}

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
