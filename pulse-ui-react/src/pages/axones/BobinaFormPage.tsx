"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Barcode, Building2, Package2, Scale, Tags } from "lucide-react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { AXONES_INVENTORY_FILTER_INPUT_CLASS, AXONES_INVENTORY_PAGE_CLASS } from "@/components/axones/inventory-page-layout"
import { PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { ReasonModal } from "@/components/axones/ReasonModal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const FILTER_INPUT_CLASS = AXONES_INVENTORY_FILTER_INPUT_CLASS

function normalizeDecimalInput(raw: string): string {
  const normalized = raw.replace(",", ".").replace(/[^0-9.]/g, "")
  const firstDot = normalized.indexOf(".")
  if (firstDot === -1) return normalized
  const integerPart = normalized.slice(0, firstDot + 1)
  const decimalPart = normalized.slice(firstDot + 1).replace(/\./g, "").slice(0, 3)
  return `${integerPart}${decimalPart}`
}

function formatToTwoDecimals(raw: string | number | null | undefined): string {
  const n = Number(String(raw ?? "0").replace(",", "."))
  if (!Number.isFinite(n)) return "0.00"
  return n.toFixed(2)
}

type BobinaDetail = {
  id: number
  material_id: number
  code: string
  weight_kg: string
  status: string
  can_edit_structural?: boolean
  material?: MaterialRow
}

export default function BobinaFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { bobinaId } = useParams<{ bobinaId: string }>()
  const isEdit = location.pathname.endsWith("/editar") && Boolean(bobinaId)
  const id = bobinaId ? Number(bobinaId) : NaN
  const validEdit = !isEdit || (Number.isFinite(id) && id > 0)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [materialId, setMaterialId] = useState("")
  const [code, setCode] = useState("")
  const [weightKg, setWeightKg] = useState("")
  const [status, setStatus] = useState("available")
  const [canEditStructural, setCanEditStructural] = useState(true)
  const [reasonModalOpen, setReasonModalOpen] = useState(false)
  const [pendingBody, setPendingBody] = useState<Record<string, unknown> | null>(null)
  const [changeReason, setChangeReason] = useState("")

  const title = useMemo(() => (isEdit ? "Editar bobina" : "Nueva bobina"), [isEdit])

  const selectedMaterial = useMemo(
    () => materials.find((m) => String(m.id) === materialId),
    [materials, materialId],
  )

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/bobinas"
  }, [location.state])

  const loadMaterials = useCallback(async () => {
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { per_page: 200, page: 1 },
      })
      setMaterials(data.data ?? [])
    } catch {
      setMaterials([])
    }
  }, [])

  const loadBobina = useCallback(async () => {
    if (!validEdit || !isEdit) return
    setLoading(true)
    try {
      const data = await apiFetch<BobinaDetail>(`bobinas/${id}`)
      setMaterialId(String(data.material_id))
      setCode(data.code)
      setWeightKg(formatToTwoDecimals(data.weight_kg))
      setStatus(data.status)
      setCanEditStructural(Boolean(data.can_edit_structural))
      if (data.material) {
        setMaterials((prev) => {
          const others = prev.filter((m) => m.id !== data.material!.id)
          return [...others, data.material!]
        })
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la bobina.")
    } finally {
      setLoading(false)
    }
  }, [id, isEdit, validEdit])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await loadMaterials()
      if (cancelled) return
      if (isEdit && validEdit) await loadBobina()
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, validEdit, loadMaterials, loadBobina])

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!materialId || !code.trim() || !weightKg.trim()) {
      toast.error("Complete material, código y peso.")
      return
    }
    const body: Record<string, unknown> = {
      material_id: Number(materialId),
      code: code.trim(),
      weight_kg: weightKg.replace(",", "."),
      status,
    }
    if (isEdit) {
      setPendingBody(body)
      setReasonModalOpen(true)
      return
    }

    setSaving(true)
    try {
      if (isEdit) {
        await apiFetch<BobinaDetail>(`bobinas/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        toast.success("Bobina actualizada.")
        navigate(`/bobinas/${id}`, { replace: true })
      } else {
        const created = await apiFetch<BobinaDetail>("bobinas", {
          method: "POST",
          body: JSON.stringify(body),
        })
        toast.success("Bobina registrada.")
        navigate(`/bobinas/${created.id}`, { replace: true })
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && !validEdit) {
    return (
      <div className={AXONES_INVENTORY_PAGE_CLASS}>
        <p className="text-muted-foreground text-sm">Identificador no válido.</p>
        <Button variant="outline" asChild>
          <Link to="/bobinas">Volver</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={AXONES_INVENTORY_PAGE_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {isEdit
              ? "Si la bobina ya se usó o despachó, puede que solo pueda cambiar el estado."
              : "Alta de bobina en material normal."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setHelpOpen(true)}>
            Ayuda
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={isEdit ? `/bobinas/${id}` : returnTo}>Volver al listado</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <PageLoadingBlock />
      ) : (
        <form
          noValidate
          onSubmit={(e) => void onSubmit(e)}
          className="mx-auto max-w-5xl space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="rounded-xl border-l-4 border-l-emerald-500 bg-emerald-50/30 p-4">
            <h2 className="mb-4 text-center text-2xl font-extrabold tracking-wide text-emerald-900">
              BOBINAS
            </h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2 md:col-span-3">
                <Label htmlFor="bf-material">Material *</Label>
                <div className="group/field relative">
                  <Package2
                    className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary"
                    aria-hidden
                  />
                  <Select
                    value={materialId}
                    onValueChange={setMaterialId}
                    disabled={isEdit && !canEditStructural}
                  >
                    <SelectTrigger
                      id="bf-material"
                      className={cn("h-10 pl-10", FILTER_INPUT_CLASS)}
                    >
                      <SelectValue placeholder="Seleccione material (SKU · nombre)" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.sku} · {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedMaterial ? (
                <div className="grid gap-2 md:col-span-3">
                  <Label className="text-muted-foreground">Proveedor (del material)</Label>
                  <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm">
                    <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {selectedMaterial.supplier?.name?.trim()
                        ? selectedMaterial.supplier.name
                        : "Sin proveedor en el maestro de material."}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="bf-code">Código *</Label>
                <div className="group/field relative">
                  <Barcode
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary"
                    aria-hidden
                  />
                  <Input
                    id="bf-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={isEdit && !canEditStructural}
                    maxLength={64}
                    placeholder="BOB-2026-00042"
                    className={cn("pl-10", FILTER_INPUT_CLASS)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bf-weight">Peso (kg) *</Label>
                <div className="group/field relative">
                  <Scale
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary"
                    aria-hidden
                  />
                  <Input
                    id="bf-weight"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]{0,3}"
                    value={weightKg}
                    onChange={(e) => setWeightKg(normalizeDecimalInput(e.target.value))}
                    onBlur={() => {
                      if (weightKg.trim()) setWeightKg(formatToTwoDecimals(weightKg))
                    }}
                    disabled={isEdit && !canEditStructural}
                    placeholder="0.00"
                    className={cn("pl-10", FILTER_INPUT_CLASS)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bf-status">Estado</Label>
                <div className="group/field relative">
                  <Tags
                    className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary"
                    aria-hidden
                  />
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="bf-status" className={cn("h-10 pl-10", FILTER_INPUT_CLASS)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponible</SelectItem>
                      <SelectItem value="issued">Despachada</SelectItem>
                      <SelectItem value="consumed">Consumida</SelectItem>
                      <SelectItem value="rejected">Rechazada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-emerald-900/10 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar bobina"}
              </Button>
            </div>
          </div>
        </form>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bobinas: estados</DialogTitle>
            <DialogDescription>
              Significado de cada valor del campo Estado en el formulario.
            </DialogDescription>
          </DialogHeader>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              <span className="text-foreground font-medium">Disponible</span> — En almacén, sin
              despacho a producción.
            </li>
            <li>
              <span className="text-foreground font-medium">Despachada</span> — Enviada o asignada a
              producción o solicitud de material.
            </li>
            <li>
              <span className="text-foreground font-medium">Consumida</span> — Ya registrada como
              consumida en producción.
            </li>
            <li>
              <span className="text-foreground font-medium">Rechazada</span> — Material no conforme.
            </li>
          </ul>
        </DialogContent>
      </Dialog>

      <ReasonModal
        open={reasonModalOpen}
        loading={saving}
        initialValue={changeReason}
        onCancel={() => {
          setReasonModalOpen(false)
          setPendingBody(null)
        }}
        onConfirm={(reason) => {
          const body = pendingBody
          if (!body || !isEdit) return
          setChangeReason(reason)
          setReasonModalOpen(false)
          setSaving(true)
          void (async () => {
            try {
              await apiFetch<BobinaDetail>(`bobinas/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ ...body, change_reason: reason }),
              })
              toast.success("Bobina actualizada.")
              navigate(`/bobinas/${id}`, { replace: true })
            } catch (e) {
              if (e instanceof ApiError) toast.error(e.message)
              else toast.error("No se pudo guardar.")
            } finally {
              setSaving(false)
              setPendingBody(null)
            }
          })()
        }}
      />
    </div>
  )
}
