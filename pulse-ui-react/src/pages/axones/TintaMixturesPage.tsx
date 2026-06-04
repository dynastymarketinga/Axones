"use client"

import { Navigate } from "react-router-dom"

/** Recetario histórico: redirige al área Tintas (mezcla integrada en producción y consumo). */
export default function TintaMixturesPage() {
  return <Navigate to="/tintas?vista=mezcla" replace />
}
