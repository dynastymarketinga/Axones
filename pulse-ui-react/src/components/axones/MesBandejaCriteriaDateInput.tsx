"use client"

import { CalendarDays, ChevronDown } from "lucide-react"
import { useState } from "react"
import { es } from "react-day-picker/locale"

import {
  mesBandejaCriteriaDateClass,
  type MesBandejaCriteriaAccent,
} from "@/components/axones/MesBandejaCriteriaField"
import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  formatDateInputDisplay,
  parseDateInputValue,
  toDateInputValue,
} from "@/pages/axones/purchase-document-form-ui"

type MesBandejaCriteriaDateInputProps = {
  accent: MesBandejaCriteriaAccent
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
}

export function MesBandejaCriteriaDateInput({
  accent,
  value,
  onChange,
  id,
  className,
}: MesBandejaCriteriaDateInputProps) {
  const [open, setOpen] = useState(false)
  const active = value.length > 0
  const selected = parseDateInputValue(value)

  const iconClass =
    accent === "amber" ? "text-amber-600 dark:text-amber-400" : "text-orange-600 dark:text-orange-400"

  const popoverBorderClass =
    accent === "amber" ? "border-amber-500/35 ring-amber-500/10" : "border-orange-500/35 ring-orange-500/10"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            mesBandejaCriteriaDateClass(accent, active),
            "justify-between bg-background/95 px-3 font-medium shadow-inner hover:bg-background hover:brightness-[1.02]",
            !active && "text-muted-foreground",
            className,
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2 truncate">
            <CalendarDays className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden />
            <span className="truncate">{active ? formatDateInputDisplay(value) : "Seleccione fecha…"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-55" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-auto overflow-hidden p-0 shadow-lg ring-1", popoverBorderClass)}
      >
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
        <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
          >
            Borrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-2.5 text-xs font-semibold",
              accent === "amber"
                ? "text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                : "text-orange-700 hover:bg-orange-500/10 dark:text-orange-300",
            )}
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
