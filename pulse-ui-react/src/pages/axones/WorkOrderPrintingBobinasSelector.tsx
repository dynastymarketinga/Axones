import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

type BobinaRow = {
  id: number
  code?: string | null
  material_id?: number
  status: string
  weight_kg: string | null
  material?: { sku: string; name: string; supplier?: { id: number; name: string } | null }
}

type PrintingBobinaUsageRow = {
  id: number
  created_at?: string | null
  bobina_id?: number | null
  material_id?: number | null
  quantity_used_kg?: number | string | null
  quantity_finished_kg?: number | string | null
  notes?: string | null
  material?: { sku?: string | null; name?: string | null } | null
  bobina?: { id: number; code?: string | null } | null
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export default function WorkOrderPrintingBobinasSelector({
  workOrderId,
  disabled,
  visible,
  hasActiveTurno,
  devolucionBuenaRaw,
  devolucionRechazadaRaw,
  onSetDevolucionBuena,
  onSetDevolucionRechazada,
  onOpenReturnWarehouse,
}: {
  workOrderId: number
  disabled: boolean
  /** Mantiene el layout sin costear requests si no aplica. */
  visible: boolean
  hasActiveTurno: boolean
  devolucionBuenaRaw: string
  devolucionRechazadaRaw: string
  onSetDevolucionBuena: (v: string) => void
  onSetDevolucionRechazada: (v: string) => void
  onOpenReturnWarehouse: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [bobinas, setBobinas] = useState<BobinaRow[]>([])
  const [usages, setUsages] = useState<PrintingBobinaUsageRow[]>([])

  const [materialId, setMaterialId] = useState<string>("")
  const [search, setSearch] = useState("")
  const [selectedBobinaId, setSelectedBobinaId] = useState<string>("")
  const [qtyUsed, setQtyUsed] = useState("")
  const [qtyFinished, setQtyFinished] = useState("")
  const [notes, setNotes] = useState("")

  const load = useCallback(async () => {
    if (!visible) return
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const [matRes, bobRes, printingState] = await Promise.all([
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { per_page: 200, page: 1, inventory_area: "material" },
        }).catch(() => ({ data: [] } as unknown as LaravelPaginated<MaterialRow>)),
        apiFetch<LaravelPaginated<BobinaRow>>("bobinas", {
          query: { per_page: 200, page: 1, status: "available" },
        }),
        apiFetch<Record<string, unknown>>(`work-orders/${workOrderId}/printing`).catch(() => null),
      ])

      setMaterials(matRes.data ?? [])
      setBobinas(bobRes.data ?? [])
      const raw = printingState?.bobina_usages
      setUsages(Array.isArray(raw) ? (raw as PrintingBobinaUsageRow[]) : [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar bobinas disponibles.")
      setMaterials([])
      setBobinas([])
      setUsages([])
    } finally {
      setLoading(false)
    }
  }, [visible, workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  const filteredBobinas = useMemo(() => {
    const q = search.trim().toLowerCase()
    const mid = materialId.trim() ? Number(materialId) : null
    return bobinas
      .filter((b) => b.status === "available")
      .filter((b) => (mid ? b.material_id === mid : true))
      .filter((b) => {
        if (!q) return true
        const parts = [
          b.code ?? "",
          b.material?.sku ?? "",
          b.material?.name ?? "",
          b.material?.supplier?.name ?? "",
          String(b.id),
        ]
        return parts.join(" ").toLowerCase().includes(q)
      })
      .slice(0, 200)
  }, [bobinas, materialId, search])

  const selectedBobina = useMemo(() => {
    const id = Number(selectedBobinaId)
    if (!Number.isFinite(id) || id < 1) return null
    return filteredBobinas.find((b) => b.id === id) ?? null
  }, [filteredBobinas, selectedBobinaId])

  async function registrarUso() {
    if (disabled) return
    const bid = Number(selectedBobinaId)
    if (!Number.isFinite(bid) || bid < 1) {
      toast.error("Seleccione una bobina.")
      return
    }
    const b = bobinas.find((x) => x.id === bid)
    if (!b?.material_id) {
      toast.error("La bobina no tiene material asociado.")
      return
    }
    const used = Number(qtyUsed.trim().replace(",", "."))
    if (!Number.isFinite(used) || used <= 0) {
      toast.error("Indique Kg usados.")
      return
    }
    const finishedRaw = qtyFinished.trim().replace(",", ".")
    const finished = finishedRaw ? Number(finishedRaw) : null
    if (finishedRaw && (!Number.isFinite(finished) || finished! < 0)) {
      toast.error("Kg terminados inválidos.")
      return
    }

    setSaving(true)
    try {
      const created = await apiFetch<PrintingBobinaUsageRow>(
        `work-orders/${workOrderId}/printing/bobina-usages`,
        {
          method: "POST",
          body: JSON.stringify({
            material_id: b.material_id,
            bobina_id: b.id,
            quantity_used_kg: used,
            quantity_finished_kg: finished,
            notes: notes.trim() || null,
          }),
        },
      )
      setUsages((prev) => [created, ...prev].slice(0, 200))
      toast.success("Bobina registrada en la OT.")
      setQtyUsed("")
      setQtyFinished("")
      setNotes("")
      setSelectedBobinaId("")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la bobina.")
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Bobinas individuales (opcional)
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          MVP: seleccione una bobina disponible y registre su consumo en la OT
          usando <span className="font-mono">/work-orders/:id/printing/bobina-usages</span>.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasActiveTurno ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Para usar este módulo, primero inicie un turno (Turno / Grupo / Operador) y presione{" "}
            <span className="font-semibold text-foreground">Iniciar turno</span>.
          </div>
        ) : null}

        <div className="rounded-md border bg-background p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
            Devoluciones
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border bg-muted/10 p-2 text-sm">
              <span className="text-muted-foreground">Dev. buena</span>
              <Input
                className="ot-input-unified mt-1 h-8"
                inputMode="decimal"
                value={devolucionBuenaRaw}
                onChange={(e) => onSetDevolucionBuena(e.target.value)}
                placeholder="0"
                disabled={disabled}
              />
            </div>
            <div className="rounded border bg-muted/10 p-2 text-sm">
              <span className="text-muted-foreground">Dev. rechazada (bobinas)</span>
              <Input
                className="ot-input-unified mt-1 h-8"
                inputMode="numeric"
                value={devolucionRechazadaRaw}
                onChange={(e) => onSetDevolucionRechazada(e.target.value)}
                placeholder="0"
                disabled={disabled}
              />
            </div>
          </div>
          <div className="mt-2">
            <Button type="button" variant="outline" onClick={onOpenReturnWarehouse} disabled={disabled}>
              Registrar devolución real
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2 md:col-span-1">
            <Label>Material (filtro)</Label>
            <Select
              value={materialId}
              onValueChange={(v) => {
                setMaterialId(v === "__all__" ? "" : v)
                setSelectedBobinaId("")
              }}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.sku} · {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Búsqueda</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, SKU, proveedor, ID..."
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Bobina disponible</Label>
            <Select
              value={selectedBobinaId}
              onValueChange={setSelectedBobinaId}
              disabled={loading || disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Cargando..." : "Seleccione bobina"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {filteredBobinas.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    Sin coincidencias
                  </SelectItem>
                ) : (
                  filteredBobinas.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.code?.trim() ? b.code : `Bobina #${b.id}`} ·{" "}
                      {b.material ? `${b.material.sku} · ${b.material.name}` : `material_id=${b.material_id ?? "—"}`} ·{" "}
                      {b.weight_kg ?? "—"} kg
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedBobina ? (
              <p className="text-muted-foreground text-xs">
                Seleccionada: <span className="font-mono">{selectedBobina.code ?? `#${selectedBobina.id}`}</span> ·{" "}
                {selectedBobina.material?.supplier?.name?.trim() ? selectedBobina.material.supplier.name : "sin proveedor"}.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Kg usados</Label>
              <Input
                inputMode="decimal"
                value={qtyUsed}
                onChange={(e) => setQtyUsed(e.target.value)}
                placeholder="0.000"
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label>Kg terminados (opcional)</Label>
              <Input
                inputMode="decimal"
                value={qtyFinished}
                onChange={(e) => setQtyFinished(e.target.value)}
                placeholder="0.000"
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Notas (opcional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalle breve..."
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void registrarUso()} disabled={disabled || saving}>
            {saving ? "Registrando..." : "Registrar bobina"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            Actualizar lista
          </Button>
        </div>

        <div className="rounded-md border">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="text-sm font-medium">Usos registrados (últimos)</div>
            <div className="text-muted-foreground text-xs">
              {usages.length} filas
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Bobina</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Usado kg</TableHead>
                  <TableHead>Fin kg</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && usages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : usages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Sin registros.
                    </TableCell>
                  </TableRow>
                ) : (
                  usages.slice(0, 50).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        {u.created_at ? String(u.created_at).slice(0, 19) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {u.bobina?.code?.trim()
                          ? u.bobina.code
                          : u.bobina_id
                            ? `#${u.bobina_id}`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {u.material?.sku?.trim()
                          ? `${u.material.sku} · ${readString(u.material?.name)}`
                          : u.material_id
                            ? `material_id=${u.material_id}`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{readNumber(u.quantity_used_kg).toFixed(3)}</TableCell>
                      <TableCell className="text-xs">{readNumber(u.quantity_finished_kg).toFixed(3)}</TableCell>
                      <TableCell className="max-w-[18rem] truncate text-xs" title={u.notes ?? undefined}>
                        {u.notes?.trim() ? u.notes : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

