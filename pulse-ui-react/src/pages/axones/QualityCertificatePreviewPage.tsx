"use client"

/** Calidad certificado — UI Próximamente. API comentada en backend. */
import { ClipboardCheck } from "lucide-react"

import { AxonesModuleComingSoon } from "@/components/axones/AxonesModuleComingSoon"

export default function QualityCertificatePreviewPage() {
  return (
    <AxonesModuleComingSoon
      title="Vista previa de certificado"
      subtitle="Previsualización del certificado de calidad para el cliente."
      icon={ClipboardCheck}
      message="Próximamente podrá previsualizar e imprimir certificados de calidad."
    />
  )
}
