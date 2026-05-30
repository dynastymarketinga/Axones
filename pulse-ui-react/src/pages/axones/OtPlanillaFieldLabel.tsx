import { cn } from "@/lib/utils"
import { otPlanillaFieldId, otPlanillaLabelId } from "@/lib/ot-planilla-field-a11y"

type OtPlanillaFieldLabelProps = {
  field: string
  required?: boolean
  children: React.ReactNode
  className?: string
  /** input: htmlFor al control; combobox: id para aria-labelledby; span: encabezado sin control único */
  control?: "input" | "combobox" | "span"
}

export function OtPlanillaFieldLabel({
  field,
  required,
  children,
  className,
  control = "input",
}: OtPlanillaFieldLabelProps) {
  const labelClass = cn("ot-label", required && "required", className)

  if (control === "span") {
    return (
      <span id={otPlanillaLabelId(field)} className={labelClass}>
        {children}
      </span>
    )
  }

  if (control === "combobox") {
    return (
      <label id={otPlanillaLabelId(field)} className={labelClass}>
        {children}
      </label>
    )
  }

  return (
    <label htmlFor={otPlanillaFieldId(field)} className={labelClass}>
      {children}
    </label>
  )
}
