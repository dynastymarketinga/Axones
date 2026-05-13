import {
  ArrowUpRight,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Flag,
  LogOut,
  Moon,
  ReceiptText,
  Sun,
  Users,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { BobinaLabelMeta } from "./WorkOrderPrintingOpsSection"

export type LamLabelEditorMode = "impresa" | "virgen" | "salida"

type LaminacionPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

/** Turno de laminación archivado al cerrar o finalizar (solo lectura). */
export type LamArchivedTurnEntry = {
  id: string
  closed_at: string
  outcome: "turno_cerrado" | "orden_finalizada"
  turno: string
  grupo: string
  operador: string
  ayudante: string
  supervisor: string
  effective_sec: number
  dead_sec: number
  total_salida_kg: number
  pauses: LaminacionPauseEntry[]
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

function lamLabelEditorTitle(mode: LamLabelEditorMode, idx: number): string {
  const n = idx + 1
  if (mode === "impresa") return `Etiqueta bobina impresa (entrada laminación) #${n}`
  if (mode === "virgen") return `Etiqueta bobina virgen (laminación) #${n}`
  return `Etiqueta bobina salida laminada #${n}`
}

type Props = {
  pedidoTotalKg: number
  producidoAcumuladoKg: number
  faltanteKg: number
  turnosRegistrados: number
  totalEntradaImpresa: number
  totalEntradaVirgen: number
  totalSalida: number
  totalScrap: number
  ultimoTurnoLabel: string
  timerState: string
  totalSec: number
  deadSec: number
  effectiveSec: number
  kgHora: string
  timerRunning: boolean
  timerPaused: boolean
  timerStopped: boolean
  pauseReasons: string[]
  pauseReason: string
  pauseObs: string
  pauseEntries: LaminacionPauseEntry[]
  archivedTurns: LamArchivedTurnEntry[]
  turno: string
  grupo: string
  operador: string
  ayudante: string
  supervisor: string
  entradaImpresaBobinas: string[]
  entradaImpresaMeta: BobinaLabelMeta[]
  entradaVirgenBobinas: string[]
  entradaVirgenMeta: BobinaLabelMeta[]
  salidaBobinas: string[]
  salidaMeta: BobinaLabelMeta[]
  metrajeRaw: string
  adhesivoEntradaRaw: string
  adhesivoSobroRaw: string
  catalizadorEntradaRaw: string
  catalizadorSobroRaw: string
  acetatoEntradaRaw: string
  acetatoSobroRaw: string
  scrapTransparenteRaw: string
  scrapImpresoRaw: string
  scrapLaminadoRaw: string
  mermaCalc: number
  refilPct: number
  formatTimerHms: (s: number) => string
  setPauseReason: (v: string) => void
  setPauseObs: (v: string) => void
  startProductionTimer: () => void
  pauseProductionTimer: () => void
  stopProductionTimer: (state: "stopped" | "completed") => void
  confirmPauseAndResume: () => void
  onSetTurno: (v: "diurno" | "nocturno") => void
  onSetGrupo: (v: "A" | "B" | "C") => void
  onSetOperador: (v: string) => void
  onSetAyudante: (v: string) => void
  onSetSupervisor: (v: string) => void
  onEntradaImpresaChange: (idx: number, v: string) => void
  onOpenImpresaLabel: (idx: number) => void
  onEntradaVirgenChange: (idx: number, v: string) => void
  onOpenVirgenLabel: (idx: number) => void
  onSalidaChange: (idx: number, v: string) => void
  onOpenSalidaLabel: (idx: number) => void
  onSetMetraje: (v: string) => void
  onSetAdhesivoEntrada: (v: string) => void
  onSetAdhesivoSobro: (v: string) => void
  onSetCatalizadorEntrada: (v: string) => void
  onSetCatalizadorSobro: (v: string) => void
  onSetAcetatoEntrada: (v: string) => void
  onSetAcetatoSobro: (v: string) => void
  onSetScrapTransparente: (v: string) => void
  onSetScrapImpreso: (v: string) => void
  onSetScrapLaminado: (v: string) => void
  virgenRechazadasKgRaw: string
  virgenMaterialesBuenosKgRaw: string
  onSetVirgenRechazadasKg: (v: string) => void
  onSetVirgenMaterialesBuenosKg: (v: string) => void
  labelEditorOpen: boolean
  labelEditorMode: LamLabelEditorMode
  labelEditorIndex: number
  labelEditorDraft: BobinaLabelMeta
  labelEditorError: string
  onLabelOpenChange: (open: boolean) => void
  onLabelDraftChange: (key: keyof BobinaLabelMeta, value: string) => void
  onLabelClear: () => void
  onLabelSave: () => void
}

export default function WorkOrderLaminacionOpsSection(props: Props) {
  const adhesivoConsumido = Number(props.adhesivoEntradaRaw || 0) - Number(props.adhesivoSobroRaw || 0)
  const catalizadorConsumido = Number(props.catalizadorEntradaRaw || 0) - Number(props.catalizadorSobroRaw || 0)
  const acetatoConsumido = Number(props.acetatoEntradaRaw || 0) - Number(props.acetatoSobroRaw || 0)
  const entradaImpresaCount = props.entradaImpresaBobinas.filter((v) => Number(v) > 0).length
  const entradaVirgenCount = props.entradaVirgenBobinas.filter((v) => Number(v) > 0).length

  return (
    <>
      <MesSectionShell title="Acumulado de la orden (todos los turnos)">
        <div className="mes-stat-grid mes-stat-grid--4">
          <MesStatTile label="Pedido total" value={`${props.pedidoTotalKg.toFixed(2)} Kg`} />
          <MesStatTile label="Producido" value={`${props.producidoAcumuladoKg.toFixed(2)} Kg`} tone="positive" />
          <MesStatTile label="Falta por producir" value={`${props.faltanteKg.toFixed(2)} Kg`} tone="negative" />
          <MesStatTile label="Registros / turnos" value={props.turnosRegistrados} />
        </div>
        <div className="mes-footer-bar mes-footer-bar--3">
          <div className="mes-footer-bar__item">
            Entrada impresa: <strong>{props.totalEntradaImpresa.toFixed(2)} Kg</strong>
          </div>
          <div className="mes-footer-bar__item">
            Salida laminada: <strong>{props.totalSalida.toFixed(2)} Kg</strong>
          </div>
          <div className="mes-footer-bar__item">
            Último turno: <strong>{props.ultimoTurnoLabel}</strong>
          </div>
        </div>
      </MesSectionShell>

      {props.archivedTurns.length > 0 ? (
        <Collapsible className="rounded-lg border border-slate-300 bg-white shadow-sm">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium hover:bg-muted/50">
            <span>Historial de turnos ({props.archivedTurns.length})</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="space-y-2 border-t px-3 pb-3 pt-1 text-xs">
              {props.archivedTurns.map((t) => (
                <li key={t.id} className="rounded border bg-background p-2">
                  <div className="font-medium">
                    {t.closed_at
                      ? new Date(t.closed_at).toLocaleString("es-VE")
                      : "—"}{" "}
                    · {t.turno || "?"} / {t.grupo || "?"} · {t.operador || "—"}
                    <span className="text-muted-foreground">
                      {" "}
                      (
                      {t.outcome === "orden_finalizada"
                        ? "orden finalizada"
                        : "fin de turno"}
                      )
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    Salida {t.total_salida_kg.toFixed(2)} Kg · Tiempo efectivo{" "}
                    {props.formatTimerHms(t.effective_sec)} · Tiempo muerto{" "}
                    {props.formatTimerHms(t.dead_sec)}
                  </div>
                  {t.pauses.length > 0 ? (
                    <div className="mt-1 text-muted-foreground">
                      Paradas: {t.pauses.length}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <MesSectionShell
        title={
          <span className="inline-flex items-center gap-2">
            <ReceiptText className="h-4 w-4 shrink-0" aria-hidden />
            Temporizador de producción
          </span>
        }
        headerRight={
          <Badge variant="secondary" className="text-xs">
            {props.timerState === "running"
              ? "En producción"
              : props.timerState === "paused"
                ? "En pausa"
                : props.timerState === "completed"
                  ? "Orden finalizada"
                  : props.timerState === "stopped"
                    ? "Turno cerrado"
                    : "Pendiente"}
          </Badge>
        }
      >
        <div className="mes-timer-grid">
          <MesTimerFace
            elapsedLabel={props.formatTimerHms(props.totalSec)}
            deadHms={props.formatTimerHms(props.deadSec)}
            effectiveHms={props.formatTimerHms(props.effectiveSec)}
            kgHora={props.kgHora}
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
                        onClick={props.startProductionTimer}
                        disabled={props.timerRunning || props.timerState === "completed"}
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
                        onClick={props.pauseProductionTimer}
                        disabled={!props.timerRunning}
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
                        onClick={() => props.stopProductionTimer("stopped")}
                        disabled={props.timerStopped || props.timerState === "pending"}
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
                        onClick={() => props.stopProductionTimer("completed")}
                        disabled={props.timerState === "completed" || props.timerState === "pending"}
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
        {props.timerPaused ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-medium text-amber-900">Registrar motivo de parada</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="ot-select" value={props.pauseReason} onChange={(e) => props.setPauseReason(e.target.value)}>
                <option value="">-- Seleccionar motivo --</option>
                {props.pauseReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
              <Input value={props.pauseObs} onChange={(e) => props.setPauseObs(e.target.value)} placeholder="Detalle breve (opcional)" className="ot-input-unified h-9" />
            </div>
            <div className="mt-2"><Button type="button" size="sm" onClick={props.confirmPauseAndResume}>Registrar y continuar</Button></div>
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

      <MesSectionShell title="Información del turno" subtle>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="ot-label">Turno</Label>
            <div className="mes-toggle-row mes-toggle-turno">
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                value={props.turno}
                onValueChange={(v) => {
                  if (!v) return
                  props.onSetTurno(v as "diurno" | "nocturno")
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
                value={props.grupo}
                onValueChange={(v) => {
                  if (!v) return
                  props.onSetGrupo(v as "A" | "B" | "C")
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
            <Input className="ot-input-unified h-9" value={props.operador} onChange={(e) => props.onSetOperador(e.target.value)} placeholder="Nombre operador" />
          </div>
          <div className="ot-field">
            <Label className="ot-label">Ayudante</Label>
            <Input className="ot-input-unified h-9" value={props.ayudante} onChange={(e) => props.onSetAyudante(e.target.value)} placeholder="Nombre ayudante" />
          </div>
          <div className="ot-field md:col-span-2">
            <Label className="ot-label">Supervisor</Label>
            <Input className="ot-input-unified h-9" value={props.supervisor} onChange={(e) => props.onSetSupervisor(e.target.value)} placeholder="Nombre supervisor" />
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell
        title="Entrada — bobinas impresas (laminación)"
        subtle
        bodyClassName="mes-section__body--flush"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-9">
          {props.entradaImpresaBobinas.map((val, idx) => (
            <div key={`ent-imp-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="ot-label">{idx + 1}</Label>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant={hasMeta(props.entradaImpresaMeta[idx]) ? "default" : "outline"}
                        className="h-5 w-5"
                        onClick={() => props.onOpenImpresaLabel(idx)}
                        title={`Etiqueta bobina impresa #${idx + 1} (laminación)`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{labelTooltipText(props.entradaImpresaMeta[idx])}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                className="ot-input-unified h-9"
                inputMode="decimal"
                value={val}
                onChange={(e) => props.onEntradaImpresaChange(idx, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 mes-stat-grid sm:grid-cols-2">
          <MesStatTile label="N° bobinas" value={entradaImpresaCount} />
          <MesStatTile label="Peso total" value={`${props.totalEntradaImpresa.toFixed(2)} Kg`} />
        </div>
      </MesSectionShell>

      <MesSectionShell
        title="Ingreso de material virgen (laminación)"
        subtle
        bodyClassName="mes-section__body--flush"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-9">
          {props.entradaVirgenBobinas.map((val, idx) => (
            <div key={`ent-virg-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="ot-label">{idx + 1}</Label>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant={hasMeta(props.entradaVirgenMeta[idx]) ? "default" : "outline"}
                        className="h-5 w-5"
                        onClick={() => props.onOpenVirgenLabel(idx)}
                        title={`Etiqueta bobina virgen #${idx + 1} (laminación)`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{labelTooltipText(props.entradaVirgenMeta[idx])}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                className="ot-input-unified h-9"
                inputMode="decimal"
                value={val}
                onChange={(e) => props.onEntradaVirgenChange(idx, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="ot-label">Bobinas rechazadas (Kg)</Label>
            <Input
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.virgenRechazadasKgRaw}
              onChange={(e) => props.onSetVirgenRechazadasKg(e.target.value)}
              placeholder="0"
            />
            <p className="text-muted-foreground text-[11px]">Material no conforme o rechazo de bobina virgen.</p>
          </div>
          <div className="space-y-1">
            <Label className="ot-label">Materiales buenos (Kg)</Label>
            <Input
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.virgenMaterialesBuenosKgRaw}
              onChange={(e) => props.onSetVirgenMaterialesBuenosKg(e.target.value)}
              placeholder="0"
            />
            <p className="text-muted-foreground text-[11px]">Material apto para reingreso a inventario.</p>
          </div>
        </div>
        <div className="mt-2 mes-stat-grid sm:grid-cols-2">
          <MesStatTile label="N° bobinas" value={entradaVirgenCount} />
          <MesStatTile label="Peso total" value={`${props.totalEntradaVirgen.toFixed(2)} Kg`} />
        </div>
      </MesSectionShell>

      <MesSectionShell title="Proceso — salida bobina laminada" subtle bodyClassName="mes-section__body--flush">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-9">
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
                        title={`Etiqueta bobina salida laminada #${idx + 1}`}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{labelTooltipText(props.salidaMeta[idx])}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                className="ot-input-unified h-9"
                inputMode="decimal"
                value={val}
                onChange={(e) => props.onSalidaChange(idx, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 mes-stat-grid mes-stat-grid--4">
          <MesStatTile label="N° bobinas" value={props.salidaBobinas.filter((v) => Number(v) > 0).length} />
          <MesStatTile label="Peso total" value={`${props.totalSalida.toFixed(2)} Kg`} />
          <MesStatTile label="Merma" value={`${props.mermaCalc.toFixed(2)} Kg`} />
          <div className="mes-stat-tile">
            <span className="mes-stat-tile__label">Metraje</span>
            <Input className="ot-input-unified mt-1 h-9" inputMode="decimal" value={props.metrajeRaw} onChange={(e) => props.onSetMetraje(e.target.value)} placeholder="0" />
          </div>
        </div>
      </MesSectionShell>

      <MesSectionShell title="Control de adhesivo" subtle>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Adhesivo (entrada/sobro)</span><div className="mt-1 grid grid-cols-2 gap-1"><Input className="ot-input-unified h-8" inputMode="decimal" value={props.adhesivoEntradaRaw} onChange={(e) => props.onSetAdhesivoEntrada(e.target.value)} /><Input className="ot-input-unified h-8" inputMode="decimal" value={props.adhesivoSobroRaw} onChange={(e) => props.onSetAdhesivoSobro(e.target.value)} /></div><p className="mt-1 text-xs">Consumo: {adhesivoConsumido.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Catalizador (entrada/sobro)</span><div className="mt-1 grid grid-cols-2 gap-1"><Input className="ot-input-unified h-8" inputMode="decimal" value={props.catalizadorEntradaRaw} onChange={(e) => props.onSetCatalizadorEntrada(e.target.value)} /><Input className="ot-input-unified h-8" inputMode="decimal" value={props.catalizadorSobroRaw} onChange={(e) => props.onSetCatalizadorSobro(e.target.value)} /></div><p className="mt-1 text-xs">Consumo: {catalizadorConsumido.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Acetato (entrada/sobro)</span><div className="mt-1 grid grid-cols-2 gap-1"><Input className="ot-input-unified h-8" inputMode="decimal" value={props.acetatoEntradaRaw} onChange={(e) => props.onSetAcetatoEntrada(e.target.value)} /><Input className="ot-input-unified h-8" inputMode="decimal" value={props.acetatoSobroRaw} onChange={(e) => props.onSetAcetatoSobro(e.target.value)} /></div><p className="mt-1 text-xs">Consumo: {acetatoConsumido.toFixed(2)} Lt</p></div>
        </div>
      </MesSectionShell>

      <MesSectionShell title="Scrap del turno (Kg)" subtle>
        <div className="grid gap-2 sm:grid-cols-4">
          <div><Label className="ot-label">Transparente</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapTransparenteRaw} onChange={(e) => props.onSetScrapTransparente(e.target.value)} placeholder="0" /></div>
          <div><Label className="ot-label">Impreso</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapImpresoRaw} onChange={(e) => props.onSetScrapImpreso(e.target.value)} placeholder="0" /></div>
          <div><Label className="ot-label">Laminado</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapLaminadoRaw} onChange={(e) => props.onSetScrapLaminado(e.target.value)} placeholder="0" /></div>
          <MesStatTile label="Total scrap" value={`${props.totalScrap.toFixed(2)} Kg`} />
        </div>
      </MesSectionShell>

      <MesSectionShell title="Resumen de producción" subtle>
        <div className="mes-stat-grid sm:grid-cols-2">
          <MesStatTile label="Bobinas impresas (entrada)" value={`${props.totalEntradaImpresa.toFixed(2)} Kg`} />
          <MesStatTile label="Bobinas virgen (entrada)" value={`${props.totalEntradaVirgen.toFixed(2)} Kg`} />
          <MesStatTile label="Total salida laminada" value={`${props.totalSalida.toFixed(2)} Kg`} />
          <MesStatTile label="Total scrap" value={`${props.totalScrap.toFixed(2)} Kg`} />
          <MesStatTile label="Merma calculada" value={`${props.mermaCalc.toFixed(2)} Kg`} />
          <MesStatTile label="% Refil" value={`${props.refilPct.toFixed(2)}%`} />
        </div>
      </MesSectionShell>

      <Dialog open={props.labelEditorOpen} onOpenChange={props.onLabelOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{lamLabelEditorTitle(props.labelEditorMode, props.labelEditorIndex)}</DialogTitle>
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

          {props.labelEditorError ? <p className="text-sm text-destructive">{props.labelEditorError}</p> : null}

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
    </>
  )
}
