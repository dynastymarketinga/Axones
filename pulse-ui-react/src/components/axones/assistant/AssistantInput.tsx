import { useState, type KeyboardEvent } from "react"
import { Send, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  sending: boolean
  onSend: (text: string, opts?: { force_analysis?: boolean }) => void
}

export function AssistantInput({ sending, onSend }: Props) {
  const [text, setText] = useState("")
  const [analysis, setAnalysis] = useState(false)

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    onSend(trimmed, analysis ? { force_analysis: true } : undefined)
    setText("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe tu pregunta… (Enter = enviar, Shift+Enter = nueva línea)"
          rows={2}
          maxLength={4000}
          className="resize-none min-h-[44px] max-h-32"
        />
        <Button
          type="button"
          onClick={submit}
          disabled={sending || text.trim().length === 0}
          aria-label="Enviar"
          className="h-10 w-10 p-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => setAnalysis((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-accent"
          aria-pressed={analysis}
          title="Incluye análisis de mermas o tiempos de los últimos 7 días"
        >
          <Sparkles className="h-3 w-3" />
          {analysis ? "Análisis ON" : "Análisis profundo"}
        </button>
        <span>{text.length}/4000</span>
      </div>
    </div>
  )
}
