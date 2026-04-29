import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch, ApiError } from "@/lib/api"

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

export default function PasswordResetRequestsPage() {
  const [rows, setRows] = useState<PasswordResetRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
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

  function openSetPassword(userId: number) {
    setSelectedUserId(userId)
    setPassword("")
    setPasswordConfirmation("")
    setDialogOpen(true)
  }

  async function submitPassword() {
    if (selectedUserId === null) return
    setSubmitting(true)
    try {
      await apiFetch(`users/${selectedUserId}/password`, {
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

  return (
    <div className="mx-auto max-w-5xl py-8 px-4 space-y-6">
      <div className="flex items-center gap-2">
        <KeyRound className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Solicitudes de contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Restablecimiento interno (sin correo). Las solicitudes nuevas también aparecen en la
            campana de alertas.
          </p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Identificador</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No hay solicitudes pendientes.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("es-VE")}
                  </TableCell>
                  <TableCell>{r.user?.name ?? "—"}</TableCell>
                  <TableCell>{r.user?.username ?? r.user?.email ?? "—"}</TableCell>
                  <TableCell>{r.user?.role ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openSetPassword(r.user.id)}
                    >
                      Nueva contraseña
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Establecer nueva contraseña</DialogTitle>
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
              <Label htmlFor="npc">Confirmar</Label>
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
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
