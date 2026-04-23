"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const AREAS = [
  { value: "material", label: "Material" },
  { value: "tintas", label: "Tintas" },
  { value: "cementerio_tintas", label: "Cementerio tintas" },
  { value: "quimicos", label: "Químicos" },
  { value: "bobinas_rechazadas", label: "Bobinas rechazadas" },
  { value: "miscelaneos", label: "Misceláneos" },
] as const

function MaterialsTable({ area }: { area: string }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<MaterialRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { inventory_area: area, per_page: 100, page: 1 },
      })
      setRows(data.data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("Error al cargar materiales.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [area])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
        Actualizar
      </Button>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Mín.</TableHead>
              <TableHead>Unidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Sin ítems en esta área.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.quantity_on_hand}</TableCell>
                  <TableCell>{m.min_stock}</TableCell>
                  <TableCell>{m.unit}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function MaterialsInventoryHubPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Inventario por área
        </h1>
        <p className="text-muted-foreground text-sm">
          Las 6 áreas de inventario en una sola pantalla (pestañas). Datos desde{" "}
          <code>/materials?inventory_area=…</code>
        </p>
      </div>

      <Tabs defaultValue="material" className="w-full">
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {AREAS.map((a) => (
            <TabsTrigger key={a.value} value={a.value} className="text-xs sm:text-sm">
              {a.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {AREAS.map((a) => (
          <TabsContent key={a.value} value={a.value} className="mt-4">
            <MaterialsTable area={a.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
