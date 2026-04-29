"use client"

import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetchFormData, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function GateMovementNewPage() {
  const [direction, setDirection] = useState<string>("in")
  const [notes, setNotes] = useState("")
  const [occurredAt, setOccurredAt] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const fd = new FormData()
    fd.set("direction", direction)
    if (notes.trim()) fd.set("notes", notes.trim())
    if (occurredAt) fd.set("occurred_at", occurredAt)
    if (photo) fd.set("photo", photo)

    setSaving(true)
    try {
      await apiFetchFormData("gate-movements", fd)
      toast.success("Registro de vigilancia guardado.")
      setNotes("")
      setPhoto(null)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Registrar entrada / salida
          </h1>
          <p className="text-muted-foreground text-sm">
            Registre entradas y salidas en la caseta.
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/vigilancia">Ver historial</Link>
        </Button>
      </div>

      <form
        onSubmit={(ev) => void submit(ev)}
        className="max-w-xl space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="grid gap-2">
          <Label>Dirección *</Label>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Entrada</SelectItem>
              <SelectItem value="out">Salida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gm-when">Fecha y hora</Label>
          <Input
            id="gm-when"
            type="datetime-local"
            value={occurredAt}
            onChange={(ev) => setOccurredAt(ev.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gm-notes">Notas</Label>
          <Textarea
            id="gm-notes"
            rows={4}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
            placeholder="Quién / qué vehículo / carga…"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gm-photo">Foto (opcional)</Label>
          <Input
            id="gm-photo"
            type="file"
            accept="image/*"
            onChange={(ev) =>
              setPhoto(ev.target.files?.[0] ?? null)
            }
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </div>
  )
}
