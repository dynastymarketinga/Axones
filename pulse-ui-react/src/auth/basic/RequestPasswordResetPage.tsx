import { useState } from "react"
import { AtSign, KeyRound, LogIn } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { AuthPageShell } from "@/components/auth/AuthPageShell"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import {
  authPanelClass,
  catalogMasterFormPlainInputClass,
  catalogMasterFormSectionClass,
} from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { passwordResetRequest } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function RequestPasswordResetPage() {
  const [login, setLogin] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<string | undefined>()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(undefined)

    if (!login.trim()) {
      setLoginError("El usuario es obligatorio.")
      return
    }

    setSubmitting(true)
    try {
      await passwordResetRequest(login.trim())
      toast.success(
        "Si la cuenta existe, se notificará a un administrador en el sistema.",
      )
      setLogin("")
    } catch {
      toast.error("No se pudo enviar la solicitud. Intenta de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageShell>
      <form
        className={cn(authPanelClass, "justify-between")}
        onSubmit={onSubmit}
        noValidate
        aria-label="Solicitar restablecimiento de contraseña"
      >
        <div className="grid min-h-0 flex-1 content-center gap-5 md:gap-6">
          <div className={catalogMasterFormSectionClass}>
            <h2 className="inline-flex items-center gap-2 text-base font-semibold">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden />
              Solicitar restablecimiento
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Indica tu usuario registrado. Un administrador verá la solicitud dentro de la
              aplicación (sin correo electrónico).
            </p>
          </div>

          <CatalogLabeledField label="Usuario" htmlFor="login" icon={AtSign}>
            <Input
              id="login"
              name="login"
              autoComplete="username"
              placeholder="usuario"
              value={login}
              onChange={(ev) => {
                setLogin(ev.target.value)
                if (loginError) setLoginError(undefined)
              }}
              disabled={submitting}
              className={catalogMasterFormPlainInputClass}
              aria-invalid={Boolean(loginError)}
            />
            {loginError ? (
              <p className="text-destructive text-sm" role="alert">
                {loginError}
              </p>
            ) : null}
          </CatalogLabeledField>
        </div>

        <div className="grid shrink-0 gap-3 border-t border-primary/10 pt-4">
          <Button type="submit" className="h-11 w-full shadow-sm" disabled={submitting} size="lg">
            {submitting ? "Enviando…" : "Enviar solicitud"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2 border-primary/25 text-foreground shadow-sm hover:bg-primary/5"
            asChild
          >
            <Link to="/auth/basic/login">
              <LogIn className="size-4 shrink-0" aria-hidden />
              Volver al inicio de sesión
            </Link>
          </Button>
        </div>
      </form>
    </AuthPageShell>
  )
}
