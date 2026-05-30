/** Re-export genérico; Montaje usa las mismas claves que el resto de áreas MES. */
export type {
  MesTimerActionFlags as MontajeTimerActionFlags,
  MesTimerConfirmKey as MontajeTimerConfirmKey,
} from "./mes-timer-actions"

import { getMesTimerConfirm, mesTimerConfirmNeedsActiveTurno } from "./mes-timer-actions"

export { mesTimerConfirmNeedsActiveTurno }

export const MONTAJE_TIMER_CONFIRM = getMesTimerConfirm("montaje")
