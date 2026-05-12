"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  AlignLeft,
  Check,
  ChevronsUpDown,
  FileText,
  Hash,
  List,
  Loader2,
  Package,
  Plus,
  Ruler,
  Trash2,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { getStoredUser } from "@/lib/auth-storage"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const ROLE_LABELS: Record<string, string> = {
  boss: "Jefe / gerencia",
  admin: "Administrador",
  jefe_supremo: "Jefe supremo",
  superadmin: "Superadministrador",
  jefe_operaciones: "Jefe de operaciones",
  desarrollo: "Desarrollo",
  desarrollador: "Desarrollo",
  inventario: "Inventario",
  impresion: "Impresión",
  printing: "Impresión",
  laminacion: "Laminación",
  corte: "Corte",
  tintas: "Tintas",
  produccion: "Producción",
  calidad: "Calidad",
  vigilancia: "Vigilancia",
  solicitudes_area: "Solicitudes entre áreas",
}

function formatRoleLabel(role?: string | null): string {
  const r = (role ?? "").toLowerCase().trim()
  if (!r) return "Usuario"
  return ROLE_LABELS[r] ?? r.split(/[_\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

type DraftLine = {
  key: string
  material_id: string
  /** Texto mostrado al elegir del catálogo (persiste si cambia el filtro de búsqueda). */
  material_label?: string
  description: string
  quantity_requested: string
  unit: string
}

type LineFieldErrors = {
  qty?: boolean
  materialChoice?: boolean
}

function newLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    material_id: "",
    material_label: undefined,
    description: "",
    quantity_requested: "",
    unit: "",
  }
}

export default function MaterialRequestNewPage() {
  const navigate = useNavigate()
  const session = useMemo(() => getStoredUser(), [])
  const requesterName = session?.name?.trim() || "Usuario"
  const requesterRoleLabel = formatRoleLabel(session?.role)

  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine()])
  /** Texto del buscador dentro del combobox de material (consulta inventario). */
  const [materialSearch, setMaterialSearch] = useState("")
  const [materialOptions, setMaterialOptions] = useState<MaterialRow[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialsLoadError, setMaterialsLoadError] = useState(false)
  const [materialPickerKey, setMaterialPickerKey] = useState<string | null>(null)
  const [lineErrorsByKey, setLineErrorsByKey] = useState<Record<string, LineFieldErrors>>({})

  const loadMaterials = useCallback(async (q: string) => {
    setMaterialsLoading(true)
    setMaterialsLoadError(false)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: {
          q: q.trim() || undefined,
          per_page: 150,
          sort_by: "name",
          sort_dir: "asc",
        },
      })
      setMaterialOptions(Array.isArray(data?.data) ? data.data : [])
    } catch (e) {
      setMaterialsLoadError(true)
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar materiales.")
      setMaterialOptions([])
    } finally {
      setMaterialsLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => void loadMaterials(materialSearch), 250)
    return () => window.clearTimeout(t)
  }, [materialSearch, loadMaterials])

  function validateLines(): { ok: boolean; errs: Record<string, LineFieldErrors> } {
    const errs: Record<string, LineFieldErrors> = {}
    let ok = true
    for (const ln of lines) {
      const qty = ln.quantity_requested.trim().replace(",", ".")
      const mid = ln.material_id.trim()
      const desc = ln.description.trim()
      const e: LineFieldErrors = {}
      if (!qty || Number(qty) <= 0) {
        e.qty = true
        ok = false
      }
      if (!mid && !desc) {
        e.materialChoice = true
        ok = false
      }
      if (Object.keys(e).length) errs[ln.key] = e
    }
    return { ok, errs }
  }

  function clearLineError(key: string, field: keyof LineFieldErrors) {
    setLineErrorsByKey((prev) => {
      const cur = prev[key]
      if (!cur?.[field]) return prev
      const next = { ...cur }
      delete next[field]
      if (Object.keys(next).length === 0) {
        const { [key]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: next }
    })
  }

  async function submit() {
    const { ok, errs } = validateLines()
    if (!ok) {
      setLineErrorsByKey(errs)
      toast.error("Revise los campos marcados en rojo.")
      return
    }
    setLineErrorsByKey({})

    const payloadLines: Array<{
      material_id?: number
      description?: string
      quantity_requested: string
      unit?: string
    }> = []

    for (const ln of lines) {
      const mid = ln.material_id.trim()
      const qty = ln.quantity_requested.trim().replace(",", ".")
      const desc = ln.description.trim()
      payloadLines.push({
        ...(mid ? { material_id: Number(mid) } : {}),
        ...(desc ? { description: desc } : {}),
        quantity_requested: qty,
        ...(ln.unit.trim() ? { unit: ln.unit.trim() } : {}),
      })
    }

    try {
      setSubmitting(true)
      await apiFetch<{ id: number }>("material-requests", {
        method: "POST",
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          lines: payloadLines,
        }),
      })
      toast.success("Solicitud de insumos enviada.")
      navigate("/solicitudes-material", { replace: true })
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la solicitud.")
    } finally {
      setSubmitting(false)
    }
  }

  const inputErrorRing = "border-destructive focus-visible:ring-destructive"

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Nueva solicitud de insumos</h1>
          <p className="text-muted-foreground text-sm">
            Use esta pantalla cuando necesite material del almacén. Al guardar, la solicitud queda registrada y
            volverá al listado. El historial de inventario queda en{" "}
            <Link className="text-primary underline-offset-4 hover:underline" to="/movimientos-inventario">
              Movimientos
            </Link>
            .
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/solicitudes-material">Volver a solicitudes</Link>
        </Button>
      </div>

      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex gap-3 rounded-2xl border bg-muted/30 p-4 shadow-sm">
          <div className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <User className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Solicitud realizada por</h2>
            <p className="text-foreground text-base font-medium">{requesterName}</p>
            <h3 className="text-muted-foreground mt-1 text-sm font-medium">Rol en el sistema</h3>
            <p className="text-foreground text-sm">{requesterRoleLabel}</p>
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mr-notes" className="flex items-center gap-2">
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                Observaciones
              </Label>
              <Textarea
                id="mr-notes"
                rows={3}
                placeholder="Motivo, máquina, urgencia, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-y"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label className="flex items-center gap-2">
                  <List className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                  Líneas
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Añadir línea
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                En <strong>Material (inventario)</strong> abra el listado: puede <strong>escribir</strong> nombre o SKU
                para consultar el catálogo y elegir; o elija <strong>Sin catálogo</strong> y describa el repuesto en la
                última columna.
              </p>

              <div className="space-y-3 rounded-md border p-3">
                {lines.map((ln, i) => {
                  const le = lineErrorsByKey[ln.key]
                  const matFromList = ln.material_id
                    ? materialOptions.find((m) => String(m.id) === ln.material_id)
                    : undefined
                  const triggerLabel = ln.material_id
                    ? (ln.material_label ??
                      (matFromList
                        ? `${matFromList.sku} · ${matFromList.name} (${matFromList.unit})`
                        : `Material #${ln.material_id}`))
                    : "Buscar en inventario o Sin catálogo…"

                  return (
                    <div key={ln.key} className="grid gap-2 border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-xs font-medium">Línea {i + 1}</span>
                        {lines.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive"
                            onClick={() => {
                              setLines((prev) => prev.filter((x) => x.key !== ln.key))
                              setLineErrorsByKey((prev) => {
                                const { [ln.key]: _, ...rest } = prev
                                return rest
                              })
                              if (materialPickerKey === ln.key) setMaterialPickerKey(null)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                        <div className="flex min-w-[200px] max-w-[22rem] flex-[1.15] flex-col gap-1">
                          <Label
                            className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap"
                            htmlFor={`mr-mat-${ln.key}`}
                          >
                            <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Material (inventario)
                          </Label>
                          <Popover
                            open={materialPickerKey === ln.key}
                            onOpenChange={(next) => {
                              setMaterialPickerKey(next ? ln.key : null)
                              if (next) void loadMaterials(materialSearch)
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                id={`mr-mat-${ln.key}`}
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={materialPickerKey === ln.key}
                                className={cn(
                                  "h-9 w-full justify-between font-normal",
                                  le?.materialChoice && inputErrorRing,
                                )}
                              >
                                <span
                                  className={cn("truncate text-left", !ln.material_id && "text-muted-foreground")}
                                >
                                  {triggerLabel}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[var(--radix-popover-trigger-width)] min-w-[20rem] p-0"
                              align="start"
                            >
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Escriba nombre o SKU del inventario…"
                                  value={materialSearch}
                                  onValueChange={setMaterialSearch}
                                />
                                <CommandList className="max-h-64">
                                  {materialsLoading ? (
                                    <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
                                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                      Buscando en inventario…
                                    </div>
                                  ) : materialsLoadError ? (
                                    <div className="text-destructive px-3 py-6 text-center text-sm">
                                      No se pudo cargar el catálogo. Cierre y vuelva a abrir, o recargue la página.
                                    </div>
                                  ) : (
                                    <>
                                      <CommandGroup>
                                        <CommandItem
                                          value="sin-catalogo"
                                          onSelect={() => {
                                            setLines((prev) =>
                                              prev.map((row) =>
                                                row.key === ln.key
                                                  ? {
                                                      ...row,
                                                      material_id: "",
                                                      material_label: undefined,
                                                      unit: row.unit,
                                                    }
                                                  : row,
                                              ),
                                            )
                                            clearLineError(ln.key, "materialChoice")
                                            setMaterialPickerKey(null)
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4 shrink-0",
                                              !ln.material_id ? "opacity-100" : "opacity-0",
                                            )}
                                            aria-hidden
                                          />
                                          Sin catálogo (solo descripción)
                                        </CommandItem>
                                        {materialOptions.map((m) => {
                                          const rowLabel = `${m.sku} · ${m.name} (${m.unit})`
                                          return (
                                            <CommandItem
                                              key={m.id}
                                              value={`mat-${m.id}-${m.sku}`}
                                              onSelect={() => {
                                                setLines((prev) =>
                                                  prev.map((row) =>
                                                    row.key === ln.key
                                                      ? {
                                                          ...row,
                                                          material_id: String(m.id),
                                                          material_label: rowLabel,
                                                          unit: m.unit ?? row.unit,
                                                        }
                                                      : row,
                                                  ),
                                                )
                                                clearLineError(ln.key, "materialChoice")
                                                setMaterialPickerKey(null)
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4 shrink-0",
                                                  ln.material_id === String(m.id) ? "opacity-100" : "opacity-0",
                                                )}
                                                aria-hidden
                                              />
                                              <span className="truncate">{rowLabel}</span>
                                            </CommandItem>
                                          )
                                        })}
                                      </CommandGroup>
                                      {materialOptions.length === 0 ? (
                                        <p className="text-muted-foreground border-t px-3 py-3 text-center text-xs">
                                          Sin materiales con este criterio. Borre el texto de búsqueda para ver los
                                          primeros del catálogo, o use <strong>Sin catálogo</strong> y describa el
                                          ítem.
                                        </p>
                                      ) : null}
                                    </>
                                  )}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex w-[6.25rem] shrink-0 flex-col gap-1">
                          <Label
                            className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap"
                            title="Cantidad solicitada"
                          >
                            <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Cantidad
                          </Label>
                          <Input
                            inputMode="decimal"
                            value={ln.quantity_requested}
                            className={cn(le?.qty && inputErrorRing)}
                            aria-invalid={le?.qty ? true : undefined}
                            onChange={(e) => {
                              setLines((prev) =>
                                prev.map((row) =>
                                  row.key === ln.key
                                    ? { ...row, quantity_requested: e.target.value }
                                    : row,
                                ),
                              )
                              clearLineError(ln.key, "qty")
                            }}
                          />
                        </div>
                        <div className="flex w-[6rem] shrink-0 flex-col gap-1">
                          <Label className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap">
                            <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Unidad
                          </Label>
                          <Input
                            placeholder="Ej. kg, par"
                            value={ln.unit}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((row) =>
                                  row.key === ln.key ? { ...row, unit: e.target.value } : row,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="flex min-w-[11rem] flex-1 flex-col gap-1">
                          <Label
                            className="text-muted-foreground flex items-center gap-1.5 text-xs"
                            title="Descripción si no hay material catalogado"
                          >
                            <AlignLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Descripción (si no hay material)
                          </Label>
                          <Input
                            placeholder="Repuesto, ítem no catalogado…"
                            value={ln.description}
                            className={cn("min-w-0", le?.materialChoice && inputErrorRing)}
                            aria-invalid={le?.materialChoice ? true : undefined}
                            onChange={(e) => {
                              setLines((prev) =>
                                prev.map((row) =>
                                  row.key === ln.key ? { ...row, description: e.target.value } : row,
                                ),
                              )
                              clearLineError(ln.key, "materialChoice")
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-6">
            <Button type="button" variant="outline" asChild>
              <Link to="/solicitudes-material">Cancelar</Link>
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submit()}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Crear solicitud"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
