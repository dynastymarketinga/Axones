"use client"

/** Calidad — UI Próximamente. Implementación API/listado comentada en backend. */
import { ClipboardCheck } from "lucide-react"

import { AxonesModuleComingSoon } from "@/components/axones/AxonesModuleComingSoon"

export default function QualityWorkOrderPage() {
  return (
    <AxonesModuleComingSoon
      title="Calidad"
      subtitle="Reporte de calidad por orden de trabajo y certificado imprimible para cliente."
      icon={ClipboardCheck}
      message="Próximamente podrá registrar calidad por OT y generar certificados para el cliente."
    />
  )
}
