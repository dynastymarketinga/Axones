import {
  getMesTimerConfirm,
  mesTimerConfirmNeedsActiveTurno,
  type MesTimerActionFlags,
  type MesTimerConfirmCopy,
  type MesTimerConfirmKey,
} from "./mes-timer-actions"

export type MontajeTimerConfirmKey = MesTimerConfirmKey | "startMontajeOp" | "stopMontajeOp"

export type MontajeTimerActionFlags = MesTimerActionFlags & {
  canStartMontajeOp: boolean
  canStopMontajeOp: boolean
}

const MONTAJE_OP_CONFIRM: Record<"startMontajeOp" | "stopMontajeOp", MesTimerConfirmCopy> = {
  startMontajeOp: {
    tone: "emerald",
    title: "Iniciar montaje (operación)",
    description:
      "Iniciará el tiempo de operación de montaje en máquina (limpieza, recorridos). No es el tiempo efectivo de producción.",
    confirmLabel: "Sí, iniciar montaje",
  },
  stopMontajeOp: {
    tone: "sky",
    title: "Finalizar montaje (operación)",
    description: "Detendrá el tiempo de operación de montaje y lo acumulará en el turno.",
    confirmLabel: "Sí, finalizar montaje",
  },
}

export const MONTAJE_TIMER_CONFIRM: Record<MontajeTimerConfirmKey, MesTimerConfirmCopy> = {
  ...getMesTimerConfirm("montaje"),
  ...MONTAJE_OP_CONFIRM,
}

export { mesTimerConfirmNeedsActiveTurno }

export function montajeTimerConfirmNeedsActiveTurno(key: MontajeTimerConfirmKey): boolean {
  if (key === "finalizarOrden") return false
  return true
}
