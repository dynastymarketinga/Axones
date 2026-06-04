import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import {
  AlarmClock,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleCheck,
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
  Link2,
  LogOut,
  Moon,
  NotebookPen,
  Package,
  PackageCheck,
  PackageSearch,
  PackageX,
  PieChart,
  Plus,
  Printer,
  Recycle,
  Sun,
  Timer,
  Trash2,
  Truck,
  Undo2,
  UserPlus,
  UserRound,
  Users,
  Warehouse,
  Weight,
} from "lucide-react"

import {
  fieldLegend,
  MesSectionHeaderExtras,
  MesSectionShell,
  MesStatTile,
  mesSectionTitle,
} from "@/components/axones/mes"
import { MesBobinaKgSlotCell } from "@/components/axones/MesBobinaKgSlotCell"

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
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { normalizeScrapSubstrate, SCRAP_POLIETILENO } from "@/lib/scrap-substrate"
import type { MaterialRow, SupplierRecord } from "@/types/api"

import { sanitizePositiveDecimalInput } from "./purchase-document-form-ui"

import {
  allRejectedEntriesHaveMotivo,
  hasSalidaBobinaMeta,
  PRINTING_REJECT_REASONS,
  salidaBobinaLabelTooltipText,
  isBobinaKgSlotFilled,
  sumRejectedEntryBobinas,
  sumRejectedEntryKg,
  sumSalidaKg,
  sumScrapKg,
  type BobinaLabelMeta,
  type PrintingTurnoEntry,
  type WarehouseRejectedEntry,
  type WarehouseReturnDraft,
} from "./printing-turnos"
import {
  personnelLinesFromPrintingTurno,
  PrintingLastClosedReadonlyPanel,
  PrintingTurnoHistorialItem,
  PrintingTurnosHistorialSection,
} from "./printing-shift-history"
import {
  materialSpecificationsLabel,
  rejectReasonLabel,
  todayIsoDate,
} from "./warehouse-return-helpers"

export type { BobinaLabelMeta, WarehouseReturnDraft }

export type PrintingWarehouseReturnPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderCode: string
  draft: WarehouseReturnDraft
  onDraftChange: (patch: Partial<WarehouseReturnDraft>) => void
  onRejectedEntryChange: (id: string, patch: Partial<WarehouseRejectedEntry>) => void
  onAddRejectedEntry: () => void
  onRemoveRejectedEntry: (id: string) => void
  materialOptionsGood: MaterialRow[]
  materialOptionsBad: MaterialRow[]
  supplierOptions: SupplierRecord[]
  loadingGood: boolean
  loadingBad: boolean
  loadingSuppliers: boolean
  submitting: boolean
  onSubmit: () => void | Promise<void>
}

type PrintingPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

type LabelEditorMode = "entrada" | "salida"
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
  /** Desperdicio acumulado de la OT (todos los turnos). */
  totalScrapAcumulado: number
  ultimoTurnoLabel: string
  timerState: string
  totalSec: number
  deadSec: number
  effectiveSec: number
  /** Si true, effectiveSec/deadSec/totalSec son acumulado OT (todos los turnos). */
  timerShowsOtAccumulated?: boolean
  kgHora: string
  horaArranque: string
  demountSec: number
  arranqueRunning?: boolean
  demountRunning?: boolean
  timerRunning: boolean
  timerPaused: boolean
  timerActionFlags?: import("./mes-timer-actions").MesTimerActionFlags
  onRequestTimerConfirm?: (key: import("./mes-timer-actions").MesTimerConfirmKey) => void
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
  scrapTransparenteRaw: string
  scrapImpresoRaw: string
  scrapImpresoDestinoRaw: string
  onSetScrapImpresoDestino: (v: string) => void
  devolucionBuena: number
  devolucionRechazadaKg: number
  devolucionRechazada: number
  totalSalida: number
  formatTimerHms: (s: number) => string
  setPauseReason: (v: string) => void
  setPauseObs: (v: string) => void
  startProductionTimer?: () => void
  pauseProductionTimer?: () => void
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
  /** Último turno cerrado (entre turnos, solo lectura). */
  lastClosedTurno: PrintingTurnoEntry | null
  canPreviewTimerReport: boolean
  onPreviewTimerReport: () => void
  canPreviewDesperdicioReport: boolean
  onPreviewDesperdicioReport: () => void
  canPreviewPlanillaReport: boolean
  onPreviewPlanillaReport: () => void
  /** Vista piso: solo play / parada / vista previa en el cronómetro. */
  simplifiedTimerActions?: boolean
  /** true si hay Kg de devolución anotados y no coinciden con el último envío a almacén registrado en UI */
  devolucionesPendienteAlmacen: boolean
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

const BOBINA_LABEL_INPUT_CLASS = "ot-input-unified h-10 bg-background shadow-sm"

function parseBobinaLabelFecha(value: string): Date | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return undefined
  const [, day, month, year] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return undefined
  }
  return parsed
}

function formatBobinaLabelFecha(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = String(date.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function bobinaLabelFechaDisplay(value: string): string {
  const trimmed = value.trim()
  return parseBobinaLabelFecha(trimmed) ? trimmed : "Seleccionar fecha"
}

function parseIsoDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return undefined
  }
  return parsed
}

function formatIsoDate(date: Date): string {
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function isoDateDisplay(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return "Seleccionar fecha"
  const dd = String(parsed.getDate()).padStart(2, "0")
  const mm = String(parsed.getMonth() + 1).padStart(2, "0")
  const yyyy = String(parsed.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function isRejectedFieldComboOpen(
  open: { entryId: string } | null,
  entryId: string,
): boolean {
  return open?.entryId === entryId
}

function BobinaLabelSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-primary/10 bg-gradient-to-b from-muted/30 to-muted/10 p-4 shadow-sm">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-primary/75">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function BobinaLabelField({
  id,
  label,
  icon: Icon,
  className,
  children,
}: {
  id: string
  label: string
  icon: LucideIcon
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
        {label}
      </Label>
      {children}
    </div>
  )
}

export default function WorkOrderPrintingOpsSection(props: Props) {
  const simplifiedTimer = props.simplifiedTimerActions !== false
  const [activeStageName, setActiveStageName] = useState("")
  const [activeStageRole, setActiveStageRole] = useState<DraftPersonRole>("operador")
  const [openRejectedCombo, setOpenRejectedCombo] = useState<{
    entryId: string
  } | null>(null)
  const [openRejectedDatePicker, setOpenRejectedDatePicker] = useState<{
    entryId: string
    field: "fechaBobina" | "creadaFecha"
  } | null>(null)
  const [buenaComboOpen, setBuenaComboOpen] = useState(false)
  const [pauseParadaComboOpen, setPauseParadaComboOpen] = useState(false)
  const [cumulativeTurnosDialogOpen, setCumulativeTurnosDialogOpen] = useState(false)
  const [labelFechaPickerOpen, setLabelFechaPickerOpen] = useState(false)
  const [draftPeoplePage, setDraftPeoplePage] = useState(1)
  const [draftPeopleQuery, setDraftPeopleQuery] = useState("")

  useEffect(() => {
    if (!props.labelEditorOpen) setLabelFechaPickerOpen(false)
  }, [props.labelEditorOpen])

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

  const rechKgFromEntries = sumRejectedEntryKg(props.warehouseReturn.draft.rechazadaEntries)
  const rechKg =
    rechKgFromEntries > 0 ? rechKgFromEntries : Math.max(0, props.devolucionRechazadaKg)
  const rechBobinasFromEntries = sumRejectedEntryBobinas(props.warehouseReturn.draft.rechazadaEntries)
  const rechBobinas =
    rechBobinasFromEntries > 0
      ? rechBobinasFromEntries
      : Math.max(0, Math.floor(num(props.devolucionRechazadaRaw)))
  const buenaDev = num(props.devolucionBuenaRaw)
  const autoDevoluciones =
    (buenaDev > 0.01 || rechKg > 0) &&
    (rechKg <= 0 || allRejectedEntriesHaveMotivo(props.warehouseReturn.draft.rechazadaEntries))
  const doneDevoluciones = autoDevoluciones

  const formFieldId = useId().replace(/:/g, "")
  const mk = (suffix: string) => `${formFieldId}-${suffix}`

  const pauseParadaComboLabel = useMemo(() => {
    const r = props.pauseReason.trim()
    if (!r) return "Seleccionar motivo…"
    return r
  }, [props.pauseReason])

  const buenaMaterialSelected = useMemo(
    () =>
      props.warehouseReturn.materialOptionsGood.find(
        (m) => String(m.id) === props.warehouseReturn.draft.buenaMaterialId,
      ),
    [props.warehouseReturn.draft.buenaMaterialId, props.warehouseReturn.materialOptionsGood],
  )

  function rejectedMotivoLabel(entry: WarehouseRejectedEntry): string {
    const kg = num(entry.kg)
    if (inputDisabled || kg <= 0) return "— (indique kilos rechazados primero)"
    const id = entry.motivo.trim()
    if (!id) return "Seleccione motivo (obligatorio)"
    return rejectReasonLabel(id)
  }

  const autoSalidaBobina =
    props.salidaBobinas.some((v) => num(v) > 0) || props.salidaMeta.some((m) => hasSalidaBobinaMeta(m))
  const doneSalidaBobina = autoSalidaBobina

  const autoScrap = num(props.scrapTransparenteRaw) > 0 || num(props.scrapImpresoRaw) > 0
  const doneScrap = autoScrap
  const turnScrapKg = num(props.scrapTransparenteRaw) + num(props.scrapImpresoRaw)

  const autoResumen =
    props.totalEntradaTurno > 0.01 ||
    props.totalSalida > 0.01 ||
    turnScrapKg > 0.01 ||
    props.devolucionBuena > 0.01 ||
    props.devolucionRechazadaKg > 0.01
  const doneResumen = autoResumen

  const showPersonalTurnoSetup = !props.hasActiveTurno && !props.areaFinalizada
  const visibleTurno = props.hasActiveTurno ? null : props.lastClosedTurno
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
      headerRight={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {props.onPreviewPlanillaReport ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-primary/25 text-xs"
              disabled={!props.canPreviewPlanillaReport}
              title={
                props.canPreviewPlanillaReport
                  ? "Vista previa de la planilla física de impresión"
                  : "Disponible tras «Finalizar área de impresión»"
              }
              onClick={props.onPreviewPlanillaReport}
            >
              <FileSearch className="h-3.5 w-3.5" aria-hidden />
              Vista previa planilla
            </Button>
          ) : null}
          <MesSectionHeaderExtras isDone={doneAcumulado} />
        </div>
      }
    >
      <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
        <strong className="text-foreground">Producido</strong> suma los kg de «Proceso — salida bobina impresa»
        (rejilla 1–30 y «Peso total») de todos los turnos cerrados más el turno en curso. No usa desperdicio,
        «Ingreso de material virgen», ni los «Kg salida» de la planilla de arriba (solo especificación de la OT).
        Cierre el turno con <strong className="text-foreground">Guardar</strong> o{" "}
        <strong className="text-foreground">Fin del turno</strong> (cronómetro iniciado) para que cuente en la
        bandeja.
      </p>
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
            Total desperdicio acumulado: <strong>{props.totalScrapAcumulado.toFixed(2)} Kg</strong>
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
          <span className="font-semibold">Área de impresión finalizada.</span>{" "}
          {props.canFinalizeOrder
            ? "Puede revisar datos guardados. Use Guardar si realiza correcciones."
            : "Solo personal autorizado puede reabrir o corregir desde otro rol."}
        </div>
      ) : null}

      <div className="space-y-4">
        {acumuladoOrdenSection}
        <PrintingTurnosHistorialSection
          cerrados={props.closedTurnos}
          formatTimerHms={props.formatTimerHms}
          expandLatest={!props.hasActiveTurno}
        />
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
                          name="impDraftPersonName"
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

                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        className="montaje-save-person-btn h-12 w-full max-w-xs gap-2 text-base font-semibold sm:w-auto sm:min-w-[12rem] sm:shrink-0"
                        onClick={() =>
                          props.onDraftPersonGuardar(props.draftStagingName, props.draftStagingRole)
                        }
                        disabled={props.readOnlyOps}
                      >
                        <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
                        Guardar persona
                      </Button>
                    </div>
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
              </div>
            </MesSectionShell>
          </div>

          <div className="col-span-1 flex justify-center border-t border-border/60 pt-5 xl:col-span-2">
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
      ) : null}

      {props.hasActiveTurno || visibleTurno ? (
      <MesSectionShell
        title={mesSectionTitle(ClipboardList, "Información del turno")}
        headerRight={<MesSectionHeaderExtras isDone={doneInfoTurno} />}
      >
        {props.hasActiveTurno ? (
        <>
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
          {simplifiedTimer && props.hasActiveTurno && !props.areaFinalizada ? (
            <div className="mt-4 border-t border-border/50 pt-4">
              <p className="text-muted-foreground text-xs leading-snug">
                El cierre del turno se realiza con{" "}
                <span className="font-semibold text-foreground">Guardar</span> o Terminar turno de planta en el panel del cronómetro.
              </p>
            </div>
          ) : null}
        </div>
        </>
        ) : visibleTurno ? (
          <PrintingLastClosedReadonlyPanel
            turno={visibleTurno}
            formatTimerHms={props.formatTimerHms}
          />
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
            {simplifiedTimer && props.timerActionFlags ? MES_TIMER_HELP_TEXT : (
              <>
                <span className="font-semibold">Cronómetro (máquina):</span> cuenta tiempo efectivo y paradas.{" "}
                <span className="font-semibold">Parada</span> detiene el efectivo y pide motivo (tiempo muerto);{" "}
                <span className="font-semibold">no</span> cierra el turno de planta. Para cerrar la sesión use{" "}
                <span className="font-semibold">Cerrar turno</span>.
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
            areaLabel="impresion"
            showTimerActions={props.hasActiveTurno}
          />
        ) : (
          <div className="mes-timer-grid">
            {/* legacy fallback */}
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

      {props.hasActiveTurno ? (
      <>
      <MesSectionShell
        title={mesSectionTitle(Package, "Ingreso de material virgen")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneIngresoMaterial} />}
        bodyClassName="mes-section__body--flush"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-9">
          {props.entradaBobinas.map((val, idx) => {
            const filled = isBobinaKgSlotFilled(val) || hasMeta(props.entradaMeta[idx])
            return (
              <MesBobinaKgSlotCell
                key={`ent-${idx}`}
                id={mk(`entrada-bobina-${idx}`)}
                name={`impEntradaBobinaKg_${idx + 1}`}
                slotNum={idx + 1}
                value={val}
                filled={filled}
                inputDisabled={inputDisabled}
                onChange={(v) => props.onEntradaChange(idx, v)}
                labelButton={
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
                }
              />
            )
          })}
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
        headerRight={<MesSectionHeaderExtras isDone={doneDevoluciones} />}
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
          Estas devoluciones llegan a <span className="font-medium text-foreground">Inventario → Devoluciones</span>{" "}
          para aceptación. Las <span className="font-medium text-foreground">buenas</span> entran al inventario y las{" "}
          <span className="font-medium text-foreground">malas</span> van a bobinas rechazadas; además alimentan el
          reporte.
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
                <span className="min-w-0 truncate">Registrar envío a almacén</span>
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
            <div className="mt-3 space-y-4 rounded-xl border border-border/70 bg-card/40 p-4 shadow-inner sm:p-5">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs">
                <span className="text-muted-foreground">Orden</span>
                <span className="font-mono font-semibold text-foreground">{props.warehouseReturn.workOrderCode}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Impresión → Almacén</span>
              </div>

              <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={mk("warehouse-bobina-ref")} className="ot-label text-xs">
                    Bobina / referencia (ambas devoluciones)
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

              <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
                <div className="flex h-full flex-col rounded-2xl border border-emerald-300/60 bg-gradient-to-b from-emerald-50/90 via-emerald-50/50 to-background p-5 shadow-sm dark:border-emerald-800/50 dark:from-emerald-950/40 dark:via-emerald-950/20">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-emerald-200/70 pb-3 dark:border-emerald-800/40">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Devolución buena</span>
                      <p className="text-[11px] leading-snug text-emerald-900/70 dark:text-emerald-200/80">
                        Material que regresa a inventario.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/60 bg-emerald-600 text-[10px] text-white shadow-sm hover:bg-emerald-600"
                    >
                      Reingreso inventario
                    </Badge>
                  </div>
                  <div className="grid flex-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor={mk("warehouse-material-buena")} className="text-xs font-medium text-emerald-900/90 dark:text-emerald-200/90">
                        Material
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
                            className="h-9 w-full justify-between gap-2 rounded-md border border-emerald-200/80 bg-white px-3 font-normal shadow-sm transition-colors hover:border-emerald-300 dark:bg-white dark:text-slate-900"
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
                                      props.warehouseReturn.onDraftChange({
                                        buenaMaterialId: String(m.id),
                                        buenaEspecificaciones: materialSpecificationsLabel(m),
                                      })
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
                    <div className="space-y-1.5">
                      {fieldLabel(mk("devolucion-buena-especificaciones"), FileSearch, "Especificaciones")}
                      <Input
                        id={mk("devolucion-buena-especificaciones")}
                        name="impDevolucionBuenaEspecificaciones"
                        className="ot-input-unified h-9 border-emerald-200/80 bg-white dark:bg-white dark:text-slate-900"
                        value={props.warehouseReturn.draft.buenaEspecificaciones}
                        onChange={(e) =>
                          props.warehouseReturn.onDraftChange({ buenaEspecificaciones: e.target.value })
                        }
                        placeholder="Micras, ancho, proveedor…"
                        disabled={inputDisabled}
                      />
                    </div>
                    <div className="space-y-1.5">
                      {fieldLabel(mk("devolucion-buena-kg"), PackageCheck, "Kilos total")}
                      <Input
                        id={mk("devolucion-buena-kg")}
                        name="impDevolucionBuenaKg"
                        className="ot-input-unified h-9 border-emerald-200/80 bg-white dark:bg-white dark:text-slate-900"
                        inputMode="decimal"
                        value={props.devolucionBuenaRaw}
                        onChange={(e) => props.onSetDevolucionBuena(e.target.value)}
                        placeholder="0"
                        disabled={inputDisabled}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      {fieldLabel(mk("devolucion-buena-motivo"), NotebookPen, "Motivo")}
                      <Textarea
                        id={mk("devolucion-buena-motivo")}
                        name="impDevolucionBuenaMotivo"
                        className="min-h-[5rem] border-emerald-200/80 bg-white dark:bg-white dark:text-slate-900"
                        value={props.warehouseReturn.draft.buenaMotivo}
                        onChange={(e) =>
                          props.warehouseReturn.onDraftChange({ buenaMotivo: e.target.value })
                        }
                        placeholder="Motivo de la devolución buena"
                        disabled={inputDisabled}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex h-full flex-col rounded-2xl border border-rose-300/60 bg-gradient-to-b from-rose-50/90 via-rose-50/45 to-background p-5 shadow-sm dark:border-rose-800/50 dark:from-rose-950/40 dark:via-rose-950/20">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-rose-200/70 pb-3 dark:border-rose-800/40">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-rose-900 dark:text-rose-200">Devolución mala</span>
                      <p className="text-[11px] leading-snug text-rose-900/70 dark:text-rose-200/80">
                        Registre cada bobina rechazada en una línea.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive" className="text-[10px]">
                        Bobinas rechazadas
                      </Badge>
                      {!inputDisabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-rose-300/80 bg-white text-xs text-rose-900 shadow-sm hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
                          onClick={props.warehouseReturn.onAddRejectedEntry}
                          disabled={props.warehouseReturn.submitting}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Agregar línea
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-4">
                    {props.warehouseReturn.draft.rechazadaEntries.map((entry, entryIndex) => {
                      const entryKg = num(entry.kg)
                      const motivoDisabled = inputDisabled || entryKg <= 0
                      const isMotivoComboOpen = isRejectedFieldComboOpen(openRejectedCombo, entry.id)
                      const isFechaBobinaPickerOpen =
                        openRejectedDatePicker?.entryId === entry.id &&
                        openRejectedDatePicker.field === "fechaBobina"
                      const isCreadaPickerOpen =
                        openRejectedDatePicker?.entryId === entry.id &&
                        openRejectedDatePicker.field === "creadaFecha"
                      const canRemove = props.warehouseReturn.draft.rechazadaEntries.length > 1
                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            "space-y-3 rounded-xl border border-rose-200/75 bg-white/80 p-3.5 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20",
                            entryIndex > 0 && "mt-0",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-rose-900/80 dark:text-rose-200/80">
                              Línea {entryIndex + 1}
                            </span>
                            {canRemove && !inputDisabled ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs text-rose-800 hover:bg-rose-100 hover:text-rose-950 dark:text-rose-200 dark:hover:bg-rose-950/60"
                                onClick={() => props.warehouseReturn.onRemoveRejectedEntry(entry.id)}
                                disabled={props.warehouseReturn.submitting}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                Quitar
                              </Button>
                            ) : null}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              {fieldLabel(
                                mk(`devolucion-rechazada-fecha-bobina-${entry.id}`),
                                CalendarDays,
                                "Fecha de la bobina",
                              )}
                              <Popover
                                open={isFechaBobinaPickerOpen}
                                onOpenChange={(open) =>
                                  setOpenRejectedDatePicker(
                                    open ? { entryId: entry.id, field: "fechaBobina" } : null,
                                  )
                                }
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    id={mk(`devolucion-rechazada-fecha-bobina-${entry.id}`)}
                                    name={`impDevolucionRechazadaFechaBobina_${entryIndex + 1}`}
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      "ot-input-unified h-9 w-full justify-between bg-white px-3 font-normal dark:bg-white dark:text-slate-900",
                                      !entry.fechaBobina && "text-muted-foreground",
                                    )}
                                    disabled={inputDisabled}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden />
                                      {isoDateDisplay(entry.fechaBobina)}
                                    </span>
                                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <UiCalendar
                                    mode="single"
                                    selected={parseIsoDate(entry.fechaBobina)}
                                    defaultMonth={parseIsoDate(entry.fechaBobina) ?? new Date()}
                                    onSelect={(date) => {
                                      if (!date) return
                                      props.warehouseReturn.onRejectedEntryChange(entry.id, {
                                        fechaBobina: formatIsoDate(date),
                                      })
                                      setOpenRejectedDatePicker(null)
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-1">
                              {fieldLabel(
                                mk(`devolucion-rechazada-creada-${entry.id}`),
                                CalendarDays,
                                "Creada",
                              )}
                              <Popover
                                open={isCreadaPickerOpen}
                                onOpenChange={(open) =>
                                  setOpenRejectedDatePicker(
                                    open ? { entryId: entry.id, field: "creadaFecha" } : null,
                                  )
                                }
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    id={mk(`devolucion-rechazada-creada-${entry.id}`)}
                                    name={`impDevolucionRechazadaCreada_${entryIndex + 1}`}
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      "ot-input-unified h-9 w-full justify-between bg-white px-3 font-normal dark:bg-white dark:text-slate-900",
                                      !(entry.creadaFecha || todayIsoDate()) && "text-muted-foreground",
                                    )}
                                    disabled={inputDisabled}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden />
                                      {isoDateDisplay(entry.creadaFecha || todayIsoDate())}
                                    </span>
                                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <UiCalendar
                                    mode="single"
                                    selected={parseIsoDate(entry.creadaFecha || todayIsoDate())}
                                    defaultMonth={parseIsoDate(entry.creadaFecha || todayIsoDate()) ?? new Date()}
                                    onSelect={(date) => {
                                      if (!date) return
                                      props.warehouseReturn.onRejectedEntryChange(entry.id, {
                                        creadaFecha: formatIsoDate(date),
                                      })
                                      setOpenRejectedDatePicker(null)
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          <div className="order-5 space-y-1">
                            {fieldLabel(mk(`devolucion-rechazada-kg-${entry.id}`), Weight, "Kilos")}
                            <Input
                              id={mk(`devolucion-rechazada-kg-${entry.id}`)}
                              name={`impDevolucionRechazadaKg_${entryIndex + 1}`}
                              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                              inputMode="decimal"
                              value={entry.kg}
                              onChange={(e) => {
                                const raw = String(e.target.value ?? "").trim().replace(",", ".")
                                const n = raw === "" ? 0 : Number(raw)
                                const rechZero = !Number.isFinite(n) || n <= 0
                                props.warehouseReturn.onRejectedEntryChange(entry.id, {
                                  kg: e.target.value,
                                  motivo: rechZero ? "" : entry.motivo,
                                })
                              }}
                              placeholder="0"
                              disabled={inputDisabled}
                            />
                          </div>

                          <div className="order-4 space-y-1">
                            {fieldLabel(
                              mk(`devolucion-rechazada-operador-${entry.id}`),
                              UserRound,
                              "Operador",
                            )}
                            <Input
                              id={mk(`devolucion-rechazada-operador-${entry.id}`)}
                              name={`impDevolucionRechazadaOperador_${entryIndex + 1}`}
                              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                              value={entry.operador}
                              onChange={(e) =>
                                props.warehouseReturn.onRejectedEntryChange(entry.id, {
                                  operador: e.target.value,
                                })
                              }
                              placeholder={props.impOperador.trim() || "Operador"}
                              disabled={inputDisabled}
                            />
                          </div>

                          <div className="order-6 space-y-1">
                            {fieldLabel(
                              mk(`devolucion-rechazada-motivo-${entry.id}`),
                              FileSearch,
                              "Motivo (devolución rechazada)",
                            )}
                            <Popover
                              open={isMotivoComboOpen && !motivoDisabled}
                              onOpenChange={(o) => {
                                if (!motivoDisabled) {
                                  setOpenRejectedCombo(o ? { entryId: entry.id } : null)
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  id={mk(`devolucion-rechazada-motivo-${entry.id}`)}
                                  name={`impDevolucionRechazadaMotivo_${entryIndex + 1}`}
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={isMotivoComboOpen && !motivoDisabled}
                                  disabled={motivoDisabled}
                                  className={cn(
                                    "h-9 w-full justify-between gap-2 rounded-md border border-rose-200/80 bg-white px-3 font-normal shadow-sm hover:bg-white data-[state=open]:bg-white dark:bg-white dark:text-slate-900 dark:hover:bg-white dark:data-[state=open]:bg-white",
                                    motivoDisabled && "cursor-not-allowed opacity-60",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "min-w-0 flex-1 truncate text-left text-sm",
                                      (motivoDisabled || !entry.motivo.trim()) && "text-muted-foreground",
                                    )}
                                  >
                                    {rejectedMotivoLabel(entry)}
                                  </span>
                                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
                                align="start"
                              >
                                <Command>
                                  <CommandList className="max-h-60">
                                    <CommandGroup>
                                      <CommandItem
                                        value="limpiar motivo devolucion"
                                        onSelect={() => {
                                          props.warehouseReturn.onRejectedEntryChange(entry.id, { motivo: "" })
                                          setOpenRejectedCombo(null)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            !entry.motivo.trim() ? "opacity-100" : "opacity-0",
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
                                            props.warehouseReturn.onRejectedEntryChange(entry.id, { motivo: r.id })
                                            setOpenRejectedCombo(null)
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4 shrink-0",
                                              r.id === entry.motivo.trim() ? "opacity-100" : "opacity-0",
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

                          <div className="order-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label
                                htmlFor={mk(`warehouse-proveedor-rechazada-${entry.id}`)}
                                className="text-xs font-medium text-rose-900/90 dark:text-rose-200/90"
                              >
                                Proveedor
                              </Label>
                              <span className="text-[10px] text-muted-foreground">Opcional</span>
                            </div>
                            <Input
                              id={mk(`warehouse-proveedor-rechazada-${entry.id}`)}
                              name={`impWarehouseProveedorRechazada_${entryIndex + 1}`}
                              className="ot-input-unified h-9 border-rose-200/80 bg-white dark:bg-white dark:text-slate-900"
                              value={entry.proveedorId}
                              onChange={(e) =>
                                props.warehouseReturn.onRejectedEntryChange(entry.id, {
                                  proveedorId: e.target.value,
                                })
                              }
                              list={mk(`warehouse-proveedor-rechazada-options-${entry.id}`)}
                              placeholder={
                                props.warehouseReturn.loadingSuppliers
                                  ? "Cargando proveedores…"
                                  : "— (opcional)"
                              }
                              disabled={inputDisabled}
                            />
                            <datalist id={mk(`warehouse-proveedor-rechazada-options-${entry.id}`)}>
                              {props.warehouseReturn.supplierOptions.map((s) => (
                                <option key={s.id} value={s.name} />
                              ))}
                            </datalist>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label
                                htmlFor={mk(`warehouse-material-rechazada-${entry.id}`)}
                                className="text-xs font-medium text-rose-900/90 dark:text-rose-200/90"
                              >
                                Material (rechazadas)
                              </Label>
                              <span className="text-[10px] text-muted-foreground">Opcional</span>
                            </div>
                            <Input
                              id={mk(`warehouse-material-rechazada-${entry.id}`)}
                              name={`impWarehouseMaterialRechazada_${entryIndex + 1}`}
                              className="ot-input-unified h-9 border-rose-200/80 bg-white dark:bg-white dark:text-slate-900"
                              value={entry.materialId}
                              onChange={(e) =>
                                props.warehouseReturn.onRejectedEntryChange(entry.id, {
                                  materialId: e.target.value,
                                })
                              }
                              list={mk(`warehouse-material-rechazada-options-${entry.id}`)}
                              placeholder={
                                props.warehouseReturn.loadingBad
                                  ? "Cargando materiales…"
                                  : "— (opcional)"
                              }
                              disabled={inputDisabled}
                            />
                            <datalist id={mk(`warehouse-material-rechazada-options-${entry.id}`)}>
                              {props.warehouseReturn.materialOptionsBad.map((m) => (
                                <option key={m.id} value={`${m.sku} · ${m.name}`} />
                              ))}
                            </datalist>
                          </div>

                          <div className="space-y-1.5">
                            <Label
                              htmlFor={mk(`warehouse-rechazada-obs-${entry.id}`)}
                              className="text-xs font-medium text-rose-900/90 dark:text-rose-200/90"
                            >
                              Observación (opcional)
                            </Label>
                            <Textarea
                              id={mk(`warehouse-rechazada-obs-${entry.id}`)}
                              name={`impWarehouseRechazadaObs_${entryIndex + 1}`}
                              className="min-h-[4.5rem] bg-white text-sm dark:bg-white dark:text-slate-900"
                              value={entry.obs}
                              onChange={(e) =>
                                props.warehouseReturn.onRejectedEntryChange(entry.id, { obs: e.target.value })
                              }
                              placeholder="Detalle adicional (si aplica)"
                              disabled={inputDisabled}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {rechBobinas > 0 ? (
                      <p className="text-muted-foreground text-[11px] font-medium">
                        Total rechazadas en este envío: {rechBobinas} bobina{rechBobinas === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-[11px] leading-snug sm:max-w-[55%]">
                  En rechazadas: <span className="font-medium text-foreground">motivo obligatorio</span>; proveedor y
                  material opcionales. Pulse <span className="font-medium text-foreground">Enviar a almacén</span> para
                  registrar la solicitud.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
            </div>
          </CollapsibleContent>
        </Collapsible>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PackageSearch, "Proceso — salida bobina impresa")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneSalidaBobina} />}
        bodyClassName="mes-section__body--flush"
      >
        <p className="text-muted-foreground border-b border-border/60 px-3 py-2 text-[11px] leading-snug">
          Estos kg son el producto impreso del turno; alimentan «Producido», «Total salida» del resumen y la
          bandeja de Impresión.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 p-3 pt-2">
          {props.salidaBobinas.map((val, idx) => {
            const filled = isBobinaKgSlotFilled(val) || hasSalidaBobinaMeta(props.salidaMeta[idx])
            return (
              <MesBobinaKgSlotCell
                key={`sal-${idx}`}
                id={mk(`salida-bobina-${idx}`)}
                name={`impSalidaBobinaKg_${idx + 1}`}
                slotNum={idx + 1}
                value={val}
                filled={filled}
                inputDisabled={inputDisabled}
                onChange={(v) => props.onSalidaChange(idx, v)}
                labelButton={
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant={hasSalidaBobinaMeta(props.salidaMeta[idx]) ? "default" : "outline"}
                          className="h-5 w-5"
                          onClick={() => props.onOpenSalidaLabel(idx)}
                          disabled={inputDisabled}
                          title={`Etiqueta bobina de salida #${idx + 1}`}
                        >
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {salidaBobinaLabelTooltipText(props.salidaMeta[idx])}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                }
              />
            )
          })}
        </div>
        <div className="mt-2 mes-stat-grid">
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
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(Recycle, "Desperdicio del turno (Kg)")}
        subtle
        className="mes-section--scrap-premium"
        headerRight={<MesSectionHeaderExtras isDone={doneScrap} />}
      >
        <p className="text-muted-foreground mb-3 text-[11px] leading-snug">
          Los kg de impreso se clasifican en el reporte de desperdicio según BOPP o Polietileno (soporte de la OT).
        </p>
        <div className="mes-scrap-grid">
          <div className="mes-scrap-field">
            {fieldLabel(mk("scrap-transparente"), Layers, "Transparente")}
            <Input
              id={mk("scrap-transparente")}
              name="impScrapTransparenteKg"
              className="ot-input-unified h-9 mes-scrap-input"
              inputMode="decimal"
              value={props.scrapTransparenteRaw}
              onChange={(e) => props.onSetScrapTransparente(sanitizePositiveDecimalInput(e.target.value, 2))}
              placeholder="0"
              disabled={inputDisabled}
            />
          </div>
          <div className="mes-scrap-field">
            {fieldLabel(mk("scrap-impreso"), Printer, "Impreso")}
            <Input
              id={mk("scrap-impreso")}
              name="impScrapImpresoKg"
              className="ot-input-unified h-9 mes-scrap-input"
              inputMode="decimal"
              value={props.scrapImpresoRaw}
              onChange={(e) => props.onSetScrapImpreso(sanitizePositiveDecimalInput(e.target.value, 2))}
              placeholder="0"
              disabled={inputDisabled}
            />
          </div>
          <MesStatTile
            label="Total desperdicio"
            value={`${turnScrapKg.toFixed(2)} Kg`}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
          <div className="mes-scrap-destino mes-scrap-destino-row space-y-1">
            <Label
              id={mk("scrap-impreso-destino-label")}
              className="mes-scrap-destino__label text-muted-foreground text-[10px] font-medium"
            >
              Destino impreso (reporte)
            </Label>
            <ToggleGroup
              type="single"
              aria-labelledby={mk("scrap-impreso-destino-label")}
              className="mes-scrap-toggle-group flex flex-wrap justify-start gap-1"
              value={
                normalizeScrapSubstrate(props.scrapImpresoDestinoRaw) === SCRAP_POLIETILENO
                  ? SCRAP_POLIETILENO
                  : "bopp"
              }
              onValueChange={(v) => {
                if (!v || inputDisabled) return
                props.onSetScrapImpresoDestino(v)
              }}
              disabled={inputDisabled}
            >
              <ToggleGroupItem value="bopp" className="mes-scrap-toggle-item mes-scrap-toggle-item--bopp h-7 px-2 text-xs">
                <Layers className="mes-scrap-toggle-item__icon h-4 w-4" aria-hidden />
                BOPP
              </ToggleGroupItem>
              <ToggleGroupItem value={SCRAP_POLIETILENO} className="mes-scrap-toggle-item mes-scrap-toggle-item--pe h-7 px-2 text-xs">
                <Recycle className="mes-scrap-toggle-item__icon h-4 w-4" aria-hidden />
                Polietileno
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title={mesSectionTitle(PieChart, "Resumen de producción")}
        subtle
        headerRight={
          <MesSectionHeaderExtras
            isDone={doneResumen}
            actions={
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
            }
          />
        }
      >
        <div className="mes-stat-grid sm:grid-cols-2">
          <MesStatTile
            label="Total material entrada"
            value={`${props.totalEntradaTurno.toFixed(2)} Kg`}
            icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Total salida"
            value={`${props.totalSalida.toFixed(2)} Kg`}
            icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
          />
          <MesStatTile
            label="Total desperdicio"
            value={`${turnScrapKg.toFixed(2)} Kg`}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
              Devolución buena
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Material</TableHead>
                  <TableHead className="h-8 text-xs">Especificaciones</TableHead>
                  <TableHead className="h-8 text-xs text-right">Kilos total</TableHead>
                  <TableHead className="h-8 text-xs">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buenaDev > 0.01 || props.warehouseReturn.draft.buenaMaterialId ? (
                  <TableRow>
                    <TableCell className="py-2 text-xs">
                      {buenaMaterialSelected
                        ? `${buenaMaterialSelected.sku} · ${buenaMaterialSelected.name}`
                        : "—"}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {props.warehouseReturn.draft.buenaEspecificaciones.trim() || "—"}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs font-medium">
                      {buenaDev > 0.01 ? `${buenaDev.toFixed(2)} Kg` : `${num(props.devolucionBuenaRaw).toFixed(2)} Kg`}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {props.warehouseReturn.draft.buenaMotivo.trim() || "—"}
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-3 text-center text-xs text-muted-foreground">
                      Sin devolución buena registrada en este turno.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border border-rose-200/80 bg-rose-50/40 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-900 dark:text-rose-200">
              Devolución mala
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Fecha bobina</TableHead>
                  <TableHead className="h-8 text-xs">Creada</TableHead>
                  <TableHead className="h-8 text-xs">Proveedor</TableHead>
                  <TableHead className="h-8 text-xs">Operador</TableHead>
                  <TableHead className="h-8 text-xs text-right">Kilos</TableHead>
                  <TableHead className="h-8 text-xs">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.warehouseReturn.draft.rechazadaEntries.filter((e) => num(e.kg) > 0).length > 0 ? (
                  props.warehouseReturn.draft.rechazadaEntries
                    .filter((e) => num(e.kg) > 0)
                    .map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="py-2 text-xs">{entry.fechaBobina || "—"}</TableCell>
                        <TableCell className="py-2 text-xs">{entry.creadaFecha || todayIsoDate()}</TableCell>
                        <TableCell className="py-2 text-xs">{entry.proveedorId.trim() || "—"}</TableCell>
                        <TableCell className="py-2 text-xs">{entry.operador.trim() || props.impOperador || "—"}</TableCell>
                        <TableCell className="py-2 text-right text-xs font-medium">{num(entry.kg).toFixed(2)} Kg</TableCell>
                        <TableCell className="py-2 text-xs">{rejectReasonLabel(entry.motivo) || "—"}</TableCell>
                      </TableRow>
                    ))
                ) : props.devolucionRechazadaKg > 0.01 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-2 text-xs">
                      —
                    </TableCell>
                    <TableCell className="py-2 text-xs">—</TableCell>
                    <TableCell className="py-2 text-xs">{props.impOperador || "—"}</TableCell>
                    <TableCell className="py-2 text-right text-xs font-medium">
                      {props.devolucionRechazadaKg.toFixed(2)} Kg
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {rejectReasonLabel(props.devolucionRechazadaMotivoRaw) || props.devolucionRechazadaMotivoRaw || "—"}
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-3 text-center text-xs text-muted-foreground">
                      Sin devolución mala registrada en este turno.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
        <DialogContent
          className={cn(
            "gap-0 overflow-hidden p-0",
            props.labelEditorMode === "salida" ? "max-w-md" : "max-w-3xl",
          )}
        >
          {props.labelEditorMode === "salida" ? (
            <>
              <DialogHeader className="space-y-2 border-b border-primary/10 bg-gradient-to-r from-primary/5 via-background to-primary/5 px-6 py-5">
                <DialogTitle className="flex items-center gap-2 text-left">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <PackageSearch className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span>Bobina de salida</span>
                    <Badge variant="secondary" className="font-mono text-xs font-semibold">
                      #{props.labelEditorIndex + 1}
                    </Badge>
                  </span>
                </DialogTitle>
                <DialogDescription className="text-left">
                  Registre los datos de salida. Todos los campos son opcionales.
                </DialogDescription>
              </DialogHeader>

              <div className="px-6 py-5">
                <section className="rounded-xl border border-primary/10 bg-gradient-to-b from-muted/30 to-muted/10 p-4 shadow-sm">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-primary/75">
                    Planilla de salida
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <BobinaLabelField id={mk("label-peso")} label="Peso (Kg)" icon={Weight}>
                      <Input
                        id={mk("label-peso")}
                        name="impLabelPeso"
                        value={props.labelEditorDraft.peso}
                        onChange={(e) => props.onLabelDraftChange("peso", e.target.value)}
                        placeholder="Ej: 120"
                        inputMode="decimal"
                        className={BOBINA_LABEL_INPUT_CLASS}
                      />
                    </BobinaLabelField>

                    <BobinaLabelField id={mk("label-fecha")} label="Fecha" icon={CalendarDays}>
                      <Popover open={labelFechaPickerOpen} onOpenChange={setLabelFechaPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id={mk("label-fecha")}
                            type="button"
                            variant="outline"
                            name="impLabelFecha"
                            className={cn(
                              BOBINA_LABEL_INPUT_CLASS,
                              "w-full justify-between px-3 font-normal",
                              !props.labelEditorDraft.fecha.trim() && "text-muted-foreground",
                            )}
                          >
                            <span className="inline-flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden />
                              {bobinaLabelFechaDisplay(props.labelEditorDraft.fecha)}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <UiCalendar
                            mode="single"
                            selected={parseBobinaLabelFecha(props.labelEditorDraft.fecha)}
                            defaultMonth={parseBobinaLabelFecha(props.labelEditorDraft.fecha) ?? new Date()}
                            onSelect={(date) => {
                              if (!date) return
                              props.onLabelDraftChange("fecha", formatBobinaLabelFecha(date))
                              setLabelFechaPickerOpen(false)
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </BobinaLabelField>

                    <BobinaLabelField id={mk("label-metraje")} label="Metraje (m)" icon={ArrowUpFromLine}>
                      <Input
                        id={mk("label-metraje")}
                        name="impLabelMetraje"
                        value={props.labelEditorDraft.metraje}
                        onChange={(e) => props.onLabelDraftChange("metraje", e.target.value)}
                        placeholder="Metros"
                        inputMode="decimal"
                        className={BOBINA_LABEL_INPUT_CLASS}
                      />
                    </BobinaLabelField>

                    <BobinaLabelField id={mk("label-hora")} label="Hora" icon={Clock}>
                      <Input
                        id={mk("label-hora")}
                        name="impLabelHora"
                        type="time"
                        value={props.labelEditorDraft.hora}
                        onChange={(e) => props.onLabelDraftChange("hora", e.target.value)}
                        className={BOBINA_LABEL_INPUT_CLASS}
                      />
                    </BobinaLabelField>

                    <BobinaLabelField
                      id={mk("label-empalmes")}
                      label="Empalmes"
                      icon={Link2}
                      className="sm:col-span-2"
                    >
                      <Input
                        id={mk("label-empalmes")}
                        name="impLabelEmpalmes"
                        value={props.labelEditorDraft.empalmes}
                        onChange={(e) => props.onLabelDraftChange("empalmes", e.target.value)}
                        placeholder="Cantidad de empalmes"
                        inputMode="numeric"
                        className={BOBINA_LABEL_INPUT_CLASS}
                      />
                    </BobinaLabelField>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="space-y-2 border-b border-primary/10 bg-gradient-to-r from-primary/5 via-background to-primary/5 px-6 py-5">
                <DialogTitle className="flex items-center gap-2 text-left">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Package className="h-4 w-4" aria-hidden />
                  </span>
                  <span>Etiqueta bobina de Entrada #{props.labelEditorIndex + 1}</span>
                </DialogTitle>
                <DialogDescription className="text-left">
                  Registre los datos de la bobina. Todos los campos son opcionales.
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[min(70vh,680px)] space-y-4 overflow-y-auto px-6 py-5">
                <BobinaLabelSection title="Fecha y hora">
                  <BobinaLabelField id={mk("label-fecha")} label="Fecha bobina" icon={CalendarDays}>
                    <Popover open={labelFechaPickerOpen} onOpenChange={setLabelFechaPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id={mk("label-fecha")}
                          type="button"
                          variant="outline"
                          name="impLabelFecha"
                          className={cn(
                            BOBINA_LABEL_INPUT_CLASS,
                            "w-full justify-between px-3 font-normal",
                            !props.labelEditorDraft.fecha.trim() && "text-muted-foreground",
                          )}
                        >
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden />
                            {bobinaLabelFechaDisplay(props.labelEditorDraft.fecha)}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <UiCalendar
                          mode="single"
                          selected={parseBobinaLabelFecha(props.labelEditorDraft.fecha)}
                          defaultMonth={parseBobinaLabelFecha(props.labelEditorDraft.fecha) ?? new Date()}
                          onSelect={(date) => {
                            if (!date) return
                            props.onLabelDraftChange("fecha", formatBobinaLabelFecha(date))
                            setLabelFechaPickerOpen(false)
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </BobinaLabelField>
                  <BobinaLabelField id={mk("label-hora")} label="Hora" icon={Clock}>
                    <Input
                      id={mk("label-hora")}
                      name="impLabelHora"
                      type="time"
                      value={props.labelEditorDraft.hora}
                      onChange={(e) => props.onLabelDraftChange("hora", e.target.value)}
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                </BobinaLabelSection>

                <BobinaLabelSection title="Identificación">
                  <BobinaLabelField id={mk("label-referencia")} label="Referencia bobina" icon={Hash}>
                    <Input
                      id={mk("label-referencia")}
                      name="impLabelReferencia"
                      value={props.labelEditorDraft.referencia}
                      onChange={(e) => props.onLabelDraftChange("referencia", e.target.value)}
                      placeholder="Ref. o lote"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                  <BobinaLabelField id={mk("label-pedido-lote")} label="Pedido / Lote" icon={ClipboardList}>
                    <Input
                      id={mk("label-pedido-lote")}
                      name="impLabelPedidoLote"
                      value={props.labelEditorDraft.pedido_lote}
                      onChange={(e) => props.onLabelDraftChange("pedido_lote", e.target.value)}
                      placeholder="N° pedido o lote"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                  <BobinaLabelField id={mk("label-lote")} label="Lote" icon={Layers} className="sm:col-span-2">
                    <Input
                      id={mk("label-lote")}
                      name="impLabelLote"
                      value={props.labelEditorDraft.lote}
                      onChange={(e) => props.onLabelDraftChange("lote", e.target.value)}
                      placeholder="Lote"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                </BobinaLabelSection>

                <BobinaLabelSection title="Origen y personal">
                  <BobinaLabelField id={mk("label-proveedor")} label="Proveedor" icon={Factory}>
                    <Input
                      id={mk("label-proveedor")}
                      name="impLabelProveedor"
                      value={props.labelEditorDraft.proveedor}
                      onChange={(e) => props.onLabelDraftChange("proveedor", e.target.value)}
                      placeholder="Nombre proveedor"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                  <BobinaLabelField id={mk("label-operador")} label="Operador" icon={UserRound}>
                    <Input
                      id={mk("label-operador")}
                      name="impLabelOperador"
                      value={props.labelEditorDraft.operador}
                      onChange={(e) => props.onLabelDraftChange("operador", e.target.value)}
                      placeholder="Nombre operador"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                  <BobinaLabelField id={mk("label-maquina-origen")} label="Máquina origen" icon={Printer} className="sm:col-span-2">
                    <Input
                      id={mk("label-maquina-origen")}
                      name="impLabelMaquinaOrigen"
                      value={props.labelEditorDraft.maquina_origen}
                      onChange={(e) => props.onLabelDraftChange("maquina_origen", e.target.value)}
                      placeholder="Máquina"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                </BobinaLabelSection>

                <BobinaLabelSection title="Medidas">
                  <BobinaLabelField id={mk("label-peso")} label="Peso (Kg)" icon={Weight}>
                    <Input
                      id={mk("label-peso")}
                      name="impLabelPeso"
                      value={props.labelEditorDraft.peso}
                      onChange={(e) => props.onLabelDraftChange("peso", e.target.value)}
                      placeholder="Ej: 120"
                      inputMode="decimal"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                  <BobinaLabelField id={mk("label-metraje")} label="Metraje" icon={ArrowUpFromLine}>
                    <Input
                      id={mk("label-metraje")}
                      name="impLabelMetraje"
                      value={props.labelEditorDraft.metraje}
                      onChange={(e) => props.onLabelDraftChange("metraje", e.target.value)}
                      placeholder="Metros"
                      inputMode="decimal"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                  <BobinaLabelField id={mk("label-medida-ancho")} label="Medida / Ancho (mm)" icon={Layers} className="sm:col-span-2">
                    <Input
                      id={mk("label-medida-ancho")}
                      name="impLabelMedidaAncho"
                      value={props.labelEditorDraft.medida_ancho}
                      onChange={(e) => props.onLabelDraftChange("medida_ancho", e.target.value)}
                      placeholder="Ej: 610"
                      inputMode="decimal"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                </BobinaLabelSection>

                <BobinaLabelSection title="Tratamiento">
                  <BobinaLabelField id={mk("label-trat-int")} label="Tratamiento interno" icon={Layers}>
                    <Input
                      id={mk("label-trat-int")}
                      name="impLabelTratamientoInterno"
                      value={props.labelEditorDraft.tratamiento_interno}
                      onChange={(e) => props.onLabelDraftChange("tratamiento_interno", e.target.value)}
                      placeholder="Dinas"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                  <BobinaLabelField id={mk("label-trat-ext")} label="Tratamiento externo" icon={Layers}>
                    <Input
                      id={mk("label-trat-ext")}
                      name="impLabelTratamientoExterno"
                      value={props.labelEditorDraft.tratamiento_externo}
                      onChange={(e) => props.onLabelDraftChange("tratamiento_externo", e.target.value)}
                      placeholder="Dinas"
                      className={BOBINA_LABEL_INPUT_CLASS}
                    />
                  </BobinaLabelField>
                </BobinaLabelSection>
              </div>
            </>
          )}

          {props.labelEditorError ? (
            <p className="px-6 pb-2 text-sm text-destructive">{props.labelEditorError}</p>
          ) : null}

          <DialogFooter className="gap-2 border-t border-primary/10 bg-muted/20 px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={props.onLabelClear}>
              Limpiar
            </Button>
            <Button type="button" onClick={props.onLabelSave}>
              Guardar etiqueta
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
              <p className="mt-1">
                <span className="font-semibold text-foreground">Producido acumulado:</span>{" "}
                {props.producidoAcumuladoKg.toFixed(2)} Kg · Entrada {props.totalEntradaAcumulada.toFixed(2)} Kg ·
                Desperdicio {props.totalScrapAcumulado.toFixed(2)} Kg
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
                <ul className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                  {props.closedTurnos.map((t) => (
                    <li key={t.id}>
                      <PrintingTurnoHistorialItem turno={t} formatTimerHms={props.formatTimerHms} />
                    </li>
                  ))}
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
