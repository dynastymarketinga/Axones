export type MesTimerAreaKey = "montaje" | "impresion" | "laminacion" | "corte"

export type MesTimerConfirmKey =
  | "startArranque"
  | "stopArranque"
  | "startProduction"
  | "stopProduction"
  | "startDemount"
  | "stopDemount"
  | "startDeadTime"
  | "endDeadTime"
  | "cerrarTurno"
  | "finalizarOrden"

export type MesTimerConfirmCopy = {
  tone: "emerald" | "sky" | "indigo" | "violet" | "amber" | "orange" | "rose" | "red"
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
}

const AREA_FINALIZAR: Record<MesTimerAreaKey, { title: string; description: string }> = {
  montaje: {
    title: "Finalizar orden (área Montaje)",
    description: "Finalizará el área de Montaje en esta orden de trabajo.",
  },
  impresion: {
    title: "Finalizar orden (área Impresión)",
    description: "Finalizará el área de Impresión en esta orden de trabajo.",
  },
  laminacion: {
    title: "Finalizar orden (área Laminación)",
    description: "Finalizará el área de Laminación en esta orden de trabajo.",
  },
  corte: {
    title: "Finalizar orden (área Corte)",
    description: "Finalizará el área de Corte en esta orden de trabajo.",
  },
}

const BASE_CONFIRM: Record<MesTimerConfirmKey, MesTimerConfirmCopy> = {
  startArranque: {
    tone: "amber",
    title: "Iniciar arranque",
    description:
      "Registrará el inicio de arranque (preparación / puesta a punto). No cuenta como tiempo efectivo de producción.",
    confirmLabel: "Sí, iniciar arranque",
  },
  stopArranque: {
    tone: "orange",
    title: "Parar arranque",
    description: "Detendrá el tiempo de arranque y guardará el tramo en el turno.",
    confirmLabel: "Sí, parar arranque",
  },
  startProduction: {
    tone: "emerald",
    title: "Inicio de producción",
    description:
      "Iniciará el tiempo efectivo de producción. El arranque y otras fases deben estar detenidos.",
    confirmLabel: "Sí, iniciar producción",
  },
  stopProduction: {
    tone: "sky",
    title: "Fin de producción",
    description:
      "Detendrá el tiempo efectivo de producción sin cerrar el turno de planta. Podrá volver a iniciar producción después.",
    confirmLabel: "Sí, finalizar producción",
  },
  startDemount: {
    tone: "indigo",
    title: "Inicio de desmontaje",
    description: "Iniciará el tiempo de desmontaje en máquina.",
    confirmLabel: "Sí, iniciar desmontaje",
  },
  stopDemount: {
    tone: "violet",
    title: "Fin de desmontaje",
    description: "Detendrá el tiempo de desmontaje y lo acumulará en el turno.",
    confirmLabel: "Sí, finalizar desmontaje",
  },
  startDeadTime: {
    tone: "amber",
    title: "Iniciar tiempo muerto",
    description:
      "Pausará la producción y pedirá el motivo de parada (tiempo muerto). No cierra el turno de planta.",
    confirmLabel: "Sí, registrar parada",
  },
  endDeadTime: {
    tone: "emerald",
    title: "Fin de parada / reanudar producción",
    description:
      "Reanudará el tiempo efectivo de producción. Si aún no guardó el motivo de parada, hágalo antes.",
    confirmLabel: "Sí, reanudar producción",
  },
  cerrarTurno: {
    tone: "rose",
    title: "Fin del turno",
    description:
      "Cerrará el turno de planta en curso y guardará arranque, desmontaje, producción y paradas.",
    confirmLabel: "Sí, finalizar turno",
  },
  finalizarOrden: {
    tone: "red",
    title: "Finalizar orden",
    description: "",
    confirmLabel: "Sí, finalizar área",
    destructive: true,
  },
}

/** Finalizar área no requiere turno de planta abierto (p. ej. entre turnos). */
export function mesTimerConfirmNeedsActiveTurno(key: MesTimerConfirmKey): boolean {
  return key !== "finalizarOrden"
}

export function getMesTimerConfirm(area: MesTimerAreaKey): Record<MesTimerConfirmKey, MesTimerConfirmCopy> {
  const fin = AREA_FINALIZAR[area]
  return {
    ...BASE_CONFIRM,
    finalizarOrden: {
      ...BASE_CONFIRM.finalizarOrden,
      title: fin.title,
      description: fin.description,
    },
  }
}

export type MesTimerActionFlags = {
  canStartArranque: boolean
  canStopArranque: boolean
  canStartProduction: boolean
  canStopProduction: boolean
  canStartDemount: boolean
  canStopDemount: boolean
  canStartDeadTime: boolean
  canEndDeadTime: boolean
  canCerrarTurno: boolean
  canFinalizarOrden: boolean
  canPreview: boolean
}

export function buildMesTimerActionFlags(opts: {
  base: boolean
  arranqueRunning: boolean
  demountRunning: boolean
  timerRunning: boolean
  timerPaused: boolean
  canFinalizeOrder: boolean
  areaFinalizada: boolean
  controlReadOnly: boolean
  timerState: string
  canPreview: boolean
}): MesTimerActionFlags {
  const {
    base: baseOk,
    arranqueRunning,
    demountRunning,
    timerRunning,
    timerPaused,
    canFinalizeOrder,
    areaFinalizada,
    controlReadOnly,
    timerState,
    canPreview,
  } = opts
  const base = baseOk && timerState !== "completed"
  return {
    canStartArranque: base && !arranqueRunning && !demountRunning && !timerRunning && !timerPaused,
    canStopArranque: base && arranqueRunning,
    canStartDemount: base && !demountRunning && !arranqueRunning && !timerRunning && !timerPaused,
    canStopDemount: base && demountRunning,
    canStartProduction:
      base && !timerRunning && !timerPaused && !arranqueRunning && !demountRunning,
    canStopProduction: base && timerRunning,
    canStartDeadTime: base && timerRunning,
    canEndDeadTime: base && timerPaused,
    canCerrarTurno: base,
    canFinalizarOrden: canFinalizeOrder && !areaFinalizada && (!controlReadOnly || canFinalizeOrder),
    canPreview,
  }
}
