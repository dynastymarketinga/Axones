"use client"

import type { MesBandejaMes } from "@/lib/mes-timer-band-shared"

import { MesBandejaOtTimesSummary } from "@/components/axones/printing-bandeja-modals"

export function MesBandejaTimesModalBody({ mesBand }: { mesBand: MesBandejaMes }) {
  return (
    <div className="space-y-3">
      <MesBandejaOtTimesSummary mesBand={mesBand} />
      <p className="text-muted-foreground text-xs leading-relaxed">
        Los totales incluyen todos los turnos guardados en la OT. Para arranque, desmontaje y detalle por turno,
        abra la OT en Producción.
      </p>
    </div>
  )
}
