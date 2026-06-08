import { useId, useState } from "react"
import { AtSign, Eye, EyeOff, KeyRound, LogIn } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import {
  authPanelClass,
  catalogMasterFormPlainInputClass,
} from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginRequest } from "@/lib/api"
import { setAuthSession } from "@/lib/auth-storage"
import type { ApiErrorBody } from "@/lib/api"
import { cn } from "@/lib/utils"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const navigate = useNavigate()
  const formId = useId()
  const loginId = `${formId}-login`
  const passwordId = `${formId}-password`
  const [showPassword, setShowPassword] = useState(false)
  const [loginValue, setLoginValue] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({})

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})

    const nextErrors: { login?: string; password?: string } = {}
    if (!loginValue.trim()) {
      nextErrors.login = "El usuario es obligatorio."
    }
    if (!password) {
      nextErrors.password = "La contraseña es obligatoria."
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      const data = await loginRequest(loginValue.trim(), password)
      setAuthSession(data.token, data.user)
      toast.success(`Hola, ${data.user.name}`)
      navigate("/resumen", { replace: true })
    } catch (unknown) {
      const err = unknown as Error & ApiErrorBody
      const fieldErrors: { login?: string; password?: string } = {}
      if (err.errors?.login?.[0]) fieldErrors.login = err.errors.login[0]
      if (err.errors?.password?.[0]) fieldErrors.password = err.errors.password[0]

      if (fieldErrors.login || fieldErrors.password) {
        setErrors(fieldErrors)
      }

      const first =
        fieldErrors.login ||
        fieldErrors.password ||
        err.message ||
        "Error al iniciar sesión."
      toast.error(first)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className={cn(authPanelClass, "justify-between", className)}
      onSubmit={onSubmit}
      noValidate
      aria-label="Iniciar sesión"
      {...props}
    >
      <div className="grid flex-1 content-center gap-4">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold md:hidden">
          <LogIn className="h-4 w-4 text-primary" aria-hidden />
          Entrar
        </h2>

        <div className="grid gap-4">
          <CatalogLabeledField label="Usuario" htmlFor={loginId} icon={AtSign}>
            <Input
              id={loginId}
              name="login"
              type="text"
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="usuario"
              value={loginValue}
              onChange={(ev) => {
                setLoginValue(ev.target.value)
                if (errors.login) setErrors((prev) => ({ ...prev, login: undefined }))
              }}
              disabled={submitting}
              className={catalogMasterFormPlainInputClass}
              aria-invalid={Boolean(errors.login)}
            />
            {errors.login ? (
              <p className="text-destructive text-sm" role="alert">
                {errors.login}
              </p>
            ) : null}
          </CatalogLabeledField>

          <CatalogLabeledField label="Contraseña" htmlFor={passwordId} icon={KeyRound}>
            <div className="relative">
              <Input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(ev) => {
                  setPassword(ev.target.value)
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                }}
                disabled={submitting}
                className={cn(catalogMasterFormPlainInputClass, "pr-11")}
                aria-invalid={Boolean(errors.password)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                disabled={submitting}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.password ? (
              <p className="text-destructive text-sm" role="alert">
                {errors.password}
              </p>
            ) : null}
          </CatalogLabeledField>
        </div>
      </div>

      <div className="grid shrink-0 gap-3 border-t border-primary/10 pt-4">
        <Button
          type="submit"
          className="h-11 w-full shadow-sm"
          disabled={submitting}
          size="lg"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 border-primary/25 text-foreground shadow-sm hover:bg-primary/5"
          asChild
        >
          <Link to="/auth/basic/request-reset">
            <KeyRound className="size-4 shrink-0" aria-hidden />
            Solicitar restablecimiento de contraseña
          </Link>
        </Button>
      </div>
    </form>
  )
}
