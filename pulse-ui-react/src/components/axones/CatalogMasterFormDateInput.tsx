"use client"

import { CalendarDays, ChevronDown } from "lucide-react"
import { useState } from "react"
import { es } from "react-day-picker/locale"

import { catalogMasterFormPlainInputClass } from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  formatDateInputDisplay,
  parseDateInputValue,
  toDateInputValue,
} from "@/pages/axones/purchase-document-form-ui"

type CatalogMasterFormDateInputProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function CatalogMasterFormDateInput({
  id,
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Seleccione fecha…",
}: CatalogMasterFormDateInputProps) {
  const [open, setOpen] = useState(false)
  const selected = parseDateInputValue(value)
  const hasValue = value.trim().length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            catalogMasterFormPlainInputClass,
            "group/field w-[11rem] max-w-full justify-between px-3 font-normal hover:bg-background",
            !hasValue && "text-muted-foreground",
            className,
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2 truncate">
            <CalendarDays
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                disabled
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground group-focus-visible/field:text-primary",
              )}
              aria-hidden
            />
            <span className="truncate tabular-nums">
              {hasValue ? formatDateInputDisplay(value) : placeholder}
            </span>
          </span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0 shadow-lg">
        <UiCalendar
          mode="single"
          locale={es}
          captionLayout="dropdown"
          fromYear={2020}
          toYear={new Date().getFullYear() + 2}
          selected={selected}
          defaultMonth={selected ?? new Date()}
          onSelect={(date) => {
            if (!date) return
            onChange(toDateInputValue(date))
            setOpen(false)
          }}
        />
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
            onClick={() => {
              onChange(toDateInputValue(new Date()))
              setOpen(false)
            }}
          >
            Hoy
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
