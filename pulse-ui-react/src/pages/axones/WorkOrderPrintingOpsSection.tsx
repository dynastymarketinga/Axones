import { ArrowUpRight, Flag, Pause, Play, ReceiptText, Square } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type PrintingPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

export type BobinaLabelMeta = {
  fecha: string
  hora: string
  referencia: string
  lote: string
  proveedor: string
  operador: string
  metraje: string
  peso: string
  medida_ancho: string
  tratamiento_interno: string
  tratamiento_externo: string
  maquina_origen: string
  pedido_lote: string
}

type LabelEditorMode = "entrada" | "salida"

type Props = {
  pedidoTotalKg: number
  producidoAcumuladoKg: number
  faltanteKg: number
  turnosRegistrados: number
  totalEntrada: number
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
  salidaBobinas: string[]
  salidaMeta: BobinaLabelMeta[]
  mermaCalc: number
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
  stopProductionTimer: (state: "stopped" | "completed") => void
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
  onOpenReturnModal: () => void
  onSalidaChange: (idx: number, v: string) => void
  onOpenSalidaLabel: (idx: number) => void
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
  return (
    <>
      <div className="mt-3 rounded-lg border border-cyan-200/70 bg-cyan-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-900">
          Acumulado de la orden (todos los turnos)
        </div>
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
            Total entrada acumulada: <span className="font-semibold text-foreground">{props.totalEntrada.toFixed(2)} Kg</span>
          </div>
          <div className="rounded border bg-background px-2 py-1.5">
            Total scrap acumulado: <span className="font-semibold text-foreground">{props.totalScrap.toFixed(2)} Kg</span>
          </div>
          <div className="rounded border bg-background px-2 py-1.5">
            Último turno: <span className="font-semibold text-foreground">{props.ultimoTurnoLabel}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-sky-200/70 bg-sky-50/40 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900">
            <ReceiptText className="h-4 w-4" />
            Temporizador de producción
          </div>
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
        </div>
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
            <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={props.startProductionTimer} disabled={props.timerRunning || props.timerState === "completed"}>
              <Play className="mr-1 h-4 w-4" />
              Iniciar
            </Button>
            <Button type="button" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={props.pauseProductionTimer} disabled={!props.timerRunning}>
              <Pause className="mr-1 h-4 w-4" />
              Pausar
            </Button>
            <Button type="button" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => props.stopProductionTimer("stopped")} disabled={props.timerStopped || props.timerState === "pending"}>
              <Square className="mr-1 h-4 w-4" />
              Fin turno
            </Button>
            <Button type="button" variant="destructive" onClick={() => props.stopProductionTimer("completed")} disabled={props.timerState === "completed" || props.timerState === "pending"}>
              <Flag className="mr-1 h-4 w-4" />
              Finalizar
            </Button>
          </div>
        </div>
        {props.timerPaused ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-medium text-amber-900">Registrar motivo de parada</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="ot-select" value={props.pauseReason} onChange={(e) => props.setPauseReason(e.target.value)}>
                <option value="">-- Seleccionar motivo --</option>
                {props.pauseReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <Input value={props.pauseObs} onChange={(e) => props.setPauseObs(e.target.value)} placeholder="Detalle breve (opcional)" className="ot-input-unified h-9" />
            </div>
            <div className="mt-2">
              <Button type="button" size="sm" onClick={props.confirmPauseAndResume}>
                Registrar y continuar
              </Button>
            </div>
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

      <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-900">Información del turno</div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="ot-label">Turno</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={props.impTurno === "diurno" ? "default" : "outline"} onClick={() => props.onSetTurno("diurno")}>Diurno</Button>
              <Button type="button" variant={props.impTurno === "nocturno" ? "default" : "outline"} onClick={() => props.onSetTurno("nocturno")}>Nocturno</Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="ot-label">Grupo</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["A", "B", "C"] as const).map((g) => (
                <Button key={g} type="button" variant={props.impGrupo === g ? "default" : "outline"} onClick={() => props.onSetGrupo(g)}>
                  {g}
                </Button>
              ))}
            </div>
          </div>
          <div className="ot-field">
            <label className="ot-label">Operador</label>
            <input className="ot-input" value={props.impOperador} onChange={(e) => props.onSetOperador(e.target.value)} placeholder="Nombre operador" />
          </div>
          <div className="ot-field">
            <label className="ot-label">Ayudante</label>
            <input className="ot-input" value={props.impAyudante} onChange={(e) => props.onSetAyudante(e.target.value)} placeholder="Nombre ayudante" />
          </div>
          <div className="ot-field md:col-span-2">
            <label className="ot-label">Supervisor</label>
            <input className="ot-input" value={props.impSupervisor} onChange={(e) => props.onSetSupervisor(e.target.value)} placeholder="Nombre supervisor" />
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-900">Ingreso de material por bobina (Kg)</div>
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
              <Input className="ot-input-unified h-9" inputMode="decimal" value={val} onChange={(e) => props.onEntradaChange(idx, e.target.value)} placeholder="0" />
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Total entrada</span>
            <p className="font-semibold">{props.totalEntrada.toFixed(2)} Kg</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Dev. buena</span>
            <Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={props.devolucionBuenaRaw} onChange={(e) => props.onSetDevolucionBuena(e.target.value)} placeholder="0" />
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Dev. rechazada</span>
            <Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={props.devolucionRechazadaRaw} onChange={(e) => props.onSetDevolucionRechazada(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="mt-2">
          <Button type="button" variant="outline" onClick={props.onOpenReturnModal}>
            Registrar devolución real
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-violet-200/70 bg-violet-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-900">Proceso - pesos netos por bobina (Kg)</div>
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
              <Input className="ot-input-unified h-9" inputMode="decimal" value={val} onChange={(e) => props.onSalidaChange(idx, e.target.value)} placeholder="0" />
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
            <span className="text-muted-foreground">Merma</span>
            <p className="font-semibold">{props.mermaCalc.toFixed(2)} Kg</p>
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Metraje</span>
            <Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={props.metrajeRaw} onChange={(e) => props.onSetMetraje(e.target.value)} placeholder="0" />
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-orange-200/70 bg-orange-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-900">Scrap del turno (Kg)</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label className="ot-label">Transparente</Label>
            <Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapTransparenteRaw} onChange={(e) => props.onSetScrapTransparente(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label className="ot-label">Impreso</Label>
            <Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapImpresoRaw} onChange={(e) => props.onSetScrapImpreso(e.target.value)} placeholder="0" />
          </div>
          <div className="rounded border bg-background p-2 text-sm">
            <span className="text-muted-foreground">Total scrap</span>
            <p className="font-semibold">{props.totalScrap.toFixed(2)} Kg</p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide">Resumen de producción</div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded border bg-background p-2">Total material entrada: <span className="font-semibold">{props.totalEntrada.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Devolución buena: <span className="font-semibold">{props.devolucionBuena.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Devolución rechazada: <span className="font-semibold">{props.devolucionRechazada.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Material consumido: <span className="font-semibold">{props.materialConsumido.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Total salida: <span className="font-semibold">{props.totalSalida.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Total scrap: <span className="font-semibold">{props.totalScrap.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Merma calculada: <span className="font-semibold">{props.mermaCalc.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">% Refil: <span className="font-semibold">{props.refilPct.toFixed(2)}%</span></div>
        </div>
      </div>

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
