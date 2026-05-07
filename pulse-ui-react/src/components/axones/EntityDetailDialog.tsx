"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type EntityDetailField = {
  label: string
  value: ReactNode
  mono?: boolean
  full?: boolean
  icon?: LucideIcon
}

export type EntityDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string | null
  loading?: boolean
  fields: EntityDetailField[]
  children?: ReactNode
  footer?: ReactNode
}

export function EntityDetailDialog({
  open,
  onOpenChange,
  title,
  description,
  loading,
  fields,
  children,
  footer,
}: EntityDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((f, i) => {
                const Icon = f.icon
                return (
                <div key={`${f.label}-${i}`} className={cn(f.full && "sm:col-span-2")}>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                    {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                    {f.label}
                  </p>
                  <div
                    className={cn(
                      "mt-1 text-sm break-words",
                      f.mono && "font-mono text-xs",
                      f.full && "whitespace-pre-wrap",
                    )}
                  >
                    {f.value}
                  </div>
                </div>
                )
              })}
            </div>
            {children ? <div className="mt-4 border-t pt-4">{children}</div> : null}
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div className="flex flex-wrap gap-2">{footer}</div>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
