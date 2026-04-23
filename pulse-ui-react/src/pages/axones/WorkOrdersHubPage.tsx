"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Search } from "lucide-react"

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
  | "COMEXI 2"
  | "COMEXI 3"
  | "NEXUS"
  | "NEXUS 2"
  | "Cortadora China"
  | "Cortadora Permaco"
  | "Cortadora Novograf"

const MACHINE_OPTIONS: Array<{
  group: string
  options: Array<{ value: Exclude<MachineValue, "">; label: string }>
}> = [
  {
    group: "Impresión",
    options: [
      { value: "COMEXI 1", label: "COMEXI 1 (Planchas 067)" },
      { value: "COMEXI 2", label: "COMEXI 2" },
      { value: "COMEXI 3", label: "COMEXI 3 (Planchas 045)" },
    ],
  },
  {
    group: "Laminación",
    options: [
      { value: "NEXUS", label: "NEXUS (Principal)" },
      { value: "NEXUS 2", label: "NEXUS 2" },
    ],
  },
  {
    group: "Corte",
    options: [
      { value: "Cortadora China", label: "Cortadora China" },
      { value: "Cortadora Permaco", label: "Cortadora Permaco" },
      { value: "Cortadora Novograf", label: "Cortadora Novograf" },
    ],
  },
]

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
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

function formPrioridad(row: WorkOrderListRow): string {
  const doc = row.technical_document?.form
  if (!doc) return "—"
  return readString(doc.prioridad) || "—"
}

function formEstadoOrden(row: WorkOrderListRow): string {
  const doc = row.technical_document?.form
  if (!doc) return row.board_stage ?? row.status ?? "—"
  return readString(doc.estadoOrden) || row.board_stage || row.status || "—"
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

export default function WorkOrdersHubPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const tab = (searchParams.get("tab") ?? "").toLowerCase().trim()

  const [activeTab, setActiveTab] = useState(tab === "orden" ? "orden" : "lista")

  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(null)

  const [creating, setCreating] = useState(false)
  const [coLoading, setCoLoading] = useState(false)
  const [clientOrders, setClientOrders] = useState<ClientOrderRow[]>([])
  const [clientOrderId, setClientOrderId] = useState<string>("")
  const [coDetail, setCoDetail] = useState<ClientOrderDetailRecord | null>(null)
  const [coDetailLoading, setCoDetailLoading] = useState(false)

  const [maquina, setMaquina] = useState<MachineValue>("")
  const [planchas, setPlanchas] = useState("")
  const showPlanchas = maquina === "COMEXI 1" || maquina === "COMEXI 3"

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
          client_order_reference: search || undefined,
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
        query: { per_page: 50, page: 1 },
      })
      setClientOrders(data.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes de cliente.")
      setClientOrders([])
    } finally {
      setCoLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const createHelp = useMemo(
    () => (
      <Card className="border-l-4 border-sky-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Orden de trabajo (OT)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            La <span className="text-foreground font-medium">OT (orden de trabajo)</span> es el documento maestro de
            producción: una sola planilla con{" "}
            <span className="text-foreground font-medium">cabecera, producto, montaje, impresión, laminación, corte</span> y{" "}
            <span className="text-foreground font-medium">programación</span>, guardada en el servidor.
          </p>
          <p>
            Primero debe existir una <span className="text-foreground font-medium">orden de cliente</span> en{" "}
            <Link to="/axones/ordenes-cliente" className="text-primary font-medium underline-offset-4 hover:underline">
              Órdenes de cliente
            </Link>
            , con lo que el cliente solicita. Al vincularla aquí, el sistema prepara la producción con los datos que
            correspondan; el pedido del cliente sigue administrándose en su módulo.
          </p>
          <p>
            Seleccione la <span className="text-foreground font-medium">OC</span>, la <span className="text-foreground font-medium">máquina</span> (opcional) y <span className="text-foreground font-medium">Crear orden</span>; luego abra la OT para completar el resto.
          </p>
        </CardContent>
      </Card>
    ),
    [],
  )

  function clientOrderLabel(c: ClientOrderRow): string {
    const parts = [c.code, c.client?.name, c.first_line_with_product?.product?.name]
      .map((p) => (typeof p === "string" && p.trim() ? p.trim() : null))
      .filter((p): p is string => Boolean(p))
    return parts.length ? parts.join(" — ") : c.code
  }

  async function createOt() {
    const coId = clientOrderId.trim() ? Number(clientOrderId) : null
    if (!coId || !Number.isFinite(coId) || coId < 1) {
      toast.error("Seleccione una orden de cliente (OC) ya registrada.")
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
        await apiFetch(`work-orders/${res.id}/orden-trabajo`, {
          method: "PUT",
          body: JSON.stringify({
            form: {
              maquina,
              planchas: showPlanchas ? (planchas.trim() || null) : null,
            },
          }),
        })
      }

      toast.success("OT creada.")
      setActiveTab("orden")
      nav(`/axones/ordenes-trabajo/${res.id}`)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la OT.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {createHelp}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="lista">Lista de órdenes de trabajo</TabsTrigger>
          <TabsTrigger value="orden">Orden de trabajo</TabsTrigger>
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
              <CardTitle className="text-base">Crear orden de trabajo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <p className="md:col-span-3 text-sm text-muted-foreground">
                Elija la <span className="font-medium text-foreground">orden de cliente</span> y pulse{" "}
                <span className="font-medium text-foreground">Crear orden</span>. Se abrirá la planilla de esta OT para
                completar producción. Si aún no tiene pedido registrado, créelo en{" "}
                <Link to="/axones/ordenes-cliente/nueva" className="font-medium text-primary underline-offset-4 hover:underline">
                  Nueva orden de cliente
                </Link>
                .
              </p>
              <div className="grid gap-2 md:col-span-2">
                <Label>Orden de cliente (OC) a vincular *</Label>
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

              {showPlanchas ? (
                <div className="grid gap-2 md:col-span-2">
                  <Label>Planchas</Label>
                  <Input
                    placeholder="Ej: 067"
                    value={planchas}
                    onChange={(ev) => setPlanchas(ev.target.value)}
                  />
                </div>
              ) : null}

              <div className="md:col-span-3">
                <Button type="button" onClick={() => void createOt()} disabled={creating}>
                  {creating ? "Creando…" : "Crear orden"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Orden</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Kg</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Sin órdenes.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-sm">{o.code}</TableCell>
                      <TableCell>{formatDate(o.document_date)}</TableCell>
                      <TableCell>{o.client?.name ?? "—"}</TableCell>
                      <TableCell>{o.product?.name ?? "—"}</TableCell>
                      <TableCell>{formMachine(o)}</TableCell>
                      <TableCell>{formPedidoKg(o)}</TableCell>
                      <TableCell>{formPrioridad(o)}</TableCell>
                      <TableCell>{formEstadoOrden(o)}</TableCell>
                      <TableCell>
                        <Link
                          className="text-primary text-sm underline-offset-4 hover:underline"
                          to={`/axones/ordenes-trabajo/${o.id}`}
                          onClick={() => setActiveTab("orden")}
                        >
                          Abrir
                        </Link>
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

        <TabsContent value="orden" className="mt-4 space-y-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Orden de trabajo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Selecciona una orden desde <span className="text-foreground font-medium">Lista de órdenes</span> y
                presiona <span className="text-foreground font-medium">Abrir</span>. Aquí verás el formulario completo
                con las secciones: cabecera, datos del producto, montaje, impresión, laminación, corte y
                programación.
              </p>
              <p>
                (En progreso) Esta pestaña será la planilla 1:1 como el diseño original, guardando todo por orden.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

