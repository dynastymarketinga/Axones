import { Download } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type PwaInstallPromptProps = {
  /** header: solo escritorio (barra). login: visible también en móvil/tablet. */
  variant?: "header" | "login"
  className?: string
}

export function PwaInstallPrompt({
  variant = "header",
  className,
}: PwaInstallPromptProps = {}) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
      return
    }

    const onInstallAvailable = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => {
      setInstallEvent(null)
      setInstalled(true)
    }

    window.addEventListener("beforeinstallprompt", onInstallAvailable)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallAvailable)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (installed || !installEvent) return null

  return (
    <Button
      type="button"
      variant={variant === "login" ? "secondary" : "outline"}
      size={variant === "login" ? "default" : "sm"}
      className={cn(
        "gap-1.5",
        variant === "header" && "hidden sm:inline-flex",
        variant === "login" && "inline-flex w-full",
        className,
      )}
      onClick={async () => {
        await installEvent.prompt()
        const choice = await installEvent.userChoice
        if (choice.outcome === "accepted") {
          setInstallEvent(null)
        }
      }}
    >
      <Download className="size-4" aria-hidden />
      Instalar app
    </Button>
  )
}
