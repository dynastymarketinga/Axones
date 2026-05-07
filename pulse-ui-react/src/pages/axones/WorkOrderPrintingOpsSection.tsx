import type { ReactNode } from "react"
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Eye,
  Flag,
  Pause,
  Play,
  Plus,
  ReceiptText,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  PRINTING_REJECT_REASONS,
  sumSalidaKg,
  sumScrapKg,
  type BobinaLabelMeta,
  type PrintingTurnoEntry,
} from "./printing-turnos"

export type { BobinaLabelMeta }

type PrintingPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

type LabelEditorMode = "entrada" | "salida"
type DraftPersonRole = "operador" | "ayudante" | "supervisor"
type DraftPerson = { id: string; role: DraftPersonRole; name: string }

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
  onSetOperador: (v: string) => void
  onSetAyudante: (v: string) => void
  onSetSupervisor: (v: string) => void
  onEntradaChange: (idx: number, v: string) => void
  onOpenEntradaLabel: (idx: number) => void
  onSetDevolucionBuena: (v: string) => void
  onSetDevolucionRechazada: (v: string) => void
  onSetDevolucionRechazadaMotivo: (v: string) => void
  onOpenReturnModal: () => void
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
  onDraftTurno: (v: "diurno" | "nocturno") => void
  onDraftGrupo: (v: "A" | "B" | "C") => void
  onDraftPeopleAdd: () => void
  onDraftPeopleRemove: (id: string) => void
  onDraftPeopleUpdate: (id: string, patch: Partial<Pick<DraftPerson, "role" | "name">>) => void
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
  const inputDisabled = props.readOnlyOps || !props.hasActiveTurno
  const num = (v: string): number => {
    const raw = String(v ?? "").trim().replace(",", ".")
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }

  function header(title: string, isDone: boolean, actions?: ReactNode) {
    return (
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/90">{title}</div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isDone ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completo
            </div>
          ) : null}
          {actions ?? null}
        </div>
      </div>
    )
  }

  const doneAcumulado = true

  const autoInfoTurno =
    !!props.impOperador.trim() ||
    !!props.impAyudante.trim() ||
    !!props.impSupervisor.trim() ||
    !!props.impTurno.trim() ||
    !!props.impGrupo.trim()
  const doneInfoTurno = autoInfoTurno

  const autoTemporizador =
    props.timerState !== "pending" ||
    props.effectiveSec > 0.01 ||
    props.deadSec > 0.01 ||
    props.pauseEntries.length > 0
  const doneTemporizador = autoTemporizador

  const autoIngresoMaterial =
    props.entradaBobinas.some((v) => num(v) > 0) || props.entradaMeta.some((m) => hasMeta(m))
  const doneIngresoMaterial = autoIngresoMaterial

  const rechDev = num(props.devolucionRechazadaRaw)
  const buenaDev = num(props.devolucionBuenaRaw)
  const autoDevoluciones =
    (buenaDev > 0.01 || rechDev > 0.01) && (rechDev <= 0.01 || !!props.devolucionRechazadaMotivoRaw.trim())
  const doneDevoluciones = autoDevoluciones
  const motivoSelectDisabled = inputDisabled || rechDev <= 0.01

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

  return (
    <>
      {props.areaFinalizada ? (
        <div className="mt-3 rounded-lg border border-violet-300 bg-violet-100/80 p-3 text-sm text-violet-950 dark:bg-violet-950/40 dark:text-violet-100">
          <span className="font-semibold">Área de impresión finalizada.</span>{" "}
          {props.canFinalizeOrder
            ? "Puede revisar datos guardados. Use Guardar si realiza correcciones."
            : "Solo personal autorizado puede reabrir o corregir desde otro rol."}
        </div>
      ) : null}

      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneAcumulado ? "border-emerald-300 bg-emerald-50/40" : "border-cyan-200/70 bg-cyan-50/40",
        ].join(" ")}
      >
        {header("Acumulado de la orden (todos los turnos)", doneAcumulado)}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Pedido total</span>
            <p className="font-semibold">{props.pedidoTotalKg.toFixed(2)} Kg</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Producido</span>
            <p className="font-semibold text-emerald-700">{props.producidoAcumuladoKg.toFixed(2)} Kg</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Falta por producir</span>
            <p className="font-semibold text-rose-700">{props.faltanteKg.toFixed(2)} Kg</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Registros / turnos</span>
            <p className="font-semibold">{props.turnosRegistrados}</p>
          </div>
        </div>
        <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="rounded border bg-background px-2 py-1.5">
            Total entrada acumulada: <span className="font-semibold text-foreground">{props.totalEntradaAcumulada.toFixed(2)} Kg</span>
          </div>
          <div className="rounded border bg-background px-2 py-1.5">
            Total scrap acumulado: <span className="font-semibold text-foreground">{props.totalScrap.toFixed(2)} Kg</span>
          </div>
          <div className="rounded border bg-background px-2 py-1.5">
            Último turno: <span className="font-semibold text-foreground">{props.ultimoTurnoLabel}</span>
          </div>
        </div>
      </div>

      {props.closedTurnos.length > 0 ? (
        <Collapsible className="mt-3 rounded-lg border bg-muted/30">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium hover:bg-muted/50">
            <span>Turnos registrados ({props.closedTurnos.length})</span>
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

      {!props.hasActiveTurno && !props.areaFinalizada ? (
        <div className="mt-3 rounded-lg border border-dashed border-primary/35 bg-muted/20 p-4">
          <div className="mb-1 text-sm font-semibold">Iniciar un turno</div>
          <p className="text-muted-foreground mb-3 text-xs">
            Indique turno, grupo y operador. Luego podrá iniciar el temporizador y registrar bobinas en este mismo pedido.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="ot-label">Turno</Label>
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
                <ToggleGroupItem value="diurno" className="flex-1">
                  Diurno
                </ToggleGroupItem>
                <ToggleGroupItem value="nocturno" className="flex-1">
                  Nocturno
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-1">
              <Label className="ot-label">Grupo</Label>
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
                  <ToggleGroupItem key={g} value={g} className="flex-1">
                    {g}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div className="mt-4 rounded-lg border bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Personal del turno
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={props.onDraftPeopleAdd}
                disabled={props.readOnlyOps}
                aria-label="Agregar persona"
                title="Agregar persona"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {props.draftPeople.map((p, idx) => {
                const isOperatorRow = p.role === "operador"
                const showMissing = props.draftOperadorMissing && isOperatorRow
                return (
                  <div
                    key={p.id}
                    className={[
                      "grid gap-2 rounded-md border bg-background p-2",
                      "md:grid-cols-[1fr_12rem_auto]",
                      showMissing ? "border-rose-300 ring-1 ring-rose-200" : "",
                    ].join(" ")}
                  >
                    <div className="space-y-1">
                      <Label className="ot-label">
                        Nombre {isOperatorRow ? "(Operador)" : idx === 0 ? "" : ""}
                      </Label>
                      <Input
                        className="ot-input-unified h-9"
                        value={p.name}
                        onChange={(e) => props.onDraftPeopleUpdate(p.id, { name: e.target.value })}
                        placeholder="Nombre"
                        disabled={props.readOnlyOps}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="ot-label">Rol</Label>
                      <Select
                        value={p.role}
                        onValueChange={(v) =>
                          props.onDraftPeopleUpdate(p.id, { role: v as DraftPersonRole })
                        }
                        disabled={props.readOnlyOps}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Seleccione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operador">Operador</SelectItem>
                          <SelectItem value="ayudante">Ayudante</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-[11px] text-muted-foreground">
                        {p.role === "operador"
                          ? "Responsable del turno"
                          : p.role === "supervisor"
                            ? "Máximo 1 por turno"
                            : "Apoyo operativo"}
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => props.onDraftPeopleRemove(p.id)}
                        disabled={props.readOnlyOps || props.draftPeople.length <= 1}
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {props.draftOperadorMissing ? (
              <div className="mt-2 text-xs text-rose-700">
                Operador es obligatorio para iniciar turno.
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex justify-center">
            <Button type="button" onClick={props.onIniciarTurno} disabled={props.readOnlyOps}>
              Iniciar turno
            </Button>
          </div>
        </div>
      ) : null}

      {props.hasActiveTurno ? (
      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneInfoTurno ? "border-emerald-300 bg-emerald-50/40" : "border-amber-200/70 bg-amber-50/40",
        ].join(" ")}
      >
        {header("Información del turno", doneInfoTurno)}
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="ot-label">Turno</Label>
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
              <ToggleGroupItem
                value="diurno"
                className="flex-1 bg-white dark:bg-white dark:text-slate-900 data-[state=on]:bg-violet-600 data-[state=on]:text-white"
              >
                Diurno
              </ToggleGroupItem>
              <ToggleGroupItem
                value="nocturno"
                className="flex-1 bg-white dark:bg-white dark:text-slate-900 data-[state=on]:bg-violet-600 data-[state=on]:text-white"
              >
                Nocturno
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1">
            <Label className="ot-label">Grupo</Label>
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
                  className="flex-1 bg-white dark:bg-white dark:text-slate-900 data-[state=on]:bg-violet-600 data-[state=on]:text-white"
                >
                  {g}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="ot-field">
            <Label className="ot-label">Operador</Label>
            <Input
              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
              value={props.impOperador}
              onChange={(e) => props.onSetOperador(e.target.value)}
              placeholder="Nombre operador"
              disabled={props.readOnlyOps}
            />
          </div>
          <div className="ot-field">
            <Label className="ot-label">Ayudante</Label>
            <Input
              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
              value={props.impAyudante}
              onChange={(e) => props.onSetAyudante(e.target.value)}
              placeholder="Nombre ayudante"
              disabled={props.readOnlyOps}
            />
          </div>
          <div className="ot-field md:col-span-2">
            <Label className="ot-label">Supervisor</Label>
            <Input
              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
              value={props.impSupervisor}
              onChange={(e) => props.onSetSupervisor(e.target.value)}
              placeholder="Nombre supervisor"
              disabled={props.readOnlyOps}
            />
          </div>
        </div>
      </div>
      ) : null}

      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneTemporizador ? "border-emerald-300 bg-emerald-50/40" : "border-sky-200/70 bg-sky-50/40",
        ].join(" ")}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900">
              <ReceiptText className="h-4 w-4 shrink-0" />
              Temporizador de producción
            </div>
            {doneTemporizador ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completo
              </div>
            ) : null}
          </div>
          <Badge variant="secondary" className="text-xs">
            {props.areaFinalizada
              ? "Área finalizada"
              : props.timerState === "running"
              ? "En producción"
              : props.timerState === "paused"
                ? "En pausa"
                : props.timerState === "completed"
                  ? "Orden finalizada"
                  : props.timerState === "stopped"
                    ? "Turno cerrado"
                    : "Pendiente"}
          </Badge>
        </div>
        {!props.hasActiveTurno ? (
          <div className="mb-3 rounded border border-dashed border-sky-300 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            Inicie un turno para habilitar el temporizador y registrar tiempos del turno.
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-md border bg-background px-3 py-2">
            <div className="font-mono text-3xl font-bold text-sky-900">{props.formatTimerHms(props.totalSec)}</div>
            <p className="text-muted-foreground text-xs">Tiempo transcurrido</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded border bg-muted/30 p-2">
                <p className="text-muted-foreground text-[11px]">Tiempo muerto</p>
                <p className="font-mono text-sm font-semibold text-red-600">{props.formatTimerHms(props.deadSec)}</p>
              </div>
              <div className="rounded border bg-muted/30 p-2">
                <p className="text-muted-foreground text-[11px]">Tiempo efectivo</p>
                <p className="font-mono text-sm font-semibold text-emerald-700">{props.formatTimerHms(props.effectiveSec)}</p>
              </div>
              <div className="col-span-2 rounded border bg-muted/30 p-2 sm:col-span-1">
                <p className="text-muted-foreground text-[11px]">Kg/Hora estimado</p>
                <p className="text-sm font-semibold">{props.kgHora}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={props.startProductionTimer}
              disabled={
                props.readOnlyOps ||
                !props.hasActiveTurno ||
                props.timerRunning ||
                props.areaFinalizada ||
                props.timerState === "completed"
              }
            >
              <Play className="mr-1 h-4 w-4" />
              Iniciar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={props.pauseProductionTimer}
              disabled={props.readOnlyOps || !props.timerRunning}
            >
              <Pause className="mr-1 h-4 w-4" />
              Pausar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="col-span-2 border-sky-300 text-sky-700 hover:bg-sky-50 md:col-span-1"
              onClick={props.onPreviewTimerReport}
              disabled={props.readOnlyOps || !props.canPreviewTimerReport}
              title={
                props.canPreviewTimerReport
                  ? "Vista previa del reporte del temporizador"
                  : "Inicie el temporizador para habilitar la vista previa"
              }
            >
              <Eye className="mr-1 h-4 w-4" />
              Vista previa
            </Button>
            <Button
              type="button"
              variant="outline"
              className="col-span-2 border-rose-300 text-rose-700 hover:bg-rose-50 md:col-span-1"
              onClick={props.onResetAll}
              disabled={!props.canResetAll}
              title="Borra turnos, temporizador y checks para esta OT (Impresión)"
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Reiniciar (desde cero)
            </Button>
            {props.hasActiveTurno ? (
              <Button
                type="button"
                variant="outline"
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={props.onCerrarTurnoActual}
                disabled={props.readOnlyOps || props.areaFinalizada}
              >
                <Square className="mr-1 h-4 w-4" />
                Cerrar turno
              </Button>
            ) : null}
            {props.canFinalizeOrder && !props.areaFinalizada ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void props.onFinalizarAreaImpresion()}
                disabled={props.readOnlyOps && !props.canFinalizeOrder}
              >
                <Flag className="mr-1 h-4 w-4" />
                Finalizar OT
              </Button>
            ) : null}
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
          <div className="mt-3 space-y-1 rounded-md border bg-background p-2">
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
      </div>

      {props.hasActiveTurno ? (
      <>
      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneIngresoMaterial ? "border-emerald-300 bg-emerald-50/40" : "border-emerald-200/70 bg-emerald-50/40",
        ].join(" ")}
      >
        {header("Ingreso de material virgen", doneIngresoMaterial)}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-9">
          {props.entradaBobinas.map((val, idx) => (
            <div key={`ent-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="ot-label">{idx + 1}</Label>
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
        <div className="mt-2 grid gap-2 sm:grid-cols-1">
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Total entrada</span>
            <p className="font-semibold">{props.totalEntradaTurno.toFixed(2)} Kg</p>
          </div>
        </div>
      </div>

      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneDevoluciones ? "border-emerald-300 bg-emerald-50/40" : "border-amber-200/70 bg-amber-50/40",
        ].join(" ")}
      >
        {header("Devoluciones de bobina", doneDevoluciones)}
        {props.devolucionesPendienteAlmacen ? (
          <div className="-mt-1 mb-2">
            <span className="inline-flex items-center rounded-full border border-amber-500/80 bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950">
              Pendiente de registrar en almacén
            </span>
          </div>
        ) : null}
        <p className="text-muted-foreground mb-3 text-[11px] leading-snug">
          Registre kilos devueltos en el turno. Para generar la solicitud a almacén y el movimiento en inventario, use{" "}
          <span className="font-medium text-foreground">Registrar devolución real</span>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="ot-label">Devolución buena (Kg)</Label>
            <Input
              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
              inputMode="decimal"
              value={props.devolucionBuenaRaw}
              onChange={(e) => props.onSetDevolucionBuena(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
            <p className="text-muted-foreground text-[11px]">Material apto para reingreso a inventario.</p>
          </div>
          <div className="space-y-1">
            <Label className="ot-label">Devolución rechazada (Kg)</Label>
            <Input
              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
              inputMode="decimal"
              value={props.devolucionRechazadaRaw}
              onChange={(e) => props.onSetDevolucionRechazada(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
            <p className="text-muted-foreground text-[11px]">Queda en bobinas rechazadas; indique motivo.</p>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Label className="ot-label">Motivo (devolución rechazada)</Label>
          <select
            className="ot-select flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm dark:bg-white dark:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            value={motivoSelectDisabled ? "" : props.devolucionRechazadaMotivoRaw}
            onChange={(e) => props.onSetDevolucionRechazadaMotivo(e.target.value)}
            disabled={motivoSelectDisabled}
          >
            <option value="">
              {motivoSelectDisabled ? "— (indique Kg rechazados primero)" : "Seleccione motivo (obligatorio si hay Kg rechazados)"}
            </option>
            {PRINTING_REJECT_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex w-full justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            className="border-amber-400 text-amber-950 hover:bg-amber-100/80"
            onClick={() => props.onOpenReturnModal()}
            disabled={inputDisabled}
          >
            Registrar devolución real
          </Button>
        </div>
      </div>

      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneSalidaBobina ? "border-emerald-300 bg-emerald-50/40" : "border-violet-200/70 bg-violet-50/40",
        ].join(" ")}
      >
        {header("Proceso - SALIDA BOBINA IMPRESA", doneSalidaBobina)}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {props.salidaBobinas.map((val, idx) => (
            <div key={`sal-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="ot-label">{idx + 1}</Label>
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
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">N° bobinas</span>
            <p className="font-semibold">{props.salidaBobinas.filter((v) => Number(v) > 0).length}</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Peso total</span>
            <p className="font-semibold">{props.totalSalida.toFixed(2)} Kg</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Merma calculada</span>
            <p className="font-semibold">{props.mermaCalc.toFixed(2)} Kg</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">% Refil</span>
            <p className="font-semibold">{props.refilPct.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneMermaMetraje ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200/70 bg-slate-50/40",
        ].join(" ")}
      >
        {header("Merma y metraje", doneMermaMetraje)}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Merma</span>
            <Input
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
            <span className="text-muted-foreground">Metraje</span>
            <Input
              className="ot-input-unified mt-1 h-9 bg-white dark:bg-white dark:text-slate-900"
              inputMode="decimal"
              value={props.metrajeRaw}
              onChange={(e) => props.onSetMetraje(e.target.value)}
              placeholder="0"
              disabled={inputDisabled}
            />
          </div>
        </div>
      </div>

      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneScrap ? "border-emerald-300 bg-emerald-50/40" : "border-orange-200/70 bg-orange-50/40",
        ].join(" ")}
      >
        {header("Scrap del turno (Kg)", doneScrap)}
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label className="ot-label">Transparente</Label>
            <Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapTransparenteRaw} onChange={(e) => props.onSetScrapTransparente(e.target.value)} placeholder="0" disabled={inputDisabled} />
          </div>
          <div>
            <Label className="ot-label">Impreso</Label>
            <Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapImpresoRaw} onChange={(e) => props.onSetScrapImpreso(e.target.value)} placeholder="0" disabled={inputDisabled} />
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Total scrap</span>
            <p className="font-semibold">{props.totalScrap.toFixed(2)} Kg</p>
          </div>
        </div>
      </div>

      <div
        className={[
          "mt-3 rounded-lg border p-3",
          doneResumen ? "border-emerald-300 bg-emerald-50/40" : "bg-muted/20",
        ].join(" ")}
      >
        {header(
          "Resumen de producción",
          doneResumen,
          <Button
            type="button"
            variant="outline"
            className="border-sky-300 text-sky-700 hover:bg-sky-50"
            onClick={props.onPreviewDesperdicioReport}
            disabled={!props.canPreviewDesperdicioReport}
            title={
              props.canPreviewDesperdicioReport
                ? "Vista previa del reporte de desperdicio"
                : "Active un turno para habilitar la vista previa"
            }
          >
            <Eye className="mr-1 h-4 w-4" />
            Vista previa desperdicio
          </Button>,
        )}
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded border bg-background p-2">Total material entrada: <span className="font-semibold">{props.totalEntradaTurno.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Devolución buena: <span className="font-semibold">{props.devolucionBuena.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Devolución rechazada: <span className="font-semibold">{props.devolucionRechazada.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Material consumido: <span className="font-semibold">{props.materialConsumido.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Total salida: <span className="font-semibold">{props.totalSalida.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Total scrap: <span className="font-semibold">{props.totalScrap.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Merma calculada: <span className="font-semibold">{props.mermaCalc.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">% Refil: <span className="font-semibold">{props.refilPct.toFixed(2)}%</span></div>
        </div>
      </div>
      </>
      ) : null}

      <Dialog open={props.pauseMotivoDialogOpen} onOpenChange={props.onPauseMotivoDialogOpenChange}>
        <DialogContent className="max-w-md border-amber-200/80 bg-amber-50/30">
          <DialogHeader>
            <DialogTitle>Registrar motivo de parada</DialogTitle>
            <DialogDescription>
              Seleccione el motivo y continúe el temporizador. Si cierra este cuadro, el turno permanece en pausa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Motivo</Label>
              <select
                className="ot-select h-9 w-full"
                value={props.pauseReason}
                onChange={(e) => props.setPauseReason(e.target.value)}
              >
                <option value="">-- Seleccionar motivo --</option>
                {props.pauseReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Observación (opcional)</Label>
              <Input
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
              Registrar y continuar
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
              <Label>Fecha bobina</Label>
              <Input
                value={props.labelEditorDraft.fecha}
                onChange={(e) => props.onLabelDraftChange("fecha", e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input value={props.labelEditorDraft.hora} onChange={(e) => props.onLabelDraftChange("hora", e.target.value)} placeholder="--:--" />
            </div>
            <div className="space-y-2">
              <Label>Referencia Bobina</Label>
              <Input value={props.labelEditorDraft.referencia} onChange={(e) => props.onLabelDraftChange("referencia", e.target.value)} placeholder="Ref. o lote" />
            </div>
            <div className="space-y-2">
              <Label>Pedido / Lote</Label>
              <Input value={props.labelEditorDraft.pedido_lote} onChange={(e) => props.onLabelDraftChange("pedido_lote", e.target.value)} placeholder="N° pedido o lote" />
            </div>
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input value={props.labelEditorDraft.proveedor} onChange={(e) => props.onLabelDraftChange("proveedor", e.target.value)} placeholder="Nombre proveedor" />
            </div>
            <div className="space-y-2">
              <Label>Operador</Label>
              <Input value={props.labelEditorDraft.operador} onChange={(e) => props.onLabelDraftChange("operador", e.target.value)} placeholder="Nombre operador" />
            </div>
            <div className="space-y-2">
              <Label>Peso (Kg)</Label>
              <Input value={props.labelEditorDraft.peso} onChange={(e) => props.onLabelDraftChange("peso", e.target.value)} placeholder="Ej: 120" />
            </div>
            <div className="space-y-2">
              <Label>Metraje</Label>
              <Input value={props.labelEditorDraft.metraje} onChange={(e) => props.onLabelDraftChange("metraje", e.target.value)} placeholder="Metros" />
            </div>
            <div className="space-y-2">
              <Label>Medida / Ancho (mm)</Label>
              <Input value={props.labelEditorDraft.medida_ancho} onChange={(e) => props.onLabelDraftChange("medida_ancho", e.target.value)} placeholder="Ej: 610" />
            </div>
            <div className="space-y-2">
              <Label>Máquina origen</Label>
              <Input value={props.labelEditorDraft.maquina_origen} onChange={(e) => props.onLabelDraftChange("maquina_origen", e.target.value)} placeholder="Máquina" />
            </div>
            <div className="space-y-2">
              <Label>Tratamiento interno</Label>
              <Input value={props.labelEditorDraft.tratamiento_interno} onChange={(e) => props.onLabelDraftChange("tratamiento_interno", e.target.value)} placeholder="Dinas" />
            </div>
            <div className="space-y-2">
              <Label>Tratamiento externo</Label>
              <Input value={props.labelEditorDraft.tratamiento_externo} onChange={(e) => props.onLabelDraftChange("tratamiento_externo", e.target.value)} placeholder="Dinas" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Lote</Label>
              <Input value={props.labelEditorDraft.lote} onChange={(e) => props.onLabelDraftChange("lote", e.target.value)} placeholder="Lote" />
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
    </>
  )
}
