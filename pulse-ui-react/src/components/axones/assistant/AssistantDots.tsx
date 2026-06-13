import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"

import type { AssistantDot } from "@/types/assistant"

type Props = {
  dots?: AssistantDot[]
}

const ENTITY_LABEL: Record<string, string> = {
  work_order: "OT",
  material: "Material",
  alert: "Alerta",
  material_request: "Sol. material",
  area_request: "Sol. área",
  client_order: "Orden cliente",
  delivery_note: "Nota entrega",
  bobina: "Bobina",
}

export function AssistantDots({ dots }: Props) {
  if (!dots || dots.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {dots.map((dot) => {
        const kind = ENTITY_LABEL[dot.type] ?? dot.type
        return (
          <Link
            key={`${dot.type}-${dot.id}`}
            to={dot.href}
            className="no-underline"
            aria-label={`Abrir ${kind} ${dot.label}`}
          >
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent text-xs"
            >
              <span className="text-muted-foreground mr-1">{kind}</span>
              <span className="font-medium">{dot.label}</span>
            </Badge>
          </Link>
        )
      })}
    </div>
  )
}
