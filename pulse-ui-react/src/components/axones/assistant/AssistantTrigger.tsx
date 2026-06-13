import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  onClick: () => void
}

export function AssistantTrigger({ onClick }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Abrir asistente Axones (Ctrl+J)"
      title="Asistente Axones · Ctrl+J"
      className="rounded-full h-9 w-9"
    >
      <Sparkles className="h-5 w-5" />
    </Button>
  )
}
