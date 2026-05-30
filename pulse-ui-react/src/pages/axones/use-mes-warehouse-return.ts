import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow, SupplierRecord } from "@/types/api"
import {
  PRINTING_REJECT_REASONS,
  allRejectedEntriesHaveMotivo,
  countDevolucionRechazadaBobinas,
  countRejectedEntryBobinas,
  newWarehouseRejectedEntry,
  rejectedEntriesWithBobinas,
  sumRejectedEntryBobinas,
  type WarehouseRejectedEntry,
  type WarehouseReturnDraft,
} from "./printing-turnos"

type InventoryReturnCreated = { id: number }

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumberString(v: unknown): string {
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v
  return ""
}

function readNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function toFiniteOrNull(v: unknown): number | null {
  const raw = readNumberString(v).trim().replace(",", ".")
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function normalizeNumericString(v: unknown): string {
  const n = toFiniteOrNull(v)
  if (n === null) return ""
  return String(n)
}

export type MesWarehouseReturnAreaConfig = {
  originArea: string
  areaRequestTitlePrefix: string
  keys: {
    devolucionBuenaKg: string
    devolucionRechazadaBobinas: string
    devolucionRechazadaKg: string
    devolucionRechazadaMotivo: string
    ultimoEnvioMs: string
    snapBuena: string
    snapRech: string
  }
}

export type MesWarehouseReturnPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderCode: string
  draft: WarehouseReturnDraft
  onDraftChange: (patch: Partial<WarehouseReturnDraft>) => void
  onRejectedEntryChange: (id: string, patch: Partial<WarehouseRejectedEntry>) => void
  onAddRejectedEntry: () => void
  onRemoveRejectedEntry: (id: string) => void
  materialOptionsGood: MaterialRow[]
  materialOptionsBad: MaterialRow[]
  supplierOptions: SupplierRecord[]
  loadingGood: boolean
  loadingBad: boolean
  loadingSuppliers: boolean
  submitting: boolean
  onSubmit: () => void | Promise<void>
}

export function useMesWarehouseReturn(options: {
  workOrderId: number
  workOrderCode: string
  form: Record<string, unknown>
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  config: MesWarehouseReturnAreaConfig
  onSuccess?: (message: string) => void
  /** Optional: sync rejected bobinas/motivo into active turn (printing). If omitted, only updates form keys. */
  syncRejectedToTurn?: (entries: WarehouseRejectedEntry[]) => void
  patchAfterSubmit?: (
    prev: Record<string, unknown>,
    ctx: {
      hasBuena: boolean
      buenaKg: number
      hasRech: boolean
      rechBobinas: number
      firstMotivo: string
    },
  ) => Record<string, unknown>
}) {
  const { workOrderId, workOrderCode, form, setForm, config, onSuccess, syncRejectedToTurn, patchAfterSubmit } =
    options
  const { keys } = config

  const [returnWarehouseOpen, setReturnWarehouseOpen] = useState(false)
  const [returnLoadingMaterialsGood, setReturnLoadingMaterialsGood] = useState(false)
  const [returnLoadingMaterialsBad, setReturnLoadingMaterialsBad] = useState(false)
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnMaterialOptionsGood, setReturnMaterialOptionsGood] = useState<MaterialRow[]>([])
  const [returnMaterialOptionsBad, setReturnMaterialOptionsBad] = useState<MaterialRow[]>([])
  const [returnSupplierOptions, setReturnSupplierOptions] = useState<SupplierRecord[]>([])
  const [returnLoadingSuppliers, setReturnLoadingSuppliers] = useState(false)
  const [returnDraft, setReturnDraft] = useState<WarehouseReturnDraft>(() => ({
    buenaMaterialId: "",
    bobinaCode: "",
    rechazadaEntries: [newWarehouseRejectedEntry()],
  }))

  const devolucionesPendienteAlmacen = useMemo(() => {
    const b = toFiniteOrNull(form[keys.devolucionBuenaKg]) ?? 0
    const r = countDevolucionRechazadaBobinas(
      form[keys.devolucionRechazadaBobinas],
      form[keys.devolucionRechazadaKg],
    )
    if (b <= 0 && r <= 0) return false
    const envioMs = readNumber(form[keys.ultimoEnvioMs])
    const snapB = readString(form[keys.snapBuena])
    const snapR = readString(form[keys.snapRech])
    const curB = normalizeNumericString(form[keys.devolucionBuenaKg])
    const curR = normalizeNumericString(
      readNumberString(form[keys.devolucionRechazadaBobinas]) || String(r),
    )
    if (envioMs <= 0) return true
    return curB !== snapB || curR !== snapR
  }, [
    form,
    keys.devolucionBuenaKg,
    keys.devolucionRechazadaBobinas,
    keys.devolucionRechazadaKg,
    keys.snapBuena,
    keys.snapRech,
    keys.ultimoEnvioMs,
  ])

  function syncRejectedEntries(entries: WarehouseRejectedEntry[]) {
    if (syncRejectedToTurn) {
      syncRejectedToTurn(entries)
      return
    }
    const total = sumRejectedEntryBobinas(entries)
    const motivoOk = allRejectedEntriesHaveMotivo(entries)
    const firstMotivo =
      rejectedEntriesWithBobinas(entries).find((e) => e.motivo.trim())?.motivo.trim() ?? ""
    setForm((prev) => ({
      ...prev,
      [keys.devolucionRechazadaKg]: "",
      [keys.devolucionRechazadaBobinas]: total > 0 ? String(total) : "",
      [keys.devolucionRechazadaMotivo]:
        total > 0 && motivoOk ? firstMotivo : total > 0 ? readString(prev[keys.devolucionRechazadaMotivo]) : "",
    }))
  }

  function patchReturnDraft(patch: Partial<WarehouseReturnDraft>) {
    setReturnDraft((prev) => {
      const next = { ...prev, ...patch }
      if (patch.rechazadaEntries) {
        syncRejectedEntries(next.rechazadaEntries)
      }
      return next
    })
  }

  function patchRejectedEntry(id: string, entryPatch: Partial<WarehouseRejectedEntry>) {
    setReturnDraft((prev) => {
      const nextEntries = prev.rechazadaEntries.map((e) => (e.id === id ? { ...e, ...entryPatch } : e))
      syncRejectedEntries(nextEntries)
      return { ...prev, rechazadaEntries: nextEntries }
    })
  }

  function addRejectedEntry() {
    setReturnDraft((prev) => ({
      ...prev,
      rechazadaEntries: [...prev.rechazadaEntries, newWarehouseRejectedEntry()],
    }))
  }

  function removeRejectedEntry(id: string) {
    setReturnDraft((prev) => {
      if (prev.rechazadaEntries.length <= 1) return prev
      const nextEntries = prev.rechazadaEntries.filter((e) => e.id !== id)
      syncRejectedEntries(nextEntries)
      return { ...prev, rechazadaEntries: nextEntries }
    })
  }

  const loadReturnMaterials = useCallback(async (inventoryArea: "material" | "bobinas_rechazadas") => {
    const setLoading = inventoryArea === "material" ? setReturnLoadingMaterialsGood : setReturnLoadingMaterialsBad
    const setOptions = inventoryArea === "material" ? setReturnMaterialOptionsGood : setReturnMaterialOptionsBad
    setLoading(true)
    try {
      const res = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { inventory_area: inventoryArea, per_page: 200, page: 1 },
      })
      setOptions(res.data ?? [])
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadReturnSuppliers = useCallback(async () => {
    setReturnLoadingSuppliers(true)
    try {
      const res = await apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
        query: { per_page: 200, page: 1 },
      })
      setReturnSupplierOptions(res.data ?? [])
    } catch {
      setReturnSupplierOptions([])
    } finally {
      setReturnLoadingSuppliers(false)
    }
  }, [])

  const devolucionesPendientePrevRef = useRef(false)
  useEffect(() => {
    if (devolucionesPendienteAlmacen && !devolucionesPendientePrevRef.current) {
      setReturnWarehouseOpen(true)
      void loadReturnMaterials("material")
      void loadReturnMaterials("bobinas_rechazadas")
      void loadReturnSuppliers()
      const turnBobinas = readNumberString(form[keys.devolucionRechazadaBobinas])
      const turnMotivo = readString(form[keys.devolucionRechazadaMotivo])
      if (turnBobinas.trim()) {
        setReturnDraft((prev) => {
          const entries =
            prev.rechazadaEntries.length > 0 ? prev.rechazadaEntries : [newWarehouseRejectedEntry()]
          if (entries.length === 1 && !entries[0].bobinas.trim()) {
            return {
              ...prev,
              rechazadaEntries: [{ ...entries[0], bobinas: turnBobinas, motivo: turnMotivo }],
            }
          }
          return prev
        })
      }
    }
    devolucionesPendientePrevRef.current = devolucionesPendienteAlmacen
  }, [
    devolucionesPendienteAlmacen,
    form,
    keys.devolucionRechazadaBobinas,
    keys.devolucionRechazadaMotivo,
    loadReturnMaterials,
    loadReturnSuppliers,
  ])

  function handleReturnWarehouseOpenChange(open: boolean) {
    setReturnWarehouseOpen(open)
    if (open) {
      void loadReturnMaterials("material")
      void loadReturnMaterials("bobinas_rechazadas")
      void loadReturnSuppliers()
      setReturnDraft((prev) => {
        const turnBobinas = readNumberString(form[keys.devolucionRechazadaBobinas])
        const turnMotivo = readString(form[keys.devolucionRechazadaMotivo])
        const entries =
          prev.rechazadaEntries.length > 0 ? prev.rechazadaEntries : [newWarehouseRejectedEntry()]
        if (entries.length === 1 && !entries[0].bobinas.trim() && turnBobinas.trim()) {
          return {
            ...prev,
            buenaMaterialId: prev.buenaMaterialId,
            rechazadaEntries: [{ ...entries[0], bobinas: turnBobinas, motivo: turnMotivo }],
          }
        }
        return prev
      })
    }
  }

  function defaultPatchAfterSubmit(
    prev: Record<string, unknown>,
    ctx: {
      hasBuena: boolean
      buenaKg: number
      hasRech: boolean
      rechBobinas: number
      firstMotivo: string
    },
  ): Record<string, unknown> {
    const nextBuena = ctx.hasBuena
      ? normalizeNumericString(ctx.buenaKg)
      : normalizeNumericString(prev[keys.devolucionBuenaKg])
    const nextRech = ctx.hasRech
      ? normalizeNumericString(ctx.rechBobinas)
      : normalizeNumericString(prev[keys.devolucionRechazadaBobinas])
    return {
      ...prev,
      ...(ctx.hasBuena ? { [keys.devolucionBuenaKg]: normalizeNumericString(ctx.buenaKg) } : null),
      ...(ctx.hasRech
        ? {
            [keys.devolucionRechazadaKg]: "",
            [keys.devolucionRechazadaBobinas]: normalizeNumericString(ctx.rechBobinas),
            [keys.devolucionRechazadaMotivo]: ctx.firstMotivo,
          }
        : null),
      [keys.ultimoEnvioMs]: Date.now(),
      [keys.snapBuena]: nextBuena,
      [keys.snapRech]: nextRech,
    }
  }

  async function submitReturn() {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return

    const buenaKg = Number(
      readString(readNumberString(form[keys.devolucionBuenaKg])).trim().replace(",", "."),
    )
    const activeRejected = rejectedEntriesWithBobinas(returnDraft.rechazadaEntries)
    const rechBobinas = sumRejectedEntryBobinas(returnDraft.rechazadaEntries)
    const hasBuena = Number.isFinite(buenaKg) && buenaKg > 0
    const hasRech = rechBobinas > 0
    if (!hasBuena && !hasRech) {
      toast.error("Indique Kg en devolución buena y/o bobinas en devolución rechazada.")
      return
    }

    const buenaMaterialId = Number(returnDraft.buenaMaterialId)
    if (hasBuena && (!Number.isFinite(buenaMaterialId) || buenaMaterialId < 1)) {
      toast.error("Seleccione el material de la devolución buena.")
      return
    }
    if (hasRech) {
      for (let i = 0; i < activeRejected.length; i++) {
        const entry = activeRejected[i]
        const lineN = i + 1
        const entryBobinas = countRejectedEntryBobinas(entry.bobinas)
        if (!entry.motivo.trim()) {
          toast.error(`Línea rechazada ${lineN}: seleccione un motivo.`)
          return
        }
        if (entryBobinas < 1) {
          toast.error(`Línea rechazada ${lineN}: indique al menos 1 bobina.`)
          return
        }
      }
    }

    const bobinaRef = returnDraft.bobinaCode.trim()
    const firstMotivo = activeRejected[0]?.motivo.trim() ?? ""
    const supplierLabel = (id: string) =>
      returnSupplierOptions.find((s) => String(s.id) === id.trim())?.name?.trim() ?? ""

    setReturnSubmitting(true)
    try {
      const createdIds: number[] = []
      let createdBuenaId: number | null = null
      const createdRechIds: number[] = []

      if (hasBuena) {
        const created = await apiFetch<InventoryReturnCreated>("inventory-returns", {
          method: "POST",
          body: JSON.stringify({
            material_id: buenaMaterialId,
            work_order_id: workOrderId,
            destination_area: "material",
            quantity: buenaKg.toFixed(3),
            reason: bobinaRef ? `Bobina/Ref: ${bobinaRef}` : null,
          }),
        })
        createdBuenaId = created.id
        createdIds.push(created.id)
      }

      for (const entry of activeRejected) {
        const entryBobinas = countRejectedEntryBobinas(entry.bobinas)
        const rejectReasonLabel =
          PRINTING_REJECT_REASONS.find((r) => r.id === entry.motivo)?.label ?? entry.motivo.trim()
        const rejectObs = entry.obs.trim()
        const provName = supplierLabel(entry.proveedorId)
        const entryKg = toFiniteOrNull(entry.kg)
        const reasonParts = [`Motivo: ${rejectReasonLabel}`]
        if (entryKg != null && entryKg > 0.005) reasonParts.push(`Peso: ${entryKg.toFixed(3)} Kg`)
        if (provName) reasonParts.push(`Proveedor: ${provName}`)
        if (rejectObs) reasonParts.push(`Obs: ${rejectObs}`)
        if (bobinaRef) reasonParts.push(`Bobina/Ref: ${bobinaRef}`)
        const materialIdRaw = entry.materialId.trim()
        const materialId = materialIdRaw ? Number(materialIdRaw) : null
        const created = await apiFetch<InventoryReturnCreated>("inventory-returns", {
          method: "POST",
          body: JSON.stringify({
            material_id: materialId,
            work_order_id: workOrderId,
            destination_area: "bobinas_rechazadas",
            quantity: String(entryBobinas),
            reason: [`${entryBobinas} bobina(s) rechazada(s)`, ...reasonParts].join(" · "),
          }),
        })
        createdRechIds.push(created.id)
        createdIds.push(created.id)
      }

      const titleBase = workOrderCode
      const rechSummaryLines = activeRejected.map((entry, i) => {
        const entryBobinas = countRejectedEntryBobinas(entry.bobinas)
        const rejectReasonLabel =
          PRINTING_REJECT_REASONS.find((r) => r.id === entry.motivo)?.label ?? entry.motivo.trim()
        const provName = supplierLabel(entry.proveedorId)
        const entryKg = toFiniteOrNull(entry.kg)
        const returnId = createdRechIds[i] ?? "—"
        const provPart = provName ? ` · Proveedor: ${provName}` : ""
        const kgPart = entryKg != null && entryKg > 0.005 ? ` · ${entryKg.toFixed(3)} Kg` : ""
        return `Devolución rechazada ${activeRejected.length > 1 ? `#${i + 1} ` : ""}${entryBobinas} bobina(s)${kgPart} · Motivo: ${rejectReasonLabel}${provPart} (return_id=${returnId})`
      })
      const bodyLines = [
        `Origen: ${config.originArea}`,
        `OT: ${titleBase}`,
        hasBuena ? `Devolución buena: ${buenaKg.toFixed(3)} Kg (return_id=${createdBuenaId ?? "—"})` : null,
        ...rechSummaryLines,
        bobinaRef ? `Bobina/Ref: ${bobinaRef}` : null,
        createdIds.length ? `IDs devoluciones: ${createdIds.join(", ")}` : null,
      ].filter(Boolean)

      await apiFetch("area-requests", {
        method: "POST",
        body: JSON.stringify({
          area: "almacen",
          title: `${config.areaRequestTitlePrefix} · ${titleBase}`,
          body: bodyLines.join("\n"),
          work_order_id: workOrderId,
        }),
      })

      const patchDev = patchAfterSubmit ?? defaultPatchAfterSubmit
      setForm((prev) =>
        patchDev(prev, { hasBuena, buenaKg, hasRech, rechBobinas, firstMotivo }),
      )
      setReturnDraft({
        buenaMaterialId: "",
        bobinaCode: "",
        rechazadaEntries: [newWarehouseRejectedEntry()],
      })
      setReturnWarehouseOpen(false)
      const successMessage = "Solicitud enviada a almacén. Devoluciones registradas."
      if (onSuccess) onSuccess(successMessage)
      else toast.success(successMessage)
      window.dispatchEvent(new Event("alerts:refresh"))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la devolución / solicitud.")
    } finally {
      setReturnSubmitting(false)
    }
  }

  const warehouseReturnPanelProps: MesWarehouseReturnPanelProps = {
    open: returnWarehouseOpen,
    onOpenChange: (open) => {
      if (!open && returnSubmitting) return
      handleReturnWarehouseOpenChange(open)
    },
    workOrderCode,
    draft: returnDraft,
    onDraftChange: patchReturnDraft,
    onRejectedEntryChange: patchRejectedEntry,
    onAddRejectedEntry: addRejectedEntry,
    onRemoveRejectedEntry: removeRejectedEntry,
    materialOptionsGood: returnMaterialOptionsGood,
    materialOptionsBad: returnMaterialOptionsBad,
    supplierOptions: returnSupplierOptions,
    loadingGood: returnLoadingMaterialsGood,
    loadingBad: returnLoadingMaterialsBad,
    loadingSuppliers: returnLoadingSuppliers,
    submitting: returnSubmitting,
    onSubmit: submitReturn,
  }

  return {
    devolucionesPendienteAlmacen,
    returnWarehouseOpen,
    handleReturnWarehouseOpenChange,
    returnDraft,
    patchReturnDraft,
    patchRejectedEntry,
    addRejectedEntry,
    removeRejectedEntry,
    warehouseReturnPanelProps,
  }
}
