"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const FIGURAS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const

type WindingFigurePickerProps = {
  value: string
  onChange: (v: string) => void
  className?: string
  helpText?: string
  disabled?: boolean
}

/**
 * FIGURA DE EMBOBINADO (1–8 o libre). Los botones son atajos; la miniatura solo repite el valor (referencia visual).
 */
export function WindingFigurePicker({
  value,
  onChange,
  className,
  helpText = "1–8 o libre",
  disabled = false,
}: WindingFigurePickerProps) {
  const v = (value || "").trim()
  const previewText =
    v.length === 0 ? "—" : v.length <= 3 ? v : `${v.slice(0, 2)}…`
  const numericHelpText = helpText === "1–8 o libre" ? "1–8" : helpText
  return (
    <div
      className={cn("ax-winding space-y-2", className)}
      title="Atajos 1–8 o escribe en el campo. La miniatura es solo referencia visual de la figura."
    >
      <div className="flex flex-wrap gap-1" role="group" aria-label="Atajos figura de embobinado 1 a 8">
        {FIGURAS.map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={v === n ? "default" : "outline"}
            className="h-9 min-w-9 px-2.5 text-xs sm:h-8 sm:min-w-8 sm:px-2"
            aria-pressed={v === n}
            disabled={disabled}
            onClick={() => onChange(n)}
          >
            {n}
          </Button>
        ))}
      </div>
      <div className="flex flex-row flex-wrap items-center gap-2">
        <Input
          className="h-9 min-h-9 min-w-0 w-full max-w-full flex-1 sm:max-w-xs text-sm"
          value={v}
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 1))}
          placeholder={numericHelpText}
          aria-label="Figura de embobinado (1-8)"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-[10px] leading-tight max-w-[4.5rem] sm:max-w-[7rem]">
            Vista previa
          </span>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40"
            aria-hidden
            title="Vista previa: bobina con el número o texto elegido (no es un botón)."
          >
            <svg viewBox="0 0 40 40" className="h-7 w-7 text-foreground" xmlns="http://www.w3.org/2000/svg">
              <rect
                x="2"
                y="4"
                width="36"
                height="32"
                rx="4"
                className="fill-background stroke-foreground/80"
                strokeWidth="1.2"
              />
              <circle cx="20" cy="20" r="10" fill="none" className="stroke-muted-foreground" strokeWidth="1" />
              <circle cx="20" cy="20" r="3" className="fill-muted-foreground" />
              <text
                x="20"
                y="24"
                textAnchor="middle"
                className="fill-foreground"
                style={{ fontSize: "10px", fontWeight: 700, fontFamily: "system-ui" }}
              >
                {previewText}
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
