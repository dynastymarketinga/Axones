"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { MoreHorizontal, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated } from "@/types/api"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

const AREA_OPTIONS = [
  { value: "almacen", label: "Almacén" },
  { value: "impresion", label: "Impresión" },
  { value: "laminacion", label: "Laminación" },
  { value: "corte", label: "Corte" },
  { value: "montaje", label: "Montaje" },
  { value: "tintas", label: "Tintas" },
] as const

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "done", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
] as const

type AreaReqRow = {
  id: number
  area: string
  status: string
  title: string | null
  body?: string | null
  work_order_id: number | null
  work_order?: { code: string }
  requester?: { name: string }
}

export default function AreaRequestsPage() {
  const [area, setArea] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<AreaReqRow> | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newArea, setNewArea] = useState("impresion")
  const [newTitle, setNewTitle] = useState("")
  const [newBody, setNewBody] = useState("")
  const [newWorkOrderId, setNewWorkOrderId] = useState("")

  const [editRow, setEditRow] = useState<AreaReqRow | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const [deleteRow, setDeleteRow] = useState<AreaReqRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<AreaReqRow>>("area-requests", {
        query: {
          page,
          per_page: 20,
          area: area !== "all" ? area : undefined,
          status: status !== "all" ? status : undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las solicitudes por área.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, area, status])

  useEffect(() => {
    void load()
  }, [load])

  function openEdit(r: AreaReqRow) {
    setEditRow(r)
    setEditTitle(r.title ?? "")
    setEditBody(r.body ?? "")
  }

  async function saveEdit() {
    if (!editRow) return
    setEditSaving(true)
    try {
      await apiFetch(`area-requests/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(),
          body: editBody.trim() || null,
        }),
      })
      toast.success("Solicitud actualizada.")
      setEditRow(null)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar.")
    } finally {
      setEditSaving(false)
    }
  }

  async function patchStatus(id: number, next: "done" | "cancelled") {
    try {
      await apiFetch(`area-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      })
      toast.success(next === "done" ? "Marcada como completada." : "Solicitud cancelada.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo actualizar el estado.")
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return
    setDeleteLoading(true)
    try {
      await apiFetch(`area-requests/${deleteRow.id}`, { method: "DELETE" })
      toast.success("Solicitud eliminada.")
      setDeleteRow(null)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo eliminar.")
    } finally {
      setDeleteLoading(false)
    }
  }

  async function submitCreate() {
    const title = newTitle.trim()
    if (!title) {
      toast.error("Indique un título.")
      return
    }
    const woRaw = newWorkOrderId.trim()
    const payload: Record<string, unknown> = {
      area: newArea,
      title,
      body: newBody.trim() || undefined,
    }
    if (woRaw) {
      const n = Number(woRaw)
      if (!Number.isFinite(n) || n < 1) {
        toast.error("ID de orden de trabajo inválido.")
        return
      }
      payload.work_order_id = n
    }

    setCreating(true)
    try {
      await apiFetch("area-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      toast.success("Solicitud registrada.")
      setCreateOpen(false)
      setNewTitle("")
      setNewBody("")
      setNewWorkOrderId("")
      setPage(1)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la solicitud.")
    } finally {
      setCreating(false)
    }
  }

  function areaLabel(code: string) {
    return AREA_OPTIONS.find((o) => o.value === code)?.label ?? code
  }

  function statusLabel(code: string) {
    return STATUS_OPTIONS.find((o) => o.value === code)?.label ?? code
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Solicitudes entre áreas
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Coordinación entre áreas de producción (pase de trabajo, avisos ligados a una OT).{" "}
          <strong>No rebaja inventario.</strong> Para insumos con material del almacén, autorización y
          rebaja automática use{" "}
          <Link className="text-primary font-medium underline-offset-4 hover:underline" to="solicitudes-material">
            Solicitudes de insumos
          </Link>{" "}
          y revise el historial en{" "}
          <Link className="text-primary font-medium underline-offset-4 hover:underline" to="movimientos-inventario">
            Movimientos
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-44 gap-2">
          <Label>Área</Label>
          <Select
            value={area}
            onValueChange={(v) => {
              setArea(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {AREA_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-44 gap-2">
          <Label>Estado</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Actualizar
        </Button>
        <Button type="button" className="ml-auto sm:ml-0" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva solicitud
        </Button>
      </div>

      <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[72px]">ID</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>OT</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right w-[72px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows?.data.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Sin solicitudes.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{areaLabel(r.area)}</TableCell>
                  <TableCell>
                    {r.work_order_id ? (
                      <Link
                        className="text-primary underline-offset-4 hover:underline"
                        to={`ordenes-trabajo/${r.work_order_id}`}
                      >
                        {r.work_order?.code ?? r.work_order_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.title ?? undefined}>
                    {r.title ?? "—"}
                  </TableCell>
                  <TableCell>{r.requester?.name ?? "—"}</TableCell>
                  <TableCell>{statusLabel(r.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Menú</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {r.status === "pending" ? (
                          <>
                            <DropdownMenuItem onClick={() => openEdit(r)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void patchStatus(r.id, "done")}>
                              Marcar completada
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void patchStatus(r.id, "cancelled")}>
                              Cancelar
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {r.status !== "done" ? (
                          <>
                            {r.status === "pending" ? <DropdownMenuSeparator /> : null}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteRow(r)}
                            >
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {r.status === "done" ? (
                          <DropdownMenuItem disabled>Solo lectura (completada)</DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {rows && rows.last_page > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {rows.current_page} de {rows.last_page} · {rows.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.current_page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.current_page >= rows.last_page || loading}
              onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva solicitud entre áreas</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Área destino</Label>
              <Select value={newArea} onValueChange={setNewArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nar-title">Título</Label>
              <Input
                id="nar-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Pasar bobinas a laminación"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nar-body">Detalle (opcional)</Label>
              <Textarea
                id="nar-body"
                rows={3}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nar-wo">OT (ID numérico, opcional)</Label>
              <Input
                id="nar-wo"
                inputMode="numeric"
                value={newWorkOrderId}
                onChange={(e) => setNewWorkOrderId(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cerrar
            </Button>
            <Button type="button" disabled={creating} onClick={() => void submitCreate()}>
              {creating ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar solicitud #{editRow?.id}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ed-title">Título</Label>
              <Input
                id="ed-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-body">Detalle</Label>
              <Textarea
                id="ed-body"
                rows={4}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={editSaving} onClick={() => void saveEdit()}>
              {editSaving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar solicitud #{deleteRow?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las solicitudes completadas no pueden eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={() => void confirmDelete()}
            >
              {deleteLoading ? "Eliminando…" : "Eliminar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
