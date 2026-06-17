"use client"

import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import {
  AtSign,
  BadgeCheck,
  KeyRound,
  Mail,
  User,
  UserRound,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { ProfileAvatarEditor } from "@/components/axones/ProfileAvatarEditor"
import {
  catalogMasterFormActionsClass,
  catalogMasterFormPanelClass,
  catalogMasterFormPlainInputClass,
  catalogMasterFormSectionClass,
} from "@/components/axones/catalog-list-classes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateCurrentUserPassword } from "@/lib/api"
import { ApiError } from "@/lib/api"
import { clearAuthSession, getStoredUser, type AuthUser } from "@/lib/auth-storage"
import {
  formatAxonesRoleHint,
  formatAxonesRoleLabel,
} from "@/lib/axones-role-labels"
import { isAxonesAccountAdmin } from "@/lib/axones-roles"
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

function ProfileIdentityHeader({
  name,
  roleLabel,
  roleHint,
  accentBadge,
  avatarUrl,
  onAvatarChange,
}: {
  name: string
  roleLabel: string
  roleHint?: string | null
  accentBadge?: boolean
  avatarUrl?: string | null
  onAvatarChange?: (user: AuthUser) => void
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
      <ProfileAvatarEditor
        name={name}
        avatarUrl={avatarUrl}
        onAvatarChange={onAvatarChange}
      />
      <div className="min-w-0 space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <Badge
            variant={accentBadge ? "default" : "secondary"}
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
  )
}

export default function UserProfile() {
  const [session, setSession] = useState<AuthUser | null>(() => getStoredUser())
  const roleLabel = formatAxonesRoleLabel(session?.role)
  const roleHint = formatAxonesRoleHint(session?.role)
  const accountAdmin = isAxonesAccountAdmin(session)

  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleAvatarChange = useCallback((user: AuthUser) => {
    setSession(user)
  }, [])

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
      subtitle={
        accountAdmin
          ? "Consulte sus datos de acceso y actualice su contraseña cuando lo necesite."
          : "Su sesión en Axones."
      }
      icon={UserRound}
      headerVariant="elevated"
    >
      {!session ? (
        <div className={catalogMasterFormPanelClass}>
          <p className="text-muted-foreground text-sm">No hay sesión cargada.</p>
        </div>
      ) : !accountAdmin ? (
        <div className="mx-auto w-full max-w-lg">
          <div className={catalogMasterFormPanelClass}>
            <ProfileIdentityHeader
              name={session.name}
              roleLabel={roleLabel}
              avatarUrl={session.avatar_url}
              onAvatarChange={handleAvatarChange}
            />
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className={cn(catalogMasterFormPanelClass, "h-full")}>
              <div className="border-b border-primary/10 pb-6">
                <ProfileIdentityHeader
                  name={session.name}
                  roleLabel={roleLabel}
                  roleHint={roleHint}
                  accentBadge
                  avatarUrl={session.avatar_url}
                  onAvatarChange={handleAvatarChange}
                />
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
              className={cn(catalogMasterFormPanelClass, "h-full")}
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

              <div className="grid gap-4">
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

                <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <div className={catalogMasterFormActionsClass}>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Actualizar contraseña"}
                </Button>
              </div>
            </form>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" asChild className="gap-2">
              <Link to="/account/users">
                <Users className="h-4 w-4" aria-hidden />
                Gestionar usuarios
              </Link>
            </Button>
            <Button type="button" variant="outline" asChild className="gap-2">
              <Link to="/account/password-reset-requests">
                <KeyRound className="h-4 w-4" aria-hidden />
                Solicitudes de contraseña
              </Link>
            </Button>
          </div>
        </div>
      )}
    </CatalogPageShell>
  )
}
