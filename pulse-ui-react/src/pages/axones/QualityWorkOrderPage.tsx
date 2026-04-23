"use client"

import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiDownloadFile, apiFetch, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function QualityWorkOrderPage() {
  const [searchParams] = useSearchParams()
  const otFromQuery = searchParams.get("ot") ?? ""

  const [woId, setWoId] = useState(otFromQuery)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<unknown>(null)

  useEffect(() => {
    if (otFromQuery) setWoId(otFromQuery)
  }, [otFromQuery])

  async function load() {
    const id = Number(woId)
    if (!Number.isFinite(id) || id < 1) {
      toast.error("Indica un ID de OT válido.")
      return
    }
    setLoading(true)
    setData(null)
    try {
      const q = await apiFetch<unknown>(`work-orders/${id}/quality`)
      setData(q)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar calidad.")
    } finally {
      setLoading(false)
    }
  }

  async function downloadCertificate() {
    const id = Number(woId)
    if (!Number.isFinite(id) || id < 1) {
      toast.error("Indica un ID de OT válido.")
      return
    }
    try {
      await apiDownloadFile(`work-orders/${id}/quality/certificate`, {
        fallbackName: `certificado-calidad-ot-${id}.pdf`,
      })
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el certificado.")
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calidad</h1>
        <p className="text-muted-foreground text-sm">
          Certificado por OT ·{" "}
          <code>/work-orders/{"{id}"}/quality</code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seleccionar OT</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="q-wo">work_order_id</Label>
            <Input
              id="q-wo"
              inputMode="numeric"
              value={woId}
              onChange={(ev) => setWoId(ev.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "…" : "Cargar datos"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void downloadCertificate()}
          >
            Descargar certificado
          </Button>
          <Button variant="outline" asChild>
            <Link to="/axones/ordenes-trabajo">Ir a listado OT</Link>
          </Button>
        </CardContent>
      </Card>

      {data != null ? (
        <pre className="max-h-[70vh] overflow-auto rounded-xl border bg-muted p-4 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
