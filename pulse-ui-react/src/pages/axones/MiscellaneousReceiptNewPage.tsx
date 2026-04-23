"use client"

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, apiFetchFormData, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
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

export default function MiscellaneousReceiptNewPage() {
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [materialId, setMaterialId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [invoiceRef, setInvoiceRef] = useState("")
  const [notes, setNotes] = useState("")
  const [receivedAt, setReceivedAt] = useState("")
  const [files, setFiles] = useState<FileList | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { inventory_area: "miscelaneos", per_page: 200, page: 1 },
        })
        if (!c) setMaterials(res.data)
      } catch {
        if (!c) setMaterials([])
      }
    })()
    return () => {
      c = true
    }
  }, [])

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const mid = Number(materialId)
    const qty = Number(quantity)
    if (!Number.isFinite(mid) || mid < 1) {
      toast.error("Seleccione el material misceláneo.")
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Indique una cantidad válida.")
      return
    }
    if (!files || files.length < 1) {
      toast.error("Adjunte al menos una foto o PDF de factura/comprobante.")
      return
    }

    const fd = new FormData()
    fd.set("material_id", String(mid))
    fd.set("quantity", String(qty))
    if (invoiceRef.trim()) fd.set("invoice_reference", invoiceRef.trim())
    if (notes.trim()) fd.set("notes", notes.trim())
    if (receivedAt) fd.set("received_at", receivedAt)
    for (let i = 0; i < files.length; i++) {
      fd.append("attachments[]", files[i])
    }

    setSaving(true)
    try {
      await apiFetchFormData("miscellaneous-receipts", fd)
      toast.success("Recepción miscelánea registrada.")
      setQuantity("")
      setInvoiceRef("")
      setNotes("")
      setFiles(null)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nueva recepción misceláneos
          </h1>
          <p className="text-muted-foreground text-sm">
            Comprobantes obligatorios ·{" "}
            <code className="text-xs">POST /miscellaneous-receipts</code>{" "}
            (multipart)
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/axones/miscelaneos">Ver historial</Link>
        </Button>
      </div>

      <form
        onSubmit={(ev) => void submit(ev)}
        className="max-w-xl space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="grid gap-2">
          <Label>Material (área misceláneos) *</Label>
          <Select value={materialId} onValueChange={setMaterialId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione…" />
            </SelectTrigger>
            <SelectContent>
              {materials.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.sku} — {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-qty">Cantidad *</Label>
          <Input
            id="mr-qty"
            inputMode="decimal"
            value={quantity}
            onChange={(ev) => setQuantity(ev.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-inv">Referencia factura</Label>
          <Input
            id="mr-inv"
            value={invoiceRef}
            onChange={(ev) => setInvoiceRef(ev.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-date">Fecha recepción</Label>
          <Input
            id="mr-date"
            type="datetime-local"
            value={receivedAt}
            onChange={(ev) => setReceivedAt(ev.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-notes">Notas</Label>
          <Textarea
            id="mr-notes"
            rows={2}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-files">Adjuntos (imagen o PDF) *</Label>
          <Input
            id="mr-files"
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={(ev) => setFiles(ev.target.files)}
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Enviando…" : "Registrar ingreso"}
        </Button>
      </form>
    </div>
  )
}
