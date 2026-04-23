"use client"

import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AxonesChatPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Asistente Axones
        </h1>
        <p className="text-muted-foreground text-sm">
          Módulo de chat previsto en el alcance del sistema. Aquí se integrará
          el bot cuando exista endpoint y políticas de datos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            No hay servicio de conversación configurado en el API Laravel
            actual. Esta pantalla evita enlazar al chat de demostración de la
            plantilla Pulse.
          </p>
          <Button type="button" variant="outline" asChild>
            <Link to="/axones/resumen">Volver al panel</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
