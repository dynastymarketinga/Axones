import { Flag, Pause, Play, ReceiptText, Square } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LaminacionPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

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
  turno: string
  grupo: string
  operador: string
  ayudante: string
  supervisor: string
  entradaImpresaBobinas: string[]
  entradaVirgenBobinas: string[]
  salidaBobinas: string[]
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
  onEntradaVirgenChange: (idx: number, v: string) => void
  onSalidaChange: (idx: number, v: string) => void
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
}

export default function WorkOrderLaminacionOpsSection(props: Props) {
  const adhesivoConsumido = Number(props.adhesivoEntradaRaw || 0) - Number(props.adhesivoSobroRaw || 0)
  const catalizadorConsumido = Number(props.catalizadorEntradaRaw || 0) - Number(props.catalizadorSobroRaw || 0)
  const acetatoConsumido = Number(props.acetatoEntradaRaw || 0) - Number(props.acetatoSobroRaw || 0)

  return (
    <>
      <div className="mt-3 rounded-lg border border-cyan-200/70 bg-cyan-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-900">
          Acumulado de la orden (todos los turnos)
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Pedido total</span><p className="font-semibold">{props.pedidoTotalKg.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Producido</span><p className="font-semibold text-emerald-700">{props.producidoAcumuladoKg.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Falta por producir</span><p className="font-semibold text-rose-700">{props.faltanteKg.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Registros / turnos</span><p className="font-semibold">{props.turnosRegistrados}</p></div>
        </div>
        <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="rounded border bg-background px-2 py-1.5">Entrada impresa: <span className="font-semibold text-foreground">{props.totalEntradaImpresa.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background px-2 py-1.5">Salida laminada: <span className="font-semibold text-foreground">{props.totalSalida.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background px-2 py-1.5">Último turno: <span className="font-semibold text-foreground">{props.ultimoTurnoLabel}</span></div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-sky-200/70 bg-sky-50/40 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900"><ReceiptText className="h-4 w-4" />Temporizador de producción</div>
          <Badge variant="secondary" className="text-xs">
            {props.timerState === "running" ? "En producción" : props.timerState === "paused" ? "En pausa" : props.timerState === "completed" ? "Orden finalizada" : props.timerState === "stopped" ? "Turno cerrado" : "Pendiente"}
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-md border bg-background px-3 py-2">
            <div className="font-mono text-3xl font-bold text-sky-900">{props.formatTimerHms(props.totalSec)}</div>
            <p className="text-muted-foreground text-xs">Tiempo transcurrido</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded border bg-muted/30 p-2"><p className="text-muted-foreground text-[11px]">Tiempo muerto</p><p className="font-mono text-sm font-semibold text-red-600">{props.formatTimerHms(props.deadSec)}</p></div>
              <div className="rounded border bg-muted/30 p-2"><p className="text-muted-foreground text-[11px]">Tiempo efectivo</p><p className="font-mono text-sm font-semibold text-emerald-700">{props.formatTimerHms(props.effectiveSec)}</p></div>
              <div className="col-span-2 rounded border bg-muted/30 p-2 sm:col-span-1"><p className="text-muted-foreground text-[11px]">Kg/Hora estimado</p><p className="text-sm font-semibold">{props.kgHora}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={props.startProductionTimer} disabled={props.timerRunning || props.timerState === "completed"}><Play className="mr-1 h-4 w-4" />Iniciar</Button>
            <Button type="button" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={props.pauseProductionTimer} disabled={!props.timerRunning}><Pause className="mr-1 h-4 w-4" />Pausar</Button>
            <Button type="button" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => props.stopProductionTimer("stopped")} disabled={props.timerStopped || props.timerState === "pending"}><Square className="mr-1 h-4 w-4" />Fin turno</Button>
            <Button type="button" variant="destructive" onClick={() => props.stopProductionTimer("completed")} disabled={props.timerState === "completed" || props.timerState === "pending"}><Flag className="mr-1 h-4 w-4" />Finalizar</Button>
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
          <div className="space-y-1"><Label className="ot-label">Turno</Label><div className="grid grid-cols-2 gap-2"><Button type="button" variant={props.turno === "diurno" ? "default" : "outline"} onClick={() => props.onSetTurno("diurno")}>Diurno</Button><Button type="button" variant={props.turno === "nocturno" ? "default" : "outline"} onClick={() => props.onSetTurno("nocturno")}>Nocturno</Button></div></div>
          <div className="space-y-1"><Label className="ot-label">Grupo</Label><div className="grid grid-cols-3 gap-2">{(["A", "B", "C"] as const).map((g) => <Button key={g} type="button" variant={props.grupo === g ? "default" : "outline"} onClick={() => props.onSetGrupo(g)}>{g}</Button>)}</div></div>
          <div className="ot-field"><label className="ot-label">Operador</label><input className="ot-input" value={props.operador} onChange={(e) => props.onSetOperador(e.target.value)} placeholder="Nombre operador" /></div>
          <div className="ot-field"><label className="ot-label">Ayudante</label><input className="ot-input" value={props.ayudante} onChange={(e) => props.onSetAyudante(e.target.value)} placeholder="Nombre ayudante" /></div>
          <div className="ot-field md:col-span-2"><label className="ot-label">Supervisor</label><input className="ot-input" value={props.supervisor} onChange={(e) => props.onSetSupervisor(e.target.value)} placeholder="Nombre supervisor" /></div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-900">Ingreso de bobinas impresas (Kg)</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {props.entradaImpresaBobinas.map((val, idx) => <div key={`ent-imp-${idx}`} className="space-y-1"><Label className="ot-label">{idx + 1}</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={val} onChange={(e) => props.onEntradaImpresaChange(idx, e.target.value)} placeholder="0" /></div>)}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-rose-200/70 bg-rose-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-900">Ingreso de bobinas virgen (Kg)</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {props.entradaVirgenBobinas.map((val, idx) => <div key={`ent-virg-${idx}`} className="space-y-1"><Label className="ot-label">{idx + 1}</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={val} onChange={(e) => props.onEntradaVirgenChange(idx, e.target.value)} placeholder="0" /></div>)}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-violet-200/70 bg-violet-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-900">Bobinas de salida laminadas (Kg)</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {props.salidaBobinas.map((val, idx) => <div key={`sal-${idx}`} className="space-y-1"><Label className="ot-label">{idx + 1}</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={val} onChange={(e) => props.onSalidaChange(idx, e.target.value)} placeholder="0" /></div>)}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">N° bobinas</span><p className="font-semibold">{props.salidaBobinas.filter((v) => Number(v) > 0).length}</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Peso total</span><p className="font-semibold">{props.totalSalida.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Merma</span><p className="font-semibold">{props.mermaCalc.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Metraje</span><Input className="ot-input-unified mt-1 h-8" inputMode="decimal" value={props.metrajeRaw} onChange={(e) => props.onSetMetraje(e.target.value)} placeholder="0" /></div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-fuchsia-200/70 bg-fuchsia-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-900">Control de adhesivo</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Adhesivo (entrada/sobro)</span><div className="mt-1 grid grid-cols-2 gap-1"><Input className="ot-input-unified h-8" inputMode="decimal" value={props.adhesivoEntradaRaw} onChange={(e) => props.onSetAdhesivoEntrada(e.target.value)} /><Input className="ot-input-unified h-8" inputMode="decimal" value={props.adhesivoSobroRaw} onChange={(e) => props.onSetAdhesivoSobro(e.target.value)} /></div><p className="mt-1 text-xs">Consumo: {adhesivoConsumido.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Catalizador (entrada/sobro)</span><div className="mt-1 grid grid-cols-2 gap-1"><Input className="ot-input-unified h-8" inputMode="decimal" value={props.catalizadorEntradaRaw} onChange={(e) => props.onSetCatalizadorEntrada(e.target.value)} /><Input className="ot-input-unified h-8" inputMode="decimal" value={props.catalizadorSobroRaw} onChange={(e) => props.onSetCatalizadorSobro(e.target.value)} /></div><p className="mt-1 text-xs">Consumo: {catalizadorConsumido.toFixed(2)} Kg</p></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Acetato (entrada/sobro)</span><div className="mt-1 grid grid-cols-2 gap-1"><Input className="ot-input-unified h-8" inputMode="decimal" value={props.acetatoEntradaRaw} onChange={(e) => props.onSetAcetatoEntrada(e.target.value)} /><Input className="ot-input-unified h-8" inputMode="decimal" value={props.acetatoSobroRaw} onChange={(e) => props.onSetAcetatoSobro(e.target.value)} /></div><p className="mt-1 text-xs">Consumo: {acetatoConsumido.toFixed(2)} Lt</p></div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-orange-200/70 bg-orange-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-900">Scrap del turno (Kg)</div>
        <div className="grid gap-2 sm:grid-cols-4">
          <div><Label className="ot-label">Transparente</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapTransparenteRaw} onChange={(e) => props.onSetScrapTransparente(e.target.value)} placeholder="0" /></div>
          <div><Label className="ot-label">Impreso</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapImpresoRaw} onChange={(e) => props.onSetScrapImpreso(e.target.value)} placeholder="0" /></div>
          <div><Label className="ot-label">Laminado</Label><Input className="ot-input-unified h-9" inputMode="decimal" value={props.scrapLaminadoRaw} onChange={(e) => props.onSetScrapLaminado(e.target.value)} placeholder="0" /></div>
          <div className="rounded border bg-background p-2 text-sm"><span className="text-muted-foreground">Total scrap</span><p className="font-semibold">{props.totalScrap.toFixed(2)} Kg</p></div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide">Resumen de producción</div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded border bg-background p-2">Bobinas impresas (entrada): <span className="font-semibold">{props.totalEntradaImpresa.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Bobinas virgen (entrada): <span className="font-semibold">{props.totalEntradaVirgen.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Total salida laminada: <span className="font-semibold">{props.totalSalida.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Total scrap: <span className="font-semibold">{props.totalScrap.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">Merma calculada: <span className="font-semibold">{props.mermaCalc.toFixed(2)} Kg</span></div>
          <div className="rounded border bg-background p-2">% Refil: <span className="font-semibold">{props.refilPct.toFixed(2)}%</span></div>
        </div>
      </div>
    </>
  )
}
