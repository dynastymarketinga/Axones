import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

import { AssistantDots } from "./AssistantDots"
import type { AssistantMessageItem } from "@/types/assistant"

type Props = {
  messages: AssistantMessageItem[]
  sending: boolean
}

export function AssistantMessages({ messages, sending }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, sending])

  if (messages.length === 0 && !sending) {
    return (
      <div className="text-sm text-muted-foreground px-1 py-6 text-center">
        Pregunta cualquier cosa del sistema: estado de una OT, alertas pendientes, mermas del mes…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} />
      ))}
      {sending ? (
        <div className="flex gap-1 px-2 py-1 items-center text-muted-foreground text-xs">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:120ms]" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:240ms]" />
          <span className="ml-1">Pensando…</span>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  )
}

function Bubble({ message }: { message: AssistantMessageItem }) {
  const isUser = message.role === "user"
  const isError = message.role === "error"
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : isError
              ? "bg-destructive/10 text-destructive border border-destructive/30 rounded-bl-sm"
              : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {message.text}
        {!isUser ? <AssistantDots dots={message.dots} /> : null}
      </div>
    </div>
  )
}
