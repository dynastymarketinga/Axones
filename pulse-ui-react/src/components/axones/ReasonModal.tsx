"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ReasonModalProps = {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  loading?: boolean
  initialValue?: string
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export function ReasonModal({
  open,
  title = "Razón del cambio",
  description = "Este cambio afecta trazabilidad o existencias. Debe indicar una razón.",
  confirmLabel = "Confirmar cambio",
  loading = false,
  initialValue = "",
  onCancel,
  onConfirm,
}: ReasonModalProps) {
  const [reason, setReason] = useState(initialValue)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setReason(initialValue)
    setError("")
  }, [initialValue, open])

  function confirm() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError("Debe indicar una razón")
      return
    }
    onConfirm(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="change-reason">Razón *</Label>
          <Textarea
            id="change-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              if (error) setError("")
            }}
            rows={4}
            placeholder="Explique por qué necesita este cambio..."
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={loading}>
            {loading ? "Guardando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
