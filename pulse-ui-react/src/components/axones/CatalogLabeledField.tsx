"use client"

import type { LucideIcon } from "lucide-react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type CatalogLabeledFieldProps = {
  label: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
  /** Icono a la izquierda de la etiqueta (misma línea visual que `CatalogTableHead`). */
  icon?: LucideIcon
}

export function CatalogLabeledField({
  label,
  htmlFor,
  className,
  children,
  icon: Icon,
}: CatalogLabeledFieldProps) {
  return (
    <div className={cn("grid gap-2.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="inline-flex min-h-8 items-center gap-2.5 text-sm font-medium leading-snug text-muted-foreground"
      >
        {Icon ? (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15 shadow-inner"
            aria-hidden
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
        <span className="min-w-0 text-foreground/85">{label}</span>
      </Label>
      {children}
    </div>
  )
}
