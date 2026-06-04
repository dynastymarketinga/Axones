import type { ReactNode } from "react"
import { CircleCheck, Hash } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sanitizeBobinaKgSlotInput } from "@/lib/bobina-kg-slot"
import { cn } from "@/lib/utils"

export type MesBobinaKgSlotCellProps = {
  id: string
  name: string
  slotNum: number
  value: string
  filled: boolean
  inputDisabled: boolean
  onChange: (v: string) => void
  labelButton: ReactNode
}

export function MesBobinaKgSlotCell({
  id,
  name,
  slotNum,
  value,
  filled,
  inputDisabled,
  onChange,
  labelButton,
}: MesBobinaKgSlotCellProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <Label htmlFor={id} className="ot-label">
          <span className="inline-flex items-center gap-1">
            <Hash className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            {slotNum}
          </span>
        </Label>
        <div className="flex shrink-0 items-center gap-0.5">
          {filled ? (
            <span className="inline-flex" title="Kg registrado">
              <CircleCheck
                className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
            </span>
          ) : null}
          {labelButton}
        </div>
      </div>
      <Input
        id={id}
        name={name}
        className={cn(
          "ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900",
          filled && "border-emerald-500/70 ring-emerald-500/20",
        )}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(sanitizeBobinaKgSlotInput(e.target.value))}
        placeholder="0"
        disabled={inputDisabled}
      />
    </div>
  )
}
