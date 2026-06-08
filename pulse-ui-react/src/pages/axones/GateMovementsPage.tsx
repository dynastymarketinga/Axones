"use client"

/** Vigilancia historial — UI Próximamente. API comentada en backend. */
import { Shield } from "lucide-react"

import { AxonesModuleComingSoon } from "@/components/axones/AxonesModuleComingSoon"

export default function GateMovementsPage() {
  return (
    <AxonesModuleComingSoon
      title="Vigilancia"
      subtitle="Registro de entradas y salidas por la vigilancia."
      icon={Shield}
      message="Próximamente podrá consultar el historial de movimientos en caseta."
    />
  )
}
