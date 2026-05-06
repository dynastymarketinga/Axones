"use client"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type CatalogLabeledFieldProps = {
  label: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

export function CatalogLabeledField({
  label,
  htmlFor,
  className,
  children,
}: CatalogLabeledFieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-sm font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  )
}
