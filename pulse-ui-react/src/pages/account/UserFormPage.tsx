"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { AtSign, KeyRound, Mail, Shield, UserRound, Users } from "lucide-react"

import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogMasterFormBackButton } from "@/components/axones/CatalogMasterFormBackButton"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import {
  catalogMasterFormActionsClass,
  catalogMasterFormPanelClass,
  catalogMasterFormPlainInputClass,
  catalogMasterFormSectionClass,
} from "@/components/axones/catalog-list-classes"
import { PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch, ApiError } from "@/lib/api"
import { getAssignableAxonesRoles } from "@/lib/axones-role-labels"
import { toastFieldValidationErrors } from "@/lib/form-validation-toast"
import type { UserRecord } from "@/types/api"
import { cn } from "@/lib/utils"

const USER_VALIDATION_TOAST_ORDER = [
  { key: "name", label: "Nombre" },
  { key: "email", label: "Correo" },
  { key: "username", label: "Usuario" },
  { key: "role", label: "Rol" },
  { key: "password", label: "Contraseña" },
  { key: "passwordConfirmation", label: "Confirmar contraseña" },
] as const

const LIM = {
  name: 255,
  email: 255,
  username: 64,
} as const

const ROLE_OPTIONS = getAssignableAxonesRoles()

export default function UserFormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get("id")
  const userId = idParam ? Number(idParam) : null
  const isEdit = Number.isFinite(userId) && userId! > 0

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [role, setRole] = useState("inventory")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const nameRef = useRef<HTMLInputElement>(null)

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/account/users"
  }, [location.state])

  const pageTitle = isEdit ? "Editar usuario" : "Nuevo usuario"
  const pageSubtitle = isEdit
    ? "Actualice datos de acceso, rol y —si hace falta— la contraseña."
    : "Registre una cuenta con rol de área para acceso a Axones."

  const wantsPasswordChange = password.trim() !== "" || passwordConfirmation.trim() !== ""

  const load = useCallback(async () => {
    if (!isEdit || !userId) return
    setLoading(true)
    try {
      const u = await apiFetch<UserRecord>(`users/${userId}`)
      setName(u.name ?? "")
      setEmail(u.email ?? "")
      setUsername(u.username ?? "")
      setRole(u.role ?? "inventory")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el usuario.")
    } finally {
      setLoading(false)
    }
  }, [isEdit, userId])

  useEffect(() => {
    void load()
  }, [load])

  const validate = useCallback(() => {
    const next: Record<string, string> = {}
    const n = name.trim()
    const em = email.trim()
    const un = username.trim()

    if (!n) next.name = "El nombre es obligatorio."
    if (!em) next.email = "El correo es obligatorio."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) next.email = "Correo inválido."
    if (!un) next.username = "El usuario de acceso es obligatorio."
    else if (!/^[a-zA-Z0-9_.-]+$/.test(un)) {
      next.username = "Solo letras, números, punto, guion y guion bajo."
    }
    if (!role) next.role = "Seleccione un rol."

    const needsPassword = !isEdit || wantsPasswordChange
    if (needsPassword) {
      if (!password) next.password = "La contraseña es obligatoria."
      else if (password.length < 8) next.password = "Mínimo 8 caracteres."
      if (password !== passwordConfirmation) {
        next.passwordConfirmation = "Las contraseñas no coinciden."
      }
    }

    setErrors(next)
    return next
  }, [name, email, username, role, password, passwordConfirmation, isEdit, wantsPasswordChange])

  async function doSubmit() {
    setSaving(true)
    try {
      if (isEdit && userId) {
        await apiFetch<UserRecord>(`users/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            username: username.trim(),
            role,
          }),
        })

        if (wantsPasswordChange) {
          await apiFetch(`users/${userId}/password`, {
            method: "PATCH",
            body: JSON.stringify({
              password,
              password_confirmation: passwordConfirmation,
            }),
          })
          toast.success("Usuario y contraseña actualizados.")
        } else {
          toast.success("Usuario actualizado.")
        }
      } else {
        await apiFetch<UserRecord>("users", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            username: username.trim(),
            role,
            password,
            password_confirmation: passwordConfirmation,
          }),
        })
        toast.success("Usuario creado.")
      }
      navigate(returnTo)
    } catch (e) {
      if (e instanceof ApiError) {
        const errs = e.body?.errors
        if (e.status === 422 && errs && Object.keys(errs).length) {
          const mapped: Record<string, string> = {}
          for (const [key, raw] of Object.entries(errs)) {
            const msg = (Array.isArray(raw) ? raw : [raw]).map(String).join(" ")
            if (key === "password") mapped.password = msg
            else if (key === "email") mapped.email = msg
            else if (key === "username") mapped.username = msg
            else if (key === "name") mapped.name = msg
            else if (key === "role") mapped.role = msg
          }
          setErrors((prev) => ({ ...prev, ...mapped }))
          toastFieldValidationErrors(mapped, USER_VALIDATION_TOAST_ORDER)
        } else {
          toast.error(e.message)
        }
      } else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const v = validate()
    if (Object.keys(v).length) {
      toastFieldValidationErrors(v, USER_VALIDATION_TOAST_ORDER)
      nameRef.current?.focus()
      return
    }
    await doSubmit()
  }

  return (
    <CatalogPageShell
      title={pageTitle}
      subtitle={pageSubtitle}
      icon={Users}
      headerVariant="elevated"
      action={<CatalogMasterFormBackButton to={returnTo} />}
    >
      {loading ? (
        <PageLoadingBlock />
      ) : (
        <form
          noValidate
          onSubmit={(ev) => void submit(ev)}
          className={catalogMasterFormPanelClass}
        >
          <div className={catalogMasterFormSectionClass}>
            <h2 className="text-base font-semibold tracking-tight">Datos de acceso</h2>
            <p className="text-muted-foreground text-sm">
              El usuario inicia sesión con <strong>usuario + contraseña</strong> (no con el correo).
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <CatalogLabeledField label="Nombre *" htmlFor="u-name" icon={UserRound} className="md:col-span-2">
              <Input
                ref={nameRef}
                id="u-name"
                value={name}
                maxLength={LIM.name}
                onChange={(ev) => setName(ev.target.value)}
                className={cn(catalogMasterFormPlainInputClass, errors.name && "border-destructive")}
              />
              {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
            </CatalogLabeledField>

            <CatalogLabeledField label="Correo *" htmlFor="u-email" icon={Mail}>
              <Input
                id="u-email"
                type="email"
                value={email}
                maxLength={LIM.email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="email"
                placeholder="nombre@empresa.local"
                className={cn(catalogMasterFormPlainInputClass, errors.email && "border-destructive")}
              />
              {errors.email ? <p className="text-destructive text-xs">{errors.email}</p> : null}
            </CatalogLabeledField>

            <CatalogLabeledField label="Usuario de acceso *" htmlFor="u-username" icon={AtSign}>
              <Input
                id="u-username"
                value={username}
                maxLength={LIM.username}
                onChange={(ev) => setUsername(ev.target.value)}
                autoComplete="username"
                placeholder="ej. operador_corte"
                className={cn(catalogMasterFormPlainInputClass, errors.username && "border-destructive")}
              />
              {errors.username ? <p className="text-destructive text-xs">{errors.username}</p> : null}
            </CatalogLabeledField>

            <CatalogLabeledField label="Rol *" htmlFor="u-role" icon={Shield} className="md:col-span-2">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger
                  id="u-role"
                  className={cn(catalogMasterFormPlainInputClass, "w-full", errors.role && "border-destructive")}
                >
                  <SelectValue placeholder="Seleccione rol…" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role ? <p className="text-destructive text-xs">{errors.role}</p> : null}
            </CatalogLabeledField>
          </div>

          <div className={cn(catalogMasterFormSectionClass, "mt-2")}>
            <h2 className="text-base font-semibold tracking-tight">
              {isEdit ? "Contraseña (opcional)" : "Contraseña *"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isEdit
                ? "Déjela vacía para no cambiarla. Si escribe una nueva, cerrará las sesiones abiertas de ese usuario."
                : "Mínimo 8 caracteres. Compártela de forma segura con la persona."}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <CatalogLabeledField
              label={isEdit ? "Nueva contraseña" : "Contraseña *"}
              htmlFor="u-password"
              icon={KeyRound}
            >
              <Input
                id="u-password"
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                autoComplete="new-password"
                placeholder={isEdit ? "Dejar vacío para no cambiar" : undefined}
                className={cn(catalogMasterFormPlainInputClass, errors.password && "border-destructive")}
              />
              {errors.password ? <p className="text-destructive text-xs">{errors.password}</p> : null}
            </CatalogLabeledField>

            <CatalogLabeledField
              label={isEdit ? "Confirmar nueva contraseña" : "Confirmar contraseña *"}
              htmlFor="u-password2"
              icon={KeyRound}
            >
              <Input
                id="u-password2"
                type="password"
                value={passwordConfirmation}
                onChange={(ev) => setPasswordConfirmation(ev.target.value)}
                autoComplete="new-password"
                className={cn(
                  catalogMasterFormPlainInputClass,
                  errors.passwordConfirmation && "border-destructive",
                )}
              />
              {errors.passwordConfirmation ? (
                <p className="text-destructive text-xs">{errors.passwordConfirmation}</p>
              ) : null}
            </CatalogLabeledField>
          </div>

          <div className={catalogMasterFormActionsClass}>
            <Button type="button" variant="outline" className="border-primary/25" asChild>
              <Link to={returnTo}>Cancelar</Link>
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[10rem] shadow-sm">
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </div>
        </form>
      )}
    </CatalogPageShell>
  )
}
