"use client"

/** Vigilancia registrar — UI Próximamente. API comentada en backend. */
import { Shield } from "lucide-react"

import { AxonesModuleComingSoon } from "@/components/axones/AxonesModuleComingSoon"

export default function GateMovementNewPage() {
  return (
    <AxonesModuleComingSoon
      title="Registrar entrada / salida"
      subtitle="Registre entradas y salidas en la caseta."
      icon={Shield}
      message="Próximamente podrá registrar entradas, salidas y adjuntar fotos desde esta pantalla."
    />
  )
}
