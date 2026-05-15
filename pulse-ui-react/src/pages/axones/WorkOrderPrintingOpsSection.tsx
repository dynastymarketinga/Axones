import { useCallback, useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import {
  AlarmClock,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  CirclePause,
  CirclePlay,
  ClipboardList,
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
  Percent,
  PieChart,
  Printer,
  Recycle,
  RotateCcw,
  Ruler,
  Sun,
  Timer,
  Trash2,
  TrendingDown,
  Undo2,
  UserPlus,
  UserRound,
  Users,
  Warehouse,
  Weight,
} from "lucide-react"

import { MesSectionShell, MesStatTile, MesTimerFace } from "@/components/axones/mes"
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
import { Textarea } from "@/components/ui/textarea"
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
import type { MaterialRow } from "@/types/api"

import {
  PRINTING_REJECT_REASONS,
  sumSalidaKg,
  sumScrapKg,
  type BobinaLabelMeta,
  type PrintingTurnoEntry,
  type WarehouseReturnDraft,
} from "./printing-turnos"

export type { BobinaLabelMeta, WarehouseReturnDraft }

export type PrintingWarehouseReturnPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderCode: string
  draft: WarehouseReturnDraft
  onDraftChange: (patch: Partial<WarehouseReturnDraft>) => void
  materialOptionsGood: MaterialRow[]
  materialOptionsBad: MaterialRow[]
  loadingGood: boolean
  loadingBad: boolean
  submitting: boolean
  onSubmit: () => void | Promise<void>
}

type PrintingPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

type LabelEditorMode = "entrada" | "salida"
export type DraftPersonRole = "operador" | "ayudante" | "supervisor"
export type DraftPerson = { id: string; role: DraftPersonRole; name: string }

function roleLabelEs(role: DraftPersonRole): string {
  if (role === "operador") return "Operador"
  if (role === "supervisor") return "Supervisor"
  return "Ayudante"
}

function personnelLinesFromPrintingTurno(t: PrintingTurnoEntry): string[] {
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
function activePersonnelFromStrings(
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
  totalEntradaAcumulada: number
  totalEntradaTurno: number
  totalScrap: number
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
  pauseEntries: PrintingPauseEntry[]
  impTurno: string
  impGrupo: string
  impOperador: string
  impAyudante: string
  impSupervisor: string
  entradaBobinas: string[]
  entradaMeta: BobinaLabelMeta[]
  devolucionBuenaRaw: string
  devolucionRechazadaRaw: string
  devolucionRechazadaMotivoRaw: string
  salidaBobinas: string[]
  salidaMeta: BobinaLabelMeta[]
  mermaCalc: number
  mermaRaw: string
  metrajeRaw: string
  scrapTransparenteRaw: string
  scrapImpresoRaw: string
  scrapImpresoDestino: "auto" | "bopp" | "transparente"
  onSetScrapImpresoDestino: (v: "auto" | "bopp" | "transparente") => void
  devolucionBuena: number
  devolucionRechazada: number
  materialConsumido: number
  totalSalida: number
  refilPct: number
  formatTimerHms: (s: number) => string
  setPauseReason: (v: string) => void
  setPauseObs: (v: string) => void
  startProductionTimer: () => void
  pauseProductionTimer: () => void
  confirmPauseAndResume: () => void
  onSetTurno: (v: "diurno" | "nocturno") => void
  onSetGrupo: (v: "A" | "B" | "C") => void
  onActivePersonnelApply: (people: DraftPerson[]) => void
  onEntradaChange: (idx: number, v: string) => void
  onOpenEntradaLabel: (idx: number) => void
  onSetDevolucionBuena: (v: string) => void
  onSetDevolucionRechazada: (v: string) => void
  onSetDevolucionRechazadaMotivo: (v: string) => void
  warehouseReturn: PrintingWarehouseReturnPanelProps
  onSalidaChange: (idx: number, v: string) => void
  onOpenSalidaLabel: (idx: number) => void
  onSetMerma: (v: string) => void
  onSetMetraje: (v: string) => void
  onSetScrapTransparente: (v: string) => void
  onSetScrapImpreso: (v: string) => void
  labelEditorOpen: boolean
  labelEditorMode: LabelEditorMode
  labelEditorIndex: number
  labelEditorDraft: BobinaLabelMeta
  labelEditorError: string
  onLabelOpenChange: (open: boolean) => void
  onLabelDraftChange: (key: keyof BobinaLabelMeta, value: string) => void
  onLabelClear: () => void
  onLabelSave: () => void
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
  onFinalizarAreaImpresion: () => void | Promise<void>
  closedTurnos: PrintingTurnoEntry[]
  canPreviewTimerReport: boolean
  onPreviewTimerReport: () => void
  canPreviewDesperdicioReport: boolean
  onPreviewDesperdicioReport: () => void
  canResetAll: boolean
  onResetAll: () => void
  /** true si hay Kg de devolución anotados y no coinciden con el último envío a almacén registrado en UI */
  devolucionesPendienteAlmacen: boolean
}

function mesSectionTitle(icon: LucideIcon, text: string) {
  const I = icon
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <I className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  )
}

/** Texto de sección junto a grupos de controles (no es etiqueta de un solo campo). */
function fieldLegend(icon: LucideIcon, text: ReactNode) {
  const I = icon
  return (
    <div className="ot-label text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      <span className="inline-flex items-center gap-1.5">
        <I className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span>{text}</span>
      </span>
    </div>
  )
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
  return Object.values(meta).some((v) => v.trim() !== "")
}

function labelTooltipText(meta: BobinaLabelMeta | undefined): string {
  if (!meta || !hasMeta(meta)) return "Sin etiqueta registrada"
  const fecha = meta.fecha.trim() || "Sin fecha"
  const referencia = meta.referencia.trim() || "Sin referencia"
  return `Fecha: ${fecha} · Ref: ${referencia}`
}

export default function WorkOrderPrintingOpsSection(props: Props) {
  const [activeStageName, setActiveStageName] = useState("")
  const [activeStageRole, setActiveStageRole] = useState<DraftPersonRole>("operador")
  const activeSaved = useMemo(
    () => activePersonnelFromStrings(props.impOperador, props.impAyudante, props.impSupervisor),
    [props.impOperador, props.impAyudante, props.impSupervisor],
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

  function sectionHeaderExtras(isDone: boolean, actions?: ReactNode) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        {isDone ? (
          <div className="mes-badge-done">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Completo
          </div>
        ) : null}
        {actions ?? null}
      </div>
    )
  }

  /** Pedido de cliente cubierto por salida acumulada (no marcar “Completo” sin criterio). */
  const doneAcumulado =
    props.pedidoTotalKg > 0.01 && props.faltanteKg <= 0.01

  const autoInfoTurno =
    !!props.impOperador.trim() ||
    !!props.impAyudante.trim() ||
    !!props.impSupervisor.trim() ||
    !!props.impTurno.trim() ||
    !!props.impGrupo.trim()
  const doneInfoTurno = autoInfoTurno

  /** “Completo” solo cuando el cronómetro quedó detenido/cerrado (no mientras corre o está en pausa). */
  const doneTemporizador =
    props.areaFinalizada ||
    props.timerState === "completed" ||
    props.timerState === "stopped"

  const autoIngresoMaterial =
    props.entradaBobinas.some((v) => num(v) > 0) || props.entradaMeta.some((m) => hasMeta(m))
  const doneIngresoMaterial = autoIngresoMaterial

  const rechDev = num(props.devolucionRechazadaRaw)
  const buenaDev = num(props.devolucionBuenaRaw)
  const autoDevoluciones =
    (buenaDev > 0.01 || rechDev > 0.01) && (rechDev <= 0.01 || !!props.devolucionRechazadaMotivoRaw.trim())
  const doneDevoluciones = autoDevoluciones
  const motivoSelectDisabled = inputDisabled || rechDev <= 0.01

  const [motivoComboOpen, setMotivoComboOpen] = useState(false)
  const [buenaComboOpen, setBuenaComboOpen] = useState(false)
  const [rechComboOpen, setRechComboOpen] = useState(false)
  const [pauseParadaComboOpen, setPauseParadaComboOpen] = useState(false)
  const [cumulativeTurnosDialogOpen, setCumulativeTurnosDialogOpen] = useState(false)

  const formFieldId = useId().replace(/:/g, "")
  const mk = (suffix: string) => `${formFieldId}-${suffix}`

  const pauseParadaComboLabel = useMemo(() => {
    const r = props.pauseReason.trim()
    if (!r) return "Seleccionar motivo…"
    return r
  }, [props.pauseReason])

  const motivoComboLabel = useMemo(() => {
    if (motivoSelectDisabled) return "— (indique Kg rechazados primero)"
    const id = props.devolucionRechazadaMotivoRaw.trim()
    if (!id) return "Seleccione motivo (obligatorio si hay Kg rechazados)"
    return PRINTING_REJECT_REASONS.find((r) => r.id === id)?.label ?? id
  }, [motivoSelectDisabled, props.devolucionRechazadaMotivoRaw])

  const buenaMaterialSelected = useMemo(
    () =>
      props.warehouseReturn.materialOptionsGood.find(
        (m) => String(m.id) === props.warehouseReturn.draft.buenaMaterialId,
      ),
    [props.warehouseReturn.draft.buenaMaterialId, props.warehouseReturn.materialOptionsGood],
  )
  const rechMaterialSelected = useMemo(
    () =>
      props.warehouseReturn.materialOptionsBad.find(
        (m) => String(m.id) === props.warehouseReturn.draft.rechazadaMaterialId,
      ),
    [props.warehouseReturn.draft.rechazadaMaterialId, props.warehouseReturn.materialOptionsBad],
  )

  const autoSalidaBobina =
    props.salidaBobinas.some((v) => num(v) > 0) || props.salidaMeta.some((m) => hasMeta(m))
  const doneSalidaBobina = autoSalidaBobina

  const autoMermaMetraje = num(props.mermaRaw) > 0 || num(props.metrajeRaw) > 0
  const doneMermaMetraje = autoMermaMetraje

  const autoScrap = num(props.scrapTransparenteRaw) > 0 || num(props.scrapImpresoRaw) > 0
  const doneScrap = autoScrap

  const autoResumen =
    props.totalEntradaTurno > 0.01 ||
    props.totalSalida > 0.01 ||
    props.totalScrap > 0.01 ||
    props.devolucionBuena > 0.01 ||
    props.devolucionRechazada > 0.01
  const doneResumen = autoResumen

  const showPersonalTurnoSetup = !props.hasActiveTurno && !props.areaFinalizada

  const acumuladoOrdenSection = (
    <MesSectionShell
      title={mesSectionTitle(BarChart3, "Acumulado de la orden (todos los turnos)")}
      headerRight={sectionHeaderExtras(doneAcumulado)}
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
          <ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Total entrada acumulada:{" "}
            <strong>{props.totalEntradaAcumulada.toFixed(2)} Kg</strong>
          </span>
        </div>
        <div className="mes-footer-bar__item flex items-start gap-2">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Total scrap acumulado: <strong>{props.totalScrap.toFixed(2)} Kg</strong>
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
          <span className="font-semibold">Área de impresión finalizada.</span>{" "}
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
                          name="impDraftPersonName"
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
                      Debe guardar al menos un operador antes de pulsar <span className="font-semibold">Iniciar turno</span>{" "}
                      en esta misma sección.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex justify-center border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    onClick={props.onIniciarTurno}
                    disabled={props.readOnlyOps}
                    title="Abre el registro de turno de planta (no inicia el cronómetro de máquina)"
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
                    Salida {sumSalidaKg(t).toFixed(2)} Kg · Scrap {sumScrapKg(t).toFixed(2)} Kg · Tiempo efectivo{" "}
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
        headerRight={sectionHeaderExtras(doneInfoTurno)}
      >
        <p className="text-muted-foreground mb-3 border-b border-border/50 pb-3 text-xs leading-snug">
          Turno de planta (calendario y cuadrilla) y personal del registro actual. El{" "}
          <span className="font-semibold text-foreground">cronómetro</span> (tiempo efectivo y{" "}
          <span className="font-semibold text-foreground">paradas con motivo</span>) está en{" "}
          <span className="font-semibold text-foreground">Cronómetro de producción</span> más abajo. Para terminar esta
          sesión de registro use <span className="font-semibold text-foreground">Cerrar turno</span> en el cronómetro;{" "}
          <span className="font-semibold text-foreground">Finalizar OT</span> es otro paso (área / orden).
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            {fieldLegend(Clock, "Turno")}
            <div className="mes-toggle-row mes-toggle-turno">
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                value={props.impTurno}
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
                value={props.impGrupo}
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
                    name="impActivePersonName"
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
            <span className="font-semibold">no</span> cierra el turno de planta. Para cerrar la sesión de este
            registro use <span className="font-semibold">Cerrar turno</span>.{" "}
            <span className="font-semibold">Finalizar OT</span> es aparte (cierre en área / orden).
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
                      Borra turnos, cronómetro y checks para esta OT (Impresión)
                    </TooltipContent>
                  </Tooltip>
                </div>
                {props.hasActiveTurno ? (
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
                {props.canFinalizeOrder && !props.areaFinalizada ? (
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
                          onClick={() => void props.onFinalizarAreaImpresion()}
                          disabled={props.readOnlyOps && !props.canFinalizeOrder}
                        >
                          <Flag className="shrink-0" aria-hidden />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Cierra el área de impresión en la orden (paso de gestión). No sustituye a «Cerrar turno» ni a
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
        title={mesSectionTitle(Package, "Ingreso de material virgen")}
        subtle
        headerRight={sectionHeaderExtras(doneIngresoMaterial)}
        bodyClassName="mes-section__body--flush"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-9">
          {props.entradaBobinas.map((val, idx) => (
            <div key={`ent-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={mk(`entrada-bobina-${idx}`)} className="ot-label">
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
                        variant={hasMeta(props.entradaMeta[idx]) ? "default" : "outline"}
                        className="h-5 w-5"
                        onClick={() => props.onOpenEntradaLabel(idx)}
                        disabled={inputDisabled}
                        title={`Etiqueta bobina de entrada #${idx + 1}`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {labelTooltipText(props.entradaMeta[idx])}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id={mk(`entrada-bobina-${idx}`)}
                name={`impEntradaBobinaKg_${idx + 1}`}
                className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                inputMode="decimal"
                value={val}
                onChange={(e) => props.onEntradaChange(idx, e.target.value)}
                placeholder="0"
                disabled={inputDisabled}
              />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <MesStatTile
            label="Total entrada"
            value={`${props.totalEntradaTurno.toFixed(2)} Kg`}
            icon={<Weight className="h-3.5 w-3.5" />}
          />
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Undo2, "Devoluciones de bobina")}
        subtle
        headerRight={sectionHeaderExtras(doneDevoluciones)}
      >
        {props.devolucionesPendienteAlmacen ? (
          <div className="-mt-1 mb-2 space-y-1.5">
            <span className="inline-flex items-center rounded-full border border-amber-500/80 bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950">
              Pendiente de registrar en almacén
            </span>
            <p className="text-[11px] leading-snug text-amber-950/90 dark:text-amber-100/90">
              El formulario de envío se abre solo en este caso: elija materiales y pulse{" "}
              <span className="font-semibold">Enviar a almacén</span>.
            </p>
          </div>
        ) : null}
        <p className="text-muted-foreground mb-3 text-[11px] leading-snug">
          Capture kilos y motivo aquí; el resumen de producción usa los mismos valores. Al enviar, las filas aparecen
          en{" "}
          <Link to="/devoluciones" className="font-medium text-primary underline underline-offset-2">
            Inventario → Devoluciones
          </Link>{" "}
          (Pendientes hasta que almacén acepte). La parte <span className="font-medium text-foreground">rechazada</span>{" "}
          genera además una bobina en <span className="font-medium text-foreground">Inventario → Bobinas</span>.
        </p>

        <Collapsible
          open={props.warehouseReturn.open}
          onOpenChange={props.warehouseReturn.onOpenChange}
          className="mt-1"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              disabled={inputDisabled || props.warehouseReturn.submitting}
              className={cn(
                "group flex w-full items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5 text-left text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/35",
                (inputDisabled || props.warehouseReturn.submitting) && "pointer-events-none opacity-50",
              )}
            >
              <span className="inline-flex min-w-0 flex-1 items-center gap-2">
                <Warehouse className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                <span className="min-w-0 truncate">
                  Devolución del turno (impresión → almacén): kilos, motivo y materiales
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  props.warehouseReturn.open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 space-y-4 rounded-xl border border-border/70 bg-card/40 p-3 shadow-inner sm:p-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs">
                <span className="text-muted-foreground">Orden</span>
                <span className="font-mono font-semibold text-foreground">{props.warehouseReturn.workOrderCode}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Impresión → Almacén</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-emerald-200/70 bg-emerald-50/25 p-3 dark:bg-emerald-950/15">
                  {fieldLabel(mk("devolucion-buena-kg"), PackageCheck, "Devolución buena (Kg)")}
                  <Input
                    id={mk("devolucion-buena-kg")}
                    name="impDevolucionBuenaKg"
                    className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                    inputMode="decimal"
                    value={props.devolucionBuenaRaw}
                    onChange={(e) => props.onSetDevolucionBuena(e.target.value)}
                    placeholder="0"
                    disabled={inputDisabled}
                  />
                  <p className="text-muted-foreground text-[11px]">Material apto para reingreso a inventario.</p>
                </div>
                <div className="space-y-2 rounded-lg border border-rose-200/70 bg-rose-50/25 p-3 dark:bg-rose-950/15">
                  {fieldLabel(mk("devolucion-rechazada-kg"), PackageX, "Devolución rechazada (Kg)")}
                  <Input
                    id={mk("devolucion-rechazada-kg")}
                    name="impDevolucionRechazadaKg"
                    className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                    inputMode="decimal"
                    value={props.devolucionRechazadaRaw}
                    onChange={(e) => props.onSetDevolucionRechazada(e.target.value)}
                    placeholder="0"
                    disabled={inputDisabled}
                  />
                  <p className="text-muted-foreground text-[11px]">Queda en bobinas rechazadas; indique motivo abajo.</p>
                </div>
              </div>

              <div className="space-y-1">
                {fieldLabel(mk("devolucion-rechazada-motivo"), FileSearch, "Motivo (devolución rechazada)")}
                <Popover
                  open={motivoComboOpen && !motivoSelectDisabled}
                  onOpenChange={(o) => {
                    if (!motivoSelectDisabled) setMotivoComboOpen(o)
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      id={mk("devolucion-rechazada-motivo")}
                      name="impDevolucionRechazadaMotivo"
                      variant="outline"
                      role="combobox"
                      aria-expanded={motivoComboOpen && !motivoSelectDisabled}
                      disabled={motivoSelectDisabled}
                      className={cn(
                        "h-9 w-full justify-between gap-2 rounded-md border border-input bg-white px-3 font-normal shadow-sm dark:bg-white dark:text-slate-900",
                        motivoSelectDisabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-left text-sm",
                          (motivoSelectDisabled || !props.devolucionRechazadaMotivoRaw.trim()) &&
                            "text-muted-foreground",
                        )}
                      >
                        {motivoComboLabel}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
                    <Command>
                      <CommandList className="max-h-60">
                        <CommandGroup>
                          <CommandItem
                            value="limpiar motivo devolucion"
                            onSelect={() => {
                              props.onSetDevolucionRechazadaMotivo("")
                              setMotivoComboOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                !props.devolucionRechazadaMotivoRaw.trim() ? "opacity-100" : "opacity-0",
                              )}
                              aria-hidden
                            />
                            <span className="text-muted-foreground">— (sin motivo)</span>
                          </CommandItem>
                          {PRINTING_REJECT_REASONS.map((r) => (
                            <CommandItem
                              key={r.id}
                              value={`${r.id} ${r.label}`}
                              onSelect={() => {
                                props.onSetDevolucionRechazadaMotivo(r.id)
                                setMotivoComboOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0",
                                  r.id === props.devolucionRechazadaMotivoRaw.trim()
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                                aria-hidden
                              />
                              {r.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={mk("warehouse-bobina-ref")} className="ot-label">
                    Bobina / referencia
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Opcional</span>
                </div>
                <Input
                  id={mk("warehouse-bobina-ref")}
                  name="impWarehouseBobinaRef"
                  className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                  value={props.warehouseReturn.draft.bobinaCode}
                  onChange={(e) => props.warehouseReturn.onDraftChange({ bobinaCode: e.target.value })}
                  placeholder="Código de bobina, etiqueta o lote"
                  disabled={inputDisabled}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-300/60 bg-gradient-to-b from-emerald-50/80 to-background p-3 dark:border-emerald-800/50 dark:from-emerald-950/35">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Buena</span>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/50 bg-emerald-600 text-[10px] text-white hover:bg-emerald-600"
                    >
                      Reingreso inventario
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor={mk("warehouse-material-buena")} className="text-xs text-emerald-900/90 dark:text-emerald-200/90">
                        Material (área material)
                      </Label>
                      <Popover
                        open={buenaComboOpen}
                        onOpenChange={(o) => {
                          setBuenaComboOpen(o)
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            id={mk("warehouse-material-buena")}
                            name="impWarehouseMaterialBuena"
                            variant="outline"
                            role="combobox"
                            aria-expanded={buenaComboOpen}
                            disabled={inputDisabled || props.warehouseReturn.loadingGood}
                            className="h-9 w-full justify-between gap-2 rounded-md border border-emerald-200/80 bg-white px-3 font-normal shadow-sm dark:bg-white dark:text-slate-900"
                          >
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-left text-sm",
                                !buenaMaterialSelected && "text-muted-foreground",
                              )}
                            >
                              {props.warehouseReturn.loadingGood
                                ? "Cargando…"
                                : buenaMaterialSelected
                                  ? `${buenaMaterialSelected.sku} · ${buenaMaterialSelected.name}`
                                  : "Seleccione material"}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                          <Command shouldFilter>
                            <CommandInput placeholder="Buscar por SKU o nombre…" />
                            <CommandList className="max-h-60">
                              <CommandEmpty>Sin coincidencias.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="limpiar material buena"
                                  onSelect={() => {
                                    props.warehouseReturn.onDraftChange({ buenaMaterialId: "" })
                                    setBuenaComboOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      !props.warehouseReturn.draft.buenaMaterialId ? "opacity-100" : "opacity-0",
                                    )}
                                    aria-hidden
                                  />
                                  <span className="text-muted-foreground">— (sin material)</span>
                                </CommandItem>
                                {props.warehouseReturn.materialOptionsGood.map((m) => (
                                  <CommandItem
                                    key={m.id}
                                    value={`${m.id} ${m.sku} ${m.name}`}
                                    onSelect={() => {
                                      props.warehouseReturn.onDraftChange({ buenaMaterialId: String(m.id) })
                                      setBuenaComboOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 shrink-0",
                                        String(m.id) === props.warehouseReturn.draft.buenaMaterialId
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                      aria-hidden
                                    />
                                    <span className="min-w-0 truncate">
                                      {m.sku} · {m.name}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-300/60 bg-gradient-to-b from-rose-50/80 to-background p-3 dark:border-rose-800/50 dark:from-rose-950/35">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-rose-900 dark:text-rose-200">Rechazada</span>
                    <Badge variant="destructive" className="text-[10px]">
                      Bobinas rechazadas
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor={mk("warehouse-material-rechazada")} className="text-xs text-rose-900/90 dark:text-rose-200/90">
                        Material (rechazadas)
                      </Label>
                      <Popover
                        open={rechComboOpen}
                        onOpenChange={(o) => {
                          setRechComboOpen(o)
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            id={mk("warehouse-material-rechazada")}
                            name="impWarehouseMaterialRechazada"
                            variant="outline"
                            role="combobox"
                            aria-expanded={rechComboOpen}
                            disabled={inputDisabled || props.warehouseReturn.loadingBad}
                            className="h-9 w-full justify-between gap-2 rounded-md border border-rose-200/80 bg-white px-3 font-normal shadow-sm dark:bg-white dark:text-slate-900"
                          >
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-left text-sm",
                                !rechMaterialSelected && "text-muted-foreground",
                              )}
                            >
                              {props.warehouseReturn.loadingBad
                                ? "Cargando…"
                                : rechMaterialSelected
                                  ? `${rechMaterialSelected.sku} · ${rechMaterialSelected.name}`
                                  : "Seleccione material"}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                          <Command shouldFilter>
                            <CommandInput placeholder="Buscar por SKU o nombre…" />
                            <CommandList className="max-h-60">
                              <CommandEmpty>Sin coincidencias.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="limpiar material rechazada"
                                  onSelect={() => {
                                    props.warehouseReturn.onDraftChange({ rechazadaMaterialId: "" })
                                    setRechComboOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      !props.warehouseReturn.draft.rechazadaMaterialId ? "opacity-100" : "opacity-0",
                                    )}
                                    aria-hidden
                                  />
                                  <span className="text-muted-foreground">— (sin material)</span>
                                </CommandItem>
                                {props.warehouseReturn.materialOptionsBad.map((m) => (
                                  <CommandItem
                                    key={m.id}
                                    value={`${m.id} ${m.sku} ${m.name}`}
                                    onSelect={() => {
                                      props.warehouseReturn.onDraftChange({ rechazadaMaterialId: String(m.id) })
                                      setRechComboOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 shrink-0",
                                        String(m.id) === props.warehouseReturn.draft.rechazadaMaterialId
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                      aria-hidden
                                    />
                                    <span className="min-w-0 truncate">
                                      {m.sku} · {m.name}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={mk("warehouse-rechazada-obs")} className="text-xs text-rose-900/90 dark:text-rose-200/90">
                        Observación (opcional)
                      </Label>
                      <Textarea
                        id={mk("warehouse-rechazada-obs")}
                        name="impWarehouseRechazadaObs"
                        className="min-h-[72px] bg-white text-sm dark:bg-white dark:text-slate-900"
                        value={props.warehouseReturn.draft.rechazadaObs}
                        onChange={(e) =>
                          props.warehouseReturn.onDraftChange({ rechazadaObs: e.target.value })
                        }
                        placeholder="Detalle adicional (si aplica)"
                        disabled={inputDisabled}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-36"
                  onClick={() => props.warehouseReturn.onOpenChange(false)}
                  disabled={props.warehouseReturn.submitting}
                >
                  Cerrar panel
                </Button>
                <Button
                  type="button"
                  className="sm:min-w-48"
                  onClick={() => void props.warehouseReturn.onSubmit()}
                  disabled={inputDisabled || props.warehouseReturn.submitting}
                >
                  {props.warehouseReturn.submitting ? "Enviando…" : "Enviar a almacén"}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PackageSearch, "Proceso — salida bobina impresa")}
        subtle
        headerRight={sectionHeaderExtras(doneSalidaBobina)}
        bodyClassName="mes-section__body--flush"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {props.salidaBobinas.map((val, idx) => (
            <div key={`sal-${idx}`} className="space-y-1">
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
                        title={`Etiqueta bobina de salida #${idx + 1}`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {labelTooltipText(props.salidaMeta[idx])}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id={mk(`salida-bobina-${idx}`)}
                name={`impSalidaBobinaKg_${idx + 1}`}
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
        <div className="mt-2 mes-stat-grid mes-stat-grid--4">
          <MesStatTile
            label="N° bobinas"
            value={props.salidaBobinas.filter((v) => Number(v) > 0).length}
            icon={<Hash className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Peso total"
            value={`${props.totalSalida.toFixed(2)} Kg`}
            icon={<Weight className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Merma calculada"
            value={`${props.mermaCalc.toFixed(2)} Kg`}
            icon={<TrendingDown className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="% Refil"
            value={`${props.refilPct.toFixed(2)}%`}
            icon={<Percent className="h-3.5 w-3.5" />}
          />
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Ruler, "Merma y metraje")}
        subtle
        headerRight={sectionHeaderExtras(doneMermaMetraje)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border bg-background p-2 text-sm">
            <Label
              htmlFor={mk("merma-turno")}
              className="inline-flex items-center gap-1.5 text-muted-foreground"
            >
              <TrendingDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Merma
            </Label>
            <Input
              id={mk("merma-turno")}
              name="impMermaKg"
              className="ot-input-unified mt-1 h-9 bg-white dark:bg-white dark:text-slate-900"
              inputMode="decimal"
              value={props.mermaRaw}
              onChange={(e) => props.onSetMerma(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
            <div className="mt-1 text-[11px] text-muted-foreground">
              Calculada: <span className="font-semibold text-foreground">{props.mermaCalc.toFixed(2)} Kg</span>
            </div>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <Label
              htmlFor={mk("metraje-turno")}
              className="inline-flex items-center gap-1.5 text-muted-foreground"
            >
              <Ruler className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Metraje
            </Label>
            <Input
              id={mk("metraje-turno")}
              name="impMetrajeM"
              className="ot-input-unified mt-1 h-9 bg-white dark:bg-white dark:text-slate-900"
              inputMode="decimal"
              value={props.metrajeRaw}
              onChange={(e) => props.onSetMetraje(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Recycle, "Scrap del turno (Kg)")}
        subtle
        headerRight={sectionHeaderExtras(doneScrap)}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            {fieldLabel(mk("scrap-transparente"), Layers, "Transparente")}
            <Input
              id={mk("scrap-transparente")}
              name="impScrapTransparenteKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.scrapTransparenteRaw}
              onChange={(e) => props.onSetScrapTransparente(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
          </div>
          <div className="space-y-2">
            {fieldLabel(mk("scrap-impreso"), Printer, "Impreso")}
            <Input
              id={mk("scrap-impreso")}
              name="impScrapImpresoKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.scrapImpresoRaw}
              onChange={(e) => props.onSetScrapImpreso(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
              <div className="space-y-1">
              <p className="inline-flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Warehouse className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                <span>Inventario destino (reporte desperdicio)</span>
              </p>
              <div className="mes-toggle-row">
              <ToggleGroup
                type="single"
                className="flex flex-wrap justify-start gap-1"
                value={props.scrapImpresoDestino}
                onValueChange={(v) => {
                  if (!v) return
                  props.onSetScrapImpresoDestino(v as "auto" | "bopp" | "transparente")
                }}
                disabled={inputDisabled}
              >
                <ToggleGroupItem value="auto" className="text-xs">
                  Auto
                </ToggleGroupItem>
                <ToggleGroupItem value="bopp" className="text-xs">
                  BOPP
                </ToggleGroupItem>
                <ToggleGroupItem value="transparente" className="text-xs">
                  Transparente
                </ToggleGroupItem>
              </ToggleGroup>
              </div>
              <p className="text-muted-foreground text-[11px] leading-snug">
                Auto asigna el destino del impreso según la estructura del producto en la OT (reporte de desperdicio).
              </p>
            </div>
          </div>
          <MesStatTile
            label="Total scrap"
            value={`${props.totalScrap.toFixed(2)} Kg`}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PieChart, "Resumen de producción")}
        subtle
        headerRight={sectionHeaderExtras(doneResumen, (
          <Button
            type="button"
            variant="outline"
            className="border-slate-400 text-slate-800 hover:bg-slate-100"
            onClick={props.onPreviewDesperdicioReport}
            disabled={!props.canPreviewDesperdicioReport}
            title={
              props.canPreviewDesperdicioReport
                ? "Vista previa del reporte de desperdicio"
                : "Active un turno para habilitar la vista previa"
            }
          >
            <FileSearch className="mr-1 h-4 w-4 shrink-0" aria-hidden />
            Vista previa desperdicio
          </Button>
        ))}
      >
        <div className="mes-stat-grid sm:grid-cols-2">
          <MesStatTile
            label="Total material entrada"
            value={`${props.totalEntradaTurno.toFixed(2)} Kg`}
            icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Devolución buena"
            value={`${props.devolucionBuena.toFixed(2)} Kg`}
            icon={<PackageCheck className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Devolución rechazada"
            value={`${props.devolucionRechazada.toFixed(2)} Kg`}
            icon={<PackageX className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Material consumido"
            value={`${props.materialConsumido.toFixed(2)} Kg`}
            icon={<Boxes className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Total salida"
            value={`${props.totalSalida.toFixed(2)} Kg`}
            icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Total scrap"
            value={`${props.totalScrap.toFixed(2)} Kg`}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Merma calculada"
            value={`${props.mermaCalc.toFixed(2)} Kg`}
            icon={<TrendingDown className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="% Refil"
            value={`${props.refilPct.toFixed(2)}%`}
            icon={<Percent className="h-3.5 w-3.5" />}
          />
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
                    name="impPauseMotivo"
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
                name="impPauseObs"
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

      <Dialog open={props.labelEditorOpen} onOpenChange={props.onLabelOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Etiqueta bobina de {props.labelEditorMode === "entrada" ? "Entrada" : "Salida"} #{props.labelEditorIndex + 1}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={mk("label-fecha")}>Fecha bobina</Label>
              <Input
                id={mk("label-fecha")}
                name="impLabelFecha"
                value={props.labelEditorDraft.fecha}
                onChange={(e) => props.onLabelDraftChange("fecha", e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-hora")}>Hora</Label>
              <Input
                id={mk("label-hora")}
                name="impLabelHora"
                value={props.labelEditorDraft.hora}
                onChange={(e) => props.onLabelDraftChange("hora", e.target.value)}
                placeholder="--:--"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-referencia")}>Referencia Bobina</Label>
              <Input
                id={mk("label-referencia")}
                name="impLabelReferencia"
                value={props.labelEditorDraft.referencia}
                onChange={(e) => props.onLabelDraftChange("referencia", e.target.value)}
                placeholder="Ref. o lote"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-pedido-lote")}>Pedido / Lote</Label>
              <Input
                id={mk("label-pedido-lote")}
                name="impLabelPedidoLote"
                value={props.labelEditorDraft.pedido_lote}
                onChange={(e) => props.onLabelDraftChange("pedido_lote", e.target.value)}
                placeholder="N° pedido o lote"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-proveedor")}>Proveedor</Label>
              <Input
                id={mk("label-proveedor")}
                name="impLabelProveedor"
                value={props.labelEditorDraft.proveedor}
                onChange={(e) => props.onLabelDraftChange("proveedor", e.target.value)}
                placeholder="Nombre proveedor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-operador")}>Operador</Label>
              <Input
                id={mk("label-operador")}
                name="impLabelOperador"
                value={props.labelEditorDraft.operador}
                onChange={(e) => props.onLabelDraftChange("operador", e.target.value)}
                placeholder="Nombre operador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-peso")}>Peso (Kg)</Label>
              <Input
                id={mk("label-peso")}
                name="impLabelPeso"
                value={props.labelEditorDraft.peso}
                onChange={(e) => props.onLabelDraftChange("peso", e.target.value)}
                placeholder="Ej: 120"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-metraje")}>Metraje</Label>
              <Input
                id={mk("label-metraje")}
                name="impLabelMetraje"
                value={props.labelEditorDraft.metraje}
                onChange={(e) => props.onLabelDraftChange("metraje", e.target.value)}
                placeholder="Metros"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-medida-ancho")}>Medida / Ancho (mm)</Label>
              <Input
                id={mk("label-medida-ancho")}
                name="impLabelMedidaAncho"
                value={props.labelEditorDraft.medida_ancho}
                onChange={(e) => props.onLabelDraftChange("medida_ancho", e.target.value)}
                placeholder="Ej: 610"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-maquina-origen")}>Máquina origen</Label>
              <Input
                id={mk("label-maquina-origen")}
                name="impLabelMaquinaOrigen"
                value={props.labelEditorDraft.maquina_origen}
                onChange={(e) => props.onLabelDraftChange("maquina_origen", e.target.value)}
                placeholder="Máquina"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-trat-int")}>Tratamiento interno</Label>
              <Input
                id={mk("label-trat-int")}
                name="impLabelTratamientoInterno"
                value={props.labelEditorDraft.tratamiento_interno}
                onChange={(e) => props.onLabelDraftChange("tratamiento_interno", e.target.value)}
                placeholder="Dinas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={mk("label-trat-ext")}>Tratamiento externo</Label>
              <Input
                id={mk("label-trat-ext")}
                name="impLabelTratamientoExterno"
                value={props.labelEditorDraft.tratamiento_externo}
                onChange={(e) => props.onLabelDraftChange("tratamiento_externo", e.target.value)}
                placeholder="Dinas"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={mk("label-lote")}>Lote</Label>
              <Input
                id={mk("label-lote")}
                name="impLabelLote"
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
            <Button type="button" variant="outline" onClick={props.onLabelClear}>Limpiar</Button>
            <Button type="button" onClick={props.onLabelSave}>Guardar etiqueta</Button>
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
                  {turnoGrupoLabel(props.impTurno, props.impGrupo)}
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
                    const people = personnelLinesFromPrintingTurno(t)
                    return (
                      <li key={t.id} className="rounded-md border bg-background p-3 text-xs">
                        <p className="font-medium text-foreground">
                          {t.closed_at
                            ? new Date(t.closed_at).toLocaleString("es-VE")
                            : "Sin fecha de cierre"}{" "}
                          · {turnoGrupoLabel(t.turno, t.grupo)}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          Salida {sumSalidaKg(t).toFixed(2)} Kg · Scrap {sumScrapKg(t).toFixed(2)} Kg · Efectivo{" "}
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
