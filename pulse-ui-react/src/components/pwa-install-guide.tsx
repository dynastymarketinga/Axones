import { Smartphone } from "lucide-react"
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
      return { host: "", secure: true, mobile: false }
    }
    return {
      host: window.location.hostname,
      secure: window.isSecureContext,
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

  const needsHttpsHint =
    !context.secure &&
    context.host !== "localhost" &&
    context.host !== "127.0.0.1"

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

      <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
        <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <Smartphone className="size-4 shrink-0" aria-hidden />
          Icono de Axones en el escritorio
        </p>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
          <li>
            Menú <span className="font-medium text-foreground">⋮</span> del navegador (arriba a
            la derecha).
          </li>
          <li>
            Toca{" "}
            <span className="font-medium text-foreground">
              Agregar a la pantalla principal
            </span>
            {needsHttpsHint ? (
              <span> (en HTTP/IP suele ser esta opción, no «Instalar aplicación»).</span>
            ) : (
              <span>.</span>
            )}
          </li>
          <li>
            Confirma el nombre <span className="font-medium text-foreground">Axones</span>. El
            icono sale de{" "}
            <span className="font-medium text-foreground">logo Axones</span> (
            <code className="rounded bg-black/5 px-1">apple-touch-icon</code> / PWA).
          </li>
        </ol>
        {needsHttpsHint ? (
          <p className="mt-3 text-xs text-muted-foreground">
            En producción con <span className="font-medium text-foreground">HTTPS</span> Chrome
            puede mostrar además «Instalar aplicación» y el botón morado abajo.
          </p>
        ) : null}
      </div>

      <PwaInstallPrompt variant="login" />
    </div>
  )
}
