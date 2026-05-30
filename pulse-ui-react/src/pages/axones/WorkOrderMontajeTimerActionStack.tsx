import type { MontajeTimerActionFlags, MontajeTimerConfirmKey } from "./montaje-timer-actions"
import { WorkOrderMesTimerActionStack } from "./WorkOrderMesTimerActionStack"

type Props = {
  flags: MontajeTimerActionFlags
  onRequestConfirm: (key: MontajeTimerConfirmKey) => void
  onPreview: () => void
  canFinalizeOrder: boolean
  areaFinalizada: boolean
}

/** @deprecated Use WorkOrderMesTimerActionStack */
export function WorkOrderMontajeTimerActionStack(props: Props) {
  return <WorkOrderMesTimerActionStack {...props} areaLabel="montaje" />
}
