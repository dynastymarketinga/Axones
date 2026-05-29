"use client"

import { Navigate, useSearchParams } from "react-router-dom"

/** Redirige la ruta antigua al reporte unificado de producción y tiempos. */
export default function ReportsTimesPage() {
  const [searchParams] = useSearchParams()
  const ot = searchParams.get("ot")
  const target = ot ? `/reportes/produccion?ot=${encodeURIComponent(ot)}` : "/reportes/produccion"
  return <Navigate to={target} replace />
}
