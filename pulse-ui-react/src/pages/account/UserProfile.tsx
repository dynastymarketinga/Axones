"use client"

import { useCallback, useState } from "react"
import { AtSign, BadgeCheck, KeyRound, Mail, User, UserRound } from "lucide-react"
import { toast } from "sonner"

import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import {
  catalogMasterFormActionsClass,
  catalogMasterFormPanelClass,
  catalogMasterFormPlainInputClass,
  catalogMasterFormSectionClass,
} from "@/components/axones/catalog-list-classes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateCurrentUserPassword } from "@/lib/api"
import { ApiError } from "@/lib/api"
import { clearAuthSession, getStoredUser } from "@/lib/auth-storage"
import {
  formatAxonesRoleHint,
  formatAxonesRoleLabel,
  getUserInitials,
} from "@/lib/axones-role-labels"
import { isAxonesFullAccess } from "@/lib/axones-roles"
import { toastFieldValidationErrors } from "@/lib/form-validation-toast"
import { cn } from "@/lib/utils"

const PASSWORD_VALIDATION_ORDER = [
  { key: "current_password", label: "Contraseña actual" },
  { key: "password", label: "Nueva contraseña" },
  { key: "password_confirmation", label: "Confirmar contraseña" },
] as const

function ProfileField({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof User
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </p>
      <p className="pl-10 text-base font-medium leading-snug text-foreground">{value}</p>
    </div>
  )
}

export default function UserProfile() {
  const session = getStoredUser()
  const roleLabel = formatAxonesRoleLabel(session?.role)
  const roleHint = formatAxonesRoleHint(session?.role)
  const fullAccess = isAxonesFullAccess(session?.role)

  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const redirectToLogin = useCallback(() => {
    clearAuthSession()
    const base = import.meta.env.BASE_URL.replace(/\/?$/, "")
    window.location.assign(`${base}/auth/basic/login`)
  }, [])

  const handlePasswordSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault()
      setErrors({})
      setSaving(true)
      try {
        await updateCurrentUserPassword({
          current_password: currentPassword,
          password,
          password_confirmation: passwordConfirmation,
        })
        toast.success("Contraseña actualizada. Inicie sesión de nuevo.")
        redirectToLogin()
      } catch (e) {
        if (e instanceof ApiError && e.body.errors) {
          const fieldErrors: Record<string, string> = {}
          for (const [key, messages] of Object.entries(e.body.errors)) {
            if (messages?.[0]) fieldErrors[key] = messages[0]
          }
          setErrors(fieldErrors)
          toastFieldValidationErrors(fieldErrors, PASSWORD_VALIDATION_ORDER)
        } else if (e instanceof ApiError) {
          toast.error(e.message)
        } else {
          toast.error("No se pudo cambiar la contraseña.")
        }
      } finally {
        setSaving(false)
      }
    },
    [currentPassword, password, passwordConfirmation, redirectToLogin],
  )

  return (
    <CatalogPageShell
      title="Perfil"
      subtitle="Datos de su sesión en Axones. Para cambiar la contraseña use la sección inferior."
      icon={UserRound}
      headerVariant="elevated"
    >
      {!session ? (
        <div className={catalogMasterFormPanelClass}>
          <p className="text-muted-foreground text-sm">No hay sesión cargada.</p>
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className={cn(catalogMasterFormPanelClass)}>
            <div className="flex flex-col gap-5 border-b border-primary/10 pb-6 sm:flex-row sm:items-center">
              <Avatar className="h-20 w-20 rounded-2xl ring-2 ring-primary/15 shadow-sm">
                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/15 text-lg font-semibold text-primary">
                  {getUserInitials(session.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">{session.name}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={fullAccess ? "default" : "secondary"}
                    className="gap-1.5 font-normal"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    {roleLabel}
                  </Badge>
                  {roleHint ? (
                    <span className="text-muted-foreground text-sm">{roleHint}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-6 pt-6 sm:grid-cols-2">
              <ProfileField label="Nombre" value={session.name} icon={User} />
              <ProfileField label="Correo" value={session.email ?? "—"} icon={Mail} />
              {session.username ? (
                <ProfileField label="Usuario" value={session.username} icon={AtSign} />
              ) : null}
              <ProfileField label="Rol" value={roleLabel} icon={BadgeCheck} />
            </div>
          </div>

          <form
            className={catalogMasterFormPanelClass}
            onSubmit={(ev) => void handlePasswordSubmit(ev)}
          >
            <div className={catalogMasterFormSectionClass}>
              <h3 className="inline-flex items-center gap-2 text-base font-semibold">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden />
                Cambiar mi contraseña
              </h3>
              <p className="text-muted-foreground text-sm">
                Tras guardar deberá iniciar sesión de nuevo con la nueva clave.
              </p>
            </div>

            <div className="grid gap-4 sm:max-w-md">
              <CatalogLabeledField label="Contraseña actual" htmlFor="current-password">
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  className={catalogMasterFormPlainInputClass}
                  value={currentPassword}
                  onChange={(ev) => setCurrentPassword(ev.target.value)}
                  aria-invalid={Boolean(errors.current_password)}
                />
                {errors.current_password ? (
                  <p className="text-destructive text-sm">{errors.current_password}</p>
                ) : null}
              </CatalogLabeledField>

              <CatalogLabeledField label="Nueva contraseña" htmlFor="new-password">
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  className={catalogMasterFormPlainInputClass}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  aria-invalid={Boolean(errors.password)}
                />
                {errors.password ? (
                  <p className="text-destructive text-sm">{errors.password}</p>
                ) : null}
              </CatalogLabeledField>

              <CatalogLabeledField label="Confirmar contraseña" htmlFor="confirm-password">
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className={catalogMasterFormPlainInputClass}
                  value={passwordConfirmation}
                  onChange={(ev) => setPasswordConfirmation(ev.target.value)}
                  aria-invalid={Boolean(errors.password_confirmation)}
                />
                {errors.password_confirmation ? (
                  <p className="text-destructive text-sm">{errors.password_confirmation}</p>
                ) : null}
              </CatalogLabeledField>
            </div>

            <div className={catalogMasterFormActionsClass}>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Actualizar contraseña"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </CatalogPageShell>
  )
}
