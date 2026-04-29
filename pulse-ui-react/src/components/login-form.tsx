import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useId, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { loginRequest } from "@/lib/api"
import { setAuthSession } from "@/lib/auth-storage"
import type { ApiErrorBody } from "@/lib/api"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const navigate = useNavigate()
  const formId = useId()
  const loginId = `${formId}-login`
  const passwordId = `${formId}-password`
  const [showPassword, setShowPassword] = useState(false)
  const [loginValue, setLoginValue] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldError(null)
    setSubmitting(true)
    try {
      const data = await loginRequest(loginValue.trim(), password)
      setAuthSession(data.token, data.user)
      toast.success(`Hola, ${data.user.name}`)
      navigate("/resumen", { replace: true })
    } catch (unknown) {
      const err = unknown as Error & ApiErrorBody
      const first =
        err.errors?.login?.[0] ||
        err.errors?.password?.[0] ||
        err.message ||
        "Error al iniciar sesión."
      setFieldError(first)
      toast.error(first)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border/60 shadow-md">
        <CardHeader className="space-y-1 pb-4 text-center">
          <CardTitle className="text-xl font-semibold tracking-tight">Iniciar sesión</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sistema de gestión operativa. Usa tu nombre de usuario y la contraseña.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <div className="grid gap-5">
              {fieldError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                  {fieldError}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor={loginId} className="text-foreground">
                  Usuario
                </Label>
                <Input
                  id={loginId}
                  name="login"
                  type="text"
                  autoComplete="username"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="usuario"
                  required
                  value={loginValue}
                  onChange={(ev) => setLoginValue(ev.target.value)}
                  disabled={submitting}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={passwordId} className="text-foreground">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id={passwordId}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    disabled={submitting}
                    className="h-11 pr-11"
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
              </div>
              <Button type="submit" className="h-11 w-full" disabled={submitting} size="lg">
                {submitting ? "Entrando…" : "Entrar"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link
                  to="../request-reset"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Solicitar restablecimiento de contraseña
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
