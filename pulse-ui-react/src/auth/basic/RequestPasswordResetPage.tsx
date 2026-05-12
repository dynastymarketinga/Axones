import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { AxonesBrandMark } from "@/components/axones/AxonesBrandMark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { passwordResetRequest } from "@/lib/api"

export default function RequestPasswordResetPage() {
  const [login, setLogin] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
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
    <div className="min-h-svh w-full bg-gradient-to-b from-muted/80 to-background flex items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <AxonesBrandMark />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Axones</h1>
        </div>
        <Card className="border-border/60 shadow-md">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Solicitar restablecimiento
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Indica tu usuario registrado. Un administrador verá la solicitud dentro de la
              aplicación (sin correo electrónico).
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="login">Usuario</Label>
                <Input
                  id="login"
                  name="login"
                  autoComplete="username"
                  placeholder="usuario"
                  required
                  value={login}
                  onChange={(ev) => setLogin(ev.target.value)}
                  disabled={submitting}
                  className="h-11"
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={submitting} size="lg">
                {submitting ? "Enviando…" : "Enviar solicitud"}
              </Button>
              <p className="text-center text-sm">
                <Link to="/auth/basic/login" className="text-primary underline-offset-4 hover:underline">
                  Volver al inicio de sesión
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
