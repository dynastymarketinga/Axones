import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { useAxonesAssistant } from "@/hooks/useAxonesAssistant"

import { AssistantChips } from "./AssistantChips"
import { AssistantInput } from "./AssistantInput"
import { AssistantMessages } from "./AssistantMessages"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssistantPanel({ open, onOpenChange }: Props) {
  const { messages, chips, sending, rateLimit, send } = useAxonesAssistant(open)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-3 p-4"
      >
        <SheetHeader className="pb-1">
          <SheetTitle className="text-base">Asistente Axones</SheetTitle>
          <SheetDescription className="text-xs">
            Solo lectura. Las respuestas se basan en los datos reales del sistema.
            {rateLimit ? (
              <span className="ml-1">
                · {rateLimit.remaining}/{rateLimit.limit} consultas hoy
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <AssistantMessages messages={messages} sending={sending} />
        </div>

        {chips.length > 0 ? (
          <div className="border-t pt-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Sugerencias
            </div>
            <AssistantChips
              chips={chips}
              disabled={sending}
              onPick={(chip) => {
                void send(chip.label, { tool: chip.tool, tool_params: chip.params })
              }}
            />
          </div>
        ) : null}

        <AssistantInput sending={sending} onSend={(text, opts) => void send(text, opts)} />
      </SheetContent>
    </Sheet>
  )
}
