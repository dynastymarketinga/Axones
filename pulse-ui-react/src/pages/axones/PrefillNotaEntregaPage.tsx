"use client"

import { useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PrefillNotaEntregaPage() {
  const [woId, setWoId] = useState("")
  const [loading, setLoading] = useState(false)
  const [json, setJson] = useState<unknown>(null)

  async function load() {
    const id = Number(woId)
    if (!Number.isFinite(id) || id < 1) {
      toast.error("Indica un ID de orden de trabajo válido.")
      return
    }
    setLoading(true)
    setJson(null)
    try {
      const data = await apiFetch<unknown>(
        `work-orders/${id}/nota-entrega/prefill`,
      )
      setJson(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la información de la orden.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Vista previa de nota de entrega
        </h1>
        <p className="text-muted-foreground text-sm">
          Revise cantidades desde corte antes de emitir la nota.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orden de trabajo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ne-wo">ID de orden de trabajo</Label>
            <Input
              id="ne-wo"
              inputMode="numeric"
              placeholder="Ejemplo: 12"
              value={woId}
              onChange={(ev) => setWoId(ev.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "…" : "Cargar"}
          </Button>
        </CardContent>
      </Card>

      {json != null ? (
        <pre className="max-h-[70vh] overflow-auto rounded-xl border bg-muted p-4 text-xs">
          {JSON.stringify(json, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
