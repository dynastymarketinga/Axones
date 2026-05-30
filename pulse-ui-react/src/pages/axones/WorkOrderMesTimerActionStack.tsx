import {
  CirclePlay,
  FileSearch,
  Flag,
  LogOut,
  Square,
  TimerOff,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import type { MesTimerActionFlags, MesTimerAreaKey, MesTimerConfirmKey } from "./mes-timer-actions"

type Props = {
  flags: MesTimerActionFlags
  onRequestConfirm: (key: MesTimerConfirmKey) => void
  onPreview: () => void
  canFinalizeOrder: boolean
  areaFinalizada: boolean
  /** Texto del botón y tooltip de finalizar área. */
  areaLabel: MesTimerAreaKey
}

const FINALIZAR_TOOLTIP: Record<MesTimerAreaKey, string> = {
  montaje: "Finaliza el área Montaje en la OT.",
  impresion: "Finaliza el área Impresión en la OT.",
  laminacion: "Finaliza el área Laminación en la OT.",
  corte: "Finaliza el área Corte en la OT.",
}

function ActionBtn({
  label,
  className,
  ariaLabel,
  disabled,
  onClick,
  icon,
  tooltip,
}: {
  label: string
  className: string
  ariaLabel: string
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
  tooltip: string
}) {
  return (
    <div className="mes-timer-action-labeled">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={`mes-timer-action-btn ${className}`}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={onClick}
          >
            {icon}
            <span>{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function WorkOrderMesTimerActionStack({
  flags,
  onRequestConfirm,
  onPreview,
  canFinalizeOrder,
  areaFinalizada,
  areaLabel,
}: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="mes-timer-action-stack mes-timer-action-stack--scroll">
        <ActionBtn
          label="Iniciar arranque"
          className="mes-btn-arranque"
          ariaLabel="Iniciar arranque"
          disabled={!flags.canStartArranque}
          onClick={() => onRequestConfirm("startArranque")}
          icon={<Wrench className="shrink-0" aria-hidden />}
          tooltip="Preparación / puesta a punto (no es tiempo efectivo)."
        />
        <ActionBtn
          label="Parar arranque"
          className="mes-btn-arranque-stop"
          ariaLabel="Parar arranque"
          disabled={!flags.canStopArranque}
          onClick={() => onRequestConfirm("stopArranque")}
          icon={<Square className="shrink-0" aria-hidden />}
          tooltip="Detiene el tiempo de arranque."
        />
        <ActionBtn
          label="Inicio de producción"
          className="mes-btn-primary"
          ariaLabel="Inicio de producción"
          disabled={!flags.canStartProduction}
          onClick={() => onRequestConfirm("startProduction")}
          icon={<CirclePlay className="shrink-0" aria-hidden />}
          tooltip="Tiempo efectivo de producción."
        />
        <ActionBtn
          label="Fin de producción"
          className="mes-btn-production-stop"
          ariaLabel="Fin de producción"
          disabled={!flags.canStopProduction}
          onClick={() => onRequestConfirm("stopProduction")}
          icon={<Square className="shrink-0" aria-hidden />}
          tooltip="Detiene producción sin cerrar el turno."
        />
        <ActionBtn
          label="Inicio de desmontaje"
          className="mes-btn-demount"
          ariaLabel="Inicio de desmontaje"
          disabled={!flags.canStartDemount}
          onClick={() => onRequestConfirm("startDemount")}
          icon={<Wrench className="shrink-0" aria-hidden />}
          tooltip="Inicia tiempo de desmontaje."
        />
        <ActionBtn
          label="Fin de desmontaje"
          className="mes-btn-demount-stop"
          ariaLabel="Fin de desmontaje"
          disabled={!flags.canStopDemount}
          onClick={() => onRequestConfirm("stopDemount")}
          icon={<Square className="shrink-0" aria-hidden />}
          tooltip="Detiene el tiempo de desmontaje."
        />
        <ActionBtn
          label="Iniciar tiempo muerto"
          className="mes-btn-secondary"
          ariaLabel="Iniciar tiempo muerto"
          disabled={!flags.canStartDeadTime}
          onClick={() => onRequestConfirm("startDeadTime")}
          icon={<TimerOff className="shrink-0" aria-hidden />}
          tooltip="Parada con motivo (no cierra turno)."
        />
        <ActionBtn
          label="Fin de parada"
          className="mes-btn-primary"
          ariaLabel="Fin de parada y reanudar producción"
          disabled={!flags.canEndDeadTime}
          onClick={() => onRequestConfirm("endDeadTime")}
          icon={<CirclePlay className="shrink-0" aria-hidden />}
          tooltip="Reanuda el tiempo efectivo tras la parada."
        />
        <ActionBtn
          label="Vista previa"
          className="mes-btn-muted"
          ariaLabel="Vista previa"
          disabled={!flags.canPreview}
          onClick={onPreview}
          icon={<FileSearch className="shrink-0" aria-hidden />}
          tooltip="Vista previa del reporte (si hay actividad registrada)."
        />
        <div className="mes-timer-action-labeled mt-2 border-t border-border/60 pt-2">
          <ActionBtn
            label="Fin del turno"
            className="mes-btn-danger-outline"
            ariaLabel="Fin del turno"
            disabled={!flags.canCerrarTurno}
            onClick={() => onRequestConfirm("cerrarTurno")}
            icon={<LogOut className="shrink-0" aria-hidden />}
            tooltip="Cierra el turno de planta en curso."
          />
        </div>
        {canFinalizeOrder && !areaFinalizada ? (
          <ActionBtn
            label="Finalizar orden"
            className="mes-btn-destructive-solid"
            ariaLabel="Finalizar orden"
            disabled={!flags.canFinalizarOrden}
            onClick={() => onRequestConfirm("finalizarOrden")}
            icon={<Flag className="shrink-0" aria-hidden />}
            tooltip={FINALIZAR_TOOLTIP[areaLabel]}
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}
