"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowRightCircle, CircleHelp, Search } from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type {
  ClientOrderDetailRecord,
  ClientOrderRow,
  LaravelPaginated,
  WorkOrderListRow,
} from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MachineValue =
  | ""
  | "COMEXI 1"
  | "COMEXI 3"
  | "Cortadora China"
  | "Cortadora Permaco"

const MACHINE_OPTIONS: Array<{
  group: string
  options: Array<{ value: Exclude<MachineValue, "">; label: string }>
}> = [
  {
    group: "Impresión",
    options: [
      { value: "COMEXI 1", label: "COMEXI 1" },
      { value: "COMEXI 3", label: "COMEXI 3" },
    ],
  },
  {
    group: "Laminación",
    options: [
      { value: "Cortadora China", label: "Cortadora China" },
      { value: "Cortadora Permaco", label: "Cortadora Permaco" },
    ],
  },
]

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function normalizeTipoImpresionEstructura(value: unknown): "superficie" | "reverso" {
  const raw = readString(value).toLowerCase().trim()
  if (raw.includes("superf")) return "superficie"
  if (raw.includes("revers")) return "reverso"
  return "reverso"
}

function formMachine(row: WorkOrderListRow): string {
  const doc = row.technical_document?.form
  if (!doc) return "—"
  const m = readString(doc.maquina)
  return m || "—"
}

function formPedidoKg(row: WorkOrderListRow): string {
  const doc = row.technical_document?.form
  if (!doc) return "—"
  const v = doc.pedidoKg
  if (typeof v === "number") return String(v)
  if (typeof v === "string" && v.trim()) return v.trim()
  return "—"
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
  } catch {
    return iso
  }
}

type SupervisorFilter = "all" | "created" | "in_progress" | "completed"

function statusLabel(value: string | null | undefined): string {
  const s = (value ?? "").toLowerCase().trim()
  if (s === "open") return "Abierta"
  if (s === "in_progress") return "En proceso"
  if (s === "completed") return "Completada"
  if (s === "cancelled") return "Cancelada"
  return value?.trim() || "—"
}

function boardStageLabel(value: string | null | undefined): string {
  const s = (value ?? "").toLowerCase().trim()
  if (s === "nueva") return "Creada (pendiente OT)"
  if (s === "pendiente") return "Programación"
  if (s === "montaje") return "Montaje"
  if (s === "impresion") return "Impresión"
  if (s === "laminacion") return "Laminación"
  if (s === "corte") return "Corte / Embalaje"
  if (s === "completada") return "Completada"
  return value?.trim() || "—"
}

function supervisorBucket(row: WorkOrderListRow): Exclude<SupervisorFilter, "all"> {
  const stage = (row.board_stage ?? "").toLowerCase().trim()
  const status = (row.status ?? "").toLowerCase().trim()
  if (status === "completed" || stage === "completada") return "completed"
  if (stage === "nueva") return "created"
  return "in_progress"
}

export default function WorkOrdersHubPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()

  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(null)
  const [supervisorFilter, setSupervisorFilter] = useState<SupervisorFilter>("all")

  const [creating, setCreating] = useState(false)
  const [coLoading, setCoLoading] = useState(false)
  const [clientOrders, setClientOrders] = useState<ClientOrderRow[]>([])
  const [clientOrderId, setClientOrderId] = useState<string>("")
  const [coDetail, setCoDetail] = useState<ClientOrderDetailRecord | null>(null)
  const [coDetailLoading, setCoDetailLoading] = useState(false)

  const [maquina, setMaquina] = useState<MachineValue>("")

  const canImportMaterialFromCo = useMemo(() => {
    if (!coDetail?.lines?.length) return false
    return coDetail.lines.some(
      (l) => l.material_id != null && !Number.isNaN(Number(l.material_id)) && Number(l.material_id) > 0,
    )
  }, [coDetail])

  const prefillAppliedRef = useRef(false)
  useEffect(() => {
    if (prefillAppliedRef.current) return
    const fromUrl = (searchParams.get("prefillCo") ?? "").trim()
    if (fromUrl && /^\d+$/.test(fromUrl)) {
      prefillAppliedRef.current = true
      setClientOrderId(fromUrl)
    }
  }, [searchParams])

  useEffect(() => {
    const id = clientOrderId.trim()
    if (!id || !/^\d+$/.test(id)) {
      setCoDetail(null)
      return
    }
    setCoDetailLoading(true)
    let cancelled = false
    void (async () => {
      try {
        const d = await apiFetch<ClientOrderDetailRecord>(`client-orders/${id}`)
        if (!cancelled) setCoDetail(d)
      } catch {
        if (!cancelled) setCoDetail(null)
      } finally {
        if (!cancelled) setCoDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientOrderId])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
        query: {
          page,
          per_page: 20,
          q: search || undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes de trabajo.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  const loadClientOrders = useCallback(async () => {
    setCoLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<ClientOrderRow>>("client-orders", {
        query: { per_page: 100, page: 1, sort: "asc" },
      })
      setClientOrders(data.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar los pedidos del cliente.")
      setClientOrders([])
    } finally {
      setCoLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const visibleRows = useMemo(() => {
    const all = rows?.data ?? []
    if (supervisorFilter === "all") return all
    return all.filter((r) => supervisorBucket(r) === supervisorFilter)
  }, [rows?.data, supervisorFilter])

  const supervisorCounts = useMemo(() => {
    const all = rows?.data ?? []
    const created = all.filter((r) => supervisorBucket(r) === "created").length
    const inProgress = all.filter((r) => supervisorBucket(r) === "in_progress").length
    const completed = all.filter((r) => supervisorBucket(r) === "completed").length
    return {
      all: all.length,
      created,
      in_progress: inProgress,
      completed,
    }
  }, [rows?.data])

  function clientOrderLabel(c: ClientOrderRow): string {
    const parts = [c.code, c.client?.name, c.first_line_with_product?.product?.name]
      .map((p) => (typeof p === "string" && p.trim() ? p.trim() : null))
      .filter((p): p is string => Boolean(p))
    return parts.length ? parts.join(" — ") : c.code
  }

  async function createOt() {
    const coId = clientOrderId.trim() ? Number(clientOrderId) : null
    if (!coId || !Number.isFinite(coId) || coId < 1) {
      toast.error("Seleccione un pedido del cliente (OC) ya registrado.")
      return
    }
    setCreating(true)
    const importMaterial = canImportMaterialFromCo
    try {
      const res = await apiFetch<{ id: number }>("work-orders", {
        method: "POST",
        body: JSON.stringify({
          client_order_id: coId,
          import_client_order_lines: importMaterial,
          auto_create_material_request: importMaterial,
          originating_area: "printing",
          board_stage: "nueva",
        }),
      })

      // Guardar el “maestro” de la planilla (maquina/planchas) en el JSON del documento OT.
      if (maquina) {
        const payload = await apiFetch<{ prefill: Record<string, unknown>; form: Record<string, unknown> | null }>(
          `work-orders/${res.id}/orden-trabajo`,
        )
        const currentForm = {
          ...(payload.prefill ?? {}),
          ...(payload.form ?? {}),
        } as Record<string, unknown>
        const tipoImpresionEstructura = normalizeTipoImpresionEstructura(
          readString(currentForm.tipoImpresionEstructura) || readString(currentForm.tipoImpresion),
        )

        await apiFetch(`work-orders/${res.id}/orden-trabajo`, {
          method: "PUT",
          body: JSON.stringify({
            form: {
              ...currentForm,
              maquina,
              tipoImpresionEstructura,
            },
          }),
        })
      }

      toast.success("OT creada.")
      nav(`/ordenes-trabajo/${res.id}`)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la OT.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Tabs value="lista">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="lista">Lista de órdenes de trabajo</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="wo-ref">Buscar orden (número / referencia / cliente)</Label>
              <Input
                id="wo-ref"
                placeholder="Ej: OT-2026-0007, PED-…, Millennium…"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    setPage(1)
                    setSearch(q.trim())
                  }
                }}
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                setPage(1)
                setSearch(q.trim())
              }}
            >
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
            <Button type="button" variant="secondary" onClick={() => void loadList()}>
              Actualizar
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-center text-black">Crear orden de trabajo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <p className="md:col-span-3 text-sm text-muted-foreground">
                Seleccione el <span className="font-medium text-foreground">pedido del cliente</span> y la{" "}
                <span className="font-medium text-foreground">máquina</span>, luego pulse{" "}
                <span className="font-medium text-foreground">Crear orden</span>.
              </p>
              <div className="grid gap-2 md:col-span-2">
                <Label>Pedido del cliente (OC) a vincular *</Label>
                <Select
                  value={clientOrderId}
                  onValueChange={(v) => setClientOrderId(v)}
                  onOpenChange={(open) => {
                    if (open && clientOrders.length === 0 && !coLoading) void loadClientOrders()
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={coLoading ? "Cargando…" : "Seleccione…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clientOrders.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {clientOrderLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {clientOrderId && coDetailLoading ? (
                <p className="md:col-span-3 text-sm text-muted-foreground">Cargando…</p>
              ) : null}
              {clientOrderId && !coDetailLoading && !coDetail ? (
                <p className="md:col-span-3 text-sm text-destructive">
                  No se pudo cargar la información del pedido. Intente otra vez en unos segundos.
                </p>
              ) : null}

              <div className="grid gap-2">
                <Label>Máquina</Label>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={maquina}
                  onChange={(ev) => setMaquina(ev.target.value as MachineValue)}
                >
                  <option value="">Seleccionar…</option>
                  {MACHINE_OPTIONS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <Button type="button" onClick={() => void createOt()} disabled={creating}>
                  {creating ? "Creando…" : "Crear orden"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-slate-700 shadow-sm">
            <p className="flex items-start gap-2">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <span>
                <span className="font-medium text-slate-900">Paso siguiente:</span> pulse{" "}
                <span className="font-semibold text-slate-900">Abrir planilla existente</span>.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={supervisorFilter === "all" ? "default" : "outline"} onClick={() => setSupervisorFilter("all")}>
              Todas ({supervisorCounts.all})
            </Button>
            <Button type="button" size="sm" variant={supervisorFilter === "created" ? "default" : "outline"} onClick={() => setSupervisorFilter("created")}>
              Creadas ({supervisorCounts.created})
            </Button>
            <Button type="button" size="sm" variant={supervisorFilter === "in_progress" ? "default" : "outline"} onClick={() => setSupervisorFilter("in_progress")}>
              En proceso ({supervisorCounts.in_progress})
            </Button>
            <Button type="button" size="sm" variant={supervisorFilter === "completed" ? "default" : "outline"} onClick={() => setSupervisorFilter("completed")}>
              Completadas ({supervisorCounts.completed})
            </Button>
          </div>

          <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center text-black">N° Orden</TableHead>
                  <TableHead className="text-center text-black">Fecha</TableHead>
                  <TableHead className="text-center text-black">Cliente</TableHead>
                  <TableHead className="text-center text-black">Producto</TableHead>
                  <TableHead className="text-center text-black">Máquina</TableHead>
                  <TableHead className="text-center text-black">Etapa real</TableHead>
                  <TableHead className="text-center text-black">Estado OT</TableHead>
                  <TableHead className="text-center text-black">Creada por</TableHead>
                  <TableHead className="text-center text-black">Kg</TableHead>
                  <TableHead className="text-center text-black">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !visibleRows.length ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground">
                      Sin órdenes para este filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((o) => (
                    <TableRow key={o.id} className="text-sm transition-colors hover:bg-muted/50">
                      <TableCell className="font-mono text-sm py-3.5">{o.code}</TableCell>
                      <TableCell className="py-3.5">{formatDate(o.document_date)}</TableCell>
                      <TableCell className="py-3.5">{o.client?.name ?? "—"}</TableCell>
                      <TableCell className="py-3.5">{o.product?.name ?? "—"}</TableCell>
                      <TableCell className="py-3.5">{formMachine(o)}</TableCell>
                      <TableCell className="py-3.5">{boardStageLabel(o.board_stage)}</TableCell>
                      <TableCell className="py-3.5">{statusLabel(o.status)}</TableCell>
                      <TableCell className="py-3.5">{o.creator?.name ?? "—"}</TableCell>
                      <TableCell className="py-3.5">{formPedidoKg(o)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button
                          asChild
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                        >
                          <Link to={`/ordenes-trabajo/${o.id}`}>
                            <ArrowRightCircle className="h-4 w-4" />
                            Abrir planilla existente
                          </Link>
                        </Button>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}

