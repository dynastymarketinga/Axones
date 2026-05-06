"use client"

import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { catalogSearchInputClass } from "@/components/axones/catalog-list-classes"
import { cn } from "@/lib/utils"

type CatalogSearchFieldProps = {
  id: string
  label?: string
  placeholder: string
  value: string
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (ev: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
}

export function CatalogSearchField({
  id,
  label = "Buscar",
  placeholder,
  value,
  onChange,
  onKeyDown,
  className,
}: CatalogSearchFieldProps) {
  return (
    <CatalogLabeledField label={label} htmlFor={id} className={cn("min-w-0", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          className={catalogSearchInputClass}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
      </div>
    </CatalogLabeledField>
  )
}
