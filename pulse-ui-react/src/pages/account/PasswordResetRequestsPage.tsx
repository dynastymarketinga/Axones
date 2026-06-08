"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  CalendarDays,
  KeyRound,
  Settings2,
  Shield,
  User,
  UserRound,
} from "lucide-react"

import { CatalogEmptyState } from "@/components/axones/CatalogEmptyState"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogTableHead, CatalogTableHeadRight } from "@/components/axones/CatalogTableHead"
import {
  catalogMasterTablePanelClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingTableRow } from "@/components/axones/LoadingStates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch, ApiError } from "@/lib/api"
import { formatAxonesRoleLabel } from "@/lib/axones-role-labels"
import { catalogCountLabel } from "@/lib/catalog-count-label"

type UserBrief = {
  id: number
  name: string
  email: string
  username: string | null
  role?: string
}

type PasswordResetRequestRow = {
  id: number
  status: string
  created_at: string
  user: UserBrief
}

type Paginated<T> = {
  data: T[]
}

function formatRequestDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export default function PasswordResetRequestsPage() {
  const [rows, setRows] = useState<PasswordResetRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserBrief | null>(null)
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<Paginated<PasswordResetRequestRow>>(
        "password-reset-requests",
        { query: { per_page: 50 } },
      )
      setRows(res.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openSetPassword(user: UserBrief) {
    setSelectedUser(user)
    setPassword("")
    setPasswordConfirmation("")
    setDialogOpen(true)
  }

  async function submitPassword() {
    if (!selectedUser) return
    setSubmitting(true)
    try {
      await apiFetch(`users/${selectedUser.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({
          password,
          password_confirmation: passwordConfirmation,
        }),
      })
      toast.success("Contraseña actualizada.")
      setDialogOpen(false)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = rows.length

  return (
    <CatalogPageShell
      title="Solicitudes de contraseña"
      subtitle="Aquí puedes restablecer la clave de un compañero cuando la haya olvidado. No se envía correo: tú defines la nueva contraseña."
      icon={KeyRound}
      headerVariant="elevated"
      statBadge={
        !loading ? (
          <Badge variant="secondary" className="font-normal tabular-nums">
            {catalogCountLabel(pendingCount, "pendiente", "pendientes")}
          </Badge>
        ) : null
      }
    >
      <p className="text-muted-foreground -mt-2 text-xs leading-relaxed">
        Las solicitudes nuevas también aparecen en la campana de alertas.
      </p>

      <div className={catalogMasterTablePanelClass}>
        <Table className="w-full min-w-[640px]">
          <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm">
            <TableRow className={catalogTableHeaderRowClass}>
              <CatalogTableHead icon={CalendarDays}>Fecha</CatalogTableHead>
              <CatalogTableHead icon={User}>Usuario</CatalogTableHead>
              <CatalogTableHead icon={UserRound}>Identificador</CatalogTableHead>
              <CatalogTableHead icon={Shield}>Rol</CatalogTableHead>
              <CatalogTableHeadRight icon={Settings2}>Acción</CatalogTableHeadRight>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingTableRow colSpan={5} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  <CatalogEmptyState
                    icon={KeyRound}
                    title="Todo al día"
                    description="No hay solicitudes pendientes. Cuando alguien pida ayuda desde el inicio de sesión, aparecerá aquí y en la campana de alertas."
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={catalogTableBodyRowClass}>
                  <TableCell className={catalogTableBodyCellClass}>
                    {formatRequestDate(r.created_at)}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {r.user?.name ?? "—"}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {r.user?.username ?? r.user?.email ?? "—"}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    <Badge variant="secondary" className="font-normal">
                      {formatAxonesRoleLabel(r.user?.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className={`${catalogTableBodyCellClass} text-right`}>
                    <Button
                      type="button"
                      size="sm"
                      className="shadow-sm"
                      onClick={() => r.user && openSetPassword(r.user)}
                    >
                      Asignar nueva clave
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar nueva contraseña</DialogTitle>
            <DialogDescription>
              {selectedUser
                ? `Define una clave nueva para ${selectedUser.name}. Compártela de forma segura con esa persona.`
                : "Define una clave nueva para el usuario seleccionado."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="np">Nueva contraseña</Label>
              <Input
                id="np"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="npc">Confirmar contraseña</Label>
              <Input
                id="npc"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void submitPassword()}
              disabled={submitting || password.length < 8 || password !== passwordConfirmation}
            >
              {submitting ? "Guardando…" : "Guardar contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CatalogPageShell>
  )
}
