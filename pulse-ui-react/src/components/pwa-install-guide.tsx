import { useEffect, useMemo, useState } from "react"

import { PwaInstallPrompt } from "@/components/pwa-install-prompt"

function isMobileUa(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

export function PwaInstallGuide() {
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches)
  }, [])

  const context = useMemo(() => {
    if (typeof window === "undefined") {
      return { host: "", mobile: false }
    }
    return {
      host: window.location.hostname,
      mobile: isMobileUa(),
    }
  }, [])

  if (standalone) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Ya abriste Axones desde el icono instalado en tu pantalla.
      </p>
    )
  }

  const wrongLocalhostOnDevice =
    context.mobile &&
    (context.host === "localhost" || context.host === "127.0.0.1")

  return (
    <div className="space-y-3">
      {wrongLocalhostOnDevice ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-medium">En la tablet no uses «localhost»</p>
          <p className="mt-1 text-xs opacity-90">
            <code className="rounded bg-black/5 px-1">localhost</code> en el tablet es el
            propio equipo, no tu PC. Abre la IP de tu computadora, por ejemplo{" "}
            <span className="font-medium">http://192.168.1.245:5173/axones/</span> (la muestra
            Vite al iniciar <span className="font-medium">npm run dev</span>).
          </p>
        </div>
      ) : null}

      <PwaInstallPrompt variant="login" />
    </div>
  )
}
