"use client"

import { CircleDot } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { OtPlanillaInputIcon } from "./OtPlanillaInputIcon"

const FIGURAS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const

type WindingFigurePickerProps = {
  value: string
  onChange: (v: string) => void
  className?: string
  /** Solo el campo de texto muestra error (no todo el bloque de botones). */
  invalid?: boolean
  helpText?: string
  disabled?: boolean
  /** id del input numérico (asociar `<label htmlFor>` visible fuera del componente). */
  figureInputId?: string
}

/**
 * FIGURA DE EMBOBINADO (1–8 o libre). Atajos 1–8 y campo en una sola fila para alinear con otros inputs de la planilla.
 */
export function WindingFigurePicker({
  value,
  onChange,
  className,
  invalid = false,
  helpText = "3",
  disabled = false,
  figureInputId,
}: WindingFigurePickerProps) {
  const v = (value || "").trim()
  return (
    <div
      className={cn(
        "ax-winding flex min-h-9 min-w-0 flex-nowrap items-center gap-1 overflow-x-auto",
        className,
      )}
      title="Atajos 1–8 o escribe en el campo."
    >
      <div className="flex shrink-0 flex-nowrap gap-px" role="group" aria-label="Atajos figura de embobinado 1 a 8">
        {FIGURAS.map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={v === n ? "default" : "outline"}
            className="h-9 w-8 shrink-0 px-0 text-xs font-semibold leading-none"
            aria-pressed={v === n}
            disabled={disabled}
            onClick={() => onChange(n)}
          >
            {n}
          </Button>
        ))}
      </div>
      <OtPlanillaInputIcon
        icon={CircleDot}
        compact
        className="ot-input-icon-wrap--winding h-9 min-h-9 w-[4.25rem] shrink-0 self-stretch sm:w-[4.5rem]"
      >
        <Input
          id={figureInputId}
          className="ax-winding-figure-input h-9 min-h-9 w-full min-w-0 px-2 py-0 text-sm"
          value={v}
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 1))}
          placeholder={helpText}
          aria-label={figureInputId ? undefined : "Figura de embobinado (1-8)"}
          aria-invalid={invalid ? true : undefined}
        />
      </OtPlanillaInputIcon>
    </div>
  )
}
