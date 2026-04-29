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
          Asistente conversacional: cuando esté disponible, se integrará en
          esta pantalla.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Aún no hay un asistente de conversación activo. Esta pantalla
            sustituye al chat de demostración de la plantilla.
          </p>
          <Button type="button" variant="outline" asChild>
            <Link to="/resumen">Volver al panel</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
