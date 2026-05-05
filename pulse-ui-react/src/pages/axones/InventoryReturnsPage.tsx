"use client"

import { useCallback, useEffect, useState } from "react"
import { PackageOpen } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import {
  AXONES_INVENTORY_FILTER_INPUT_CLASS,
  AXONES_INVENTORY_PAGE_CLASS,
  AxonesPageHeader,
  AxonesTableCard,
} from "@/components/axones/inventory-page-layout"
import { LoadingTableRow } from "@/components/axones/LoadingStates"
import { labelInventoryArea } from "@/lib/inventory-area-labels"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { ReasonModal } from "@/components/axones/ReasonModal"
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

type ReturnRow = {
  id: number
  material_id?: number
  work_order_id: number | null
  status: string
  quantity: string
  destination_area: string
  material?: Pick<MaterialRow, "sku" | "name"> & {
    supplier?: { id: number; name: string } | null
  }
  work_order?: { code: string }
}

function returnStatusLabel(status: string): string {
  if (status === "pending") return "Pendiente"
  if (status === "accepted") return "Aceptada"
  return status
}

export default function InventoryReturnsPage() {
  const [retStatus, setRetStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ReturnRow> | null>(null)
  const [reasonModalOpen, setReasonModalOpen] = useState(false)
  const [pendingAcceptId, setPendingAcceptId] = useState<number | null>(null)
  const [lastReason, setLastReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<ReturnRow>>(
        "inventory-returns",
        {
          query: {
            page,
            per_page: 20,
            status: retStatus !== "all" ? retStatus : undefined,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las devoluciones.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, retStatus])

  useEffect(() => {
    void load()
  }, [load])

  async function acceptReturn(id: number, reason: string) {
    try {
      await apiFetch(`inventory-returns/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
      toast.success("Devolución aceptada; ingreso aplicado al inventario.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo aceptar la devolución.")
    }
  }

  const showInitialSkeleton = loading && rows === null

  return (
    <div className={AXONES_INVENTORY_PAGE_CLASS}>
      <AxonesPageHeader
        title="Devoluciones a inventario"
        description="Pendiente hasta aceptar ingreso. Bobinas rechazadas: tras aceptar, use la acción en la fila."
        actions={
          <>
            <Button type="button" size="sm" asChild>
              <Link to="/devoluciones/nueva">Nueva devolución</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link to="/devoluciones/nueva?demo=1">Ver ejemplo</Link>
            </Button>
          </>
        }
      />

      {showInitialSkeleton ? (
        <AxonesTableCard>
          <div className="border-b p-4">
            <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Área destino</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <LoadingTableRow colSpan={8} />
              </TableBody>
            </Table>
          </div>
        </AxonesTableCard>
      ) : (
        <>
          <AxonesTableCard>
            <div className="border-b p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="grid w-44 gap-2">
                  <Label>Estado</Label>
                  <Select
                    value={retStatus}
                    onValueChange={(v) => {
                      setRetStatus(v)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className={AXONES_INVENTORY_FILTER_INPUT_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">{returnStatusLabel("pending")}</SelectItem>
                      <SelectItem value="accepted">{returnStatusLabel("accepted")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="secondary" onClick={() => void load()}>
                  Actualizar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>OT</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Área destino</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingTableRow colSpan={8} />
                  ) : !rows?.data.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
                          <div className="bg-muted/70 text-muted-foreground rounded-full p-3">
                            <PackageOpen className="h-8 w-8" aria-hidden />
                          </div>
                          <div className="max-w-sm space-y-2">
                            <p className="text-foreground text-sm font-medium">Sin devoluciones</p>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              Cree una con{" "}
                              <Link className="text-primary font-medium underline" to="/devoluciones/nueva">
                                Nueva devolución
                              </Link>{" "}
                              o explore el formulario con{" "}
                              <Link className="text-primary font-medium underline" to="/devoluciones/nueva?demo=1">
                                datos de ejemplo
                              </Link>
                              .
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.data.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.id}</TableCell>
                        <TableCell>
                          {r.work_order?.code ?? r.work_order_id ?? "—"}
                        </TableCell>
                        <TableCell>
                          {r.material
                            ? `${r.material.sku} · ${r.material.name}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[10rem] truncate" title={r.material?.supplier?.name ?? undefined}>
                          {r.material?.supplier?.name?.trim() ? r.material.supplier.name : "—"}
                        </TableCell>
                        <TableCell>{r.quantity}</TableCell>
                        <TableCell>{labelInventoryArea(r.destination_area)}</TableCell>
                        <TableCell>{returnStatusLabel(r.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                            {r.status === "pending" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setPendingAcceptId(r.id)
                                  setReasonModalOpen(true)
                                }}
                              >
                                Aceptar ingreso
                              </Button>
                            ) : null}
                            {r.destination_area === "bobinas_rechazadas" ? (
                              <Button type="button" size="sm" variant="outline" asChild>
                                <Link
                                  to={`/bobinas/registrar-rechazada?devolucion_id=${r.id}`}
                                  title="Registrar bobina única vinculada a esta devolución"
                                >
                                  Bobina rechazada
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </AxonesTableCard>

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
        </>
      )}

      <ReasonModal
        open={reasonModalOpen}
        initialValue={lastReason}
        title="Razón del ingreso"
        description="Para aceptar la devolución debe indicar una razón operativa."
        confirmLabel="Aceptar ingreso"
        onCancel={() => {
          setReasonModalOpen(false)
          setPendingAcceptId(null)
        }}
        onConfirm={(reason) => {
          const id = pendingAcceptId
          if (!id) return
          setLastReason(reason)
          setReasonModalOpen(false)
          setPendingAcceptId(null)
          void acceptReturn(id, reason)
        }}
      />
    </div>
  )
}
