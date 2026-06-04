import { AxonesBrandMark } from "@/components/axones/AxonesBrandMark"
import { LoginForm } from "@/components/login-form"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"

export default function LoginPage() {
  return (
    <div className="min-h-svh w-full bg-gradient-to-b from-muted/80 to-background flex items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <AxonesBrandMark />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Axones</h1>
        </div>
        <LoginForm />
        <div className="mt-6 space-y-2">
          <PwaInstallPrompt variant="login" />
          <p className="text-center text-xs text-muted-foreground">
            También puedes usar el menú del navegador →{" "}
            <span className="font-medium text-foreground">Instalar aplicación</span> o{" "}
            <span className="font-medium text-foreground">Añadir a la pantalla de inicio</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
