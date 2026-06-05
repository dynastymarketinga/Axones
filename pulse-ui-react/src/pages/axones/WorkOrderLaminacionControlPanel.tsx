"use client"

import { createElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Layers, ListChecks, Package } from "lucide-react"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { WindingFigurePicker } from "./WindingFigurePicker"
import { MesOperativoEstadoCard, MesSectionShell } from "@/components/axones/mes"
import { apiFetch, ApiError } from "@/lib/api"
import {
  formatDecimalTwoDisplay,
  lamMaterialMetrosDisplay,
} from "@/lib/decimal-two-input"
import {
  deriveLaminacionOperativoEstado,
  LAMINACION_CONTROL_SAVED_EVENT,
} from "@/lib/laminacion-mes-band-status"
import { applyMesPhaseConfirmToTimer } from "@/lib/mes-multi-phase-timer-exec"
import {
  cumulativeDeadSeconds,
  cumulativeEffectiveSeconds,
  cumulativeTotalPersistedSeconds,
  deadAccSecAfterResume,
  formatHmsFromSeconds,
  formatHoraArranqueFromMs,
  horaArranqueMsFromTimer,
} from "@/lib/mes-timer-band-shared"
import {
  buildMesTimerActionFlags,
  getMesTimerConfirm,
  mesTimerConfirmNeedsActiveTurno,
  type MesTimerConfirmKey,
} from "./mes-timer-actions"
import {
  canSaveProductionAreaForm,
  hasProductionTimerStarted,
  mesTimerFieldsFromForm,
  MES_PRODUCTION_SAVE_CONFIG,
  MES_SAVE_BLOCKED_MESSAGE,
} from "@/lib/mes-timer-guards"
import { appAbsoluteUrl } from "@/lib/app-base-path"
import { openLaminacionPlanillaPreviewFromSource } from "@/lib/laminacion-planilla-preview"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import WorkOrderLaminacionOpsSection, {
  type DraftPerson,
  type DraftPersonRole,
  stringsFromActivePersonnel,
} from "./WorkOrderLaminacionOpsSection"
import { useMesWarehouseReturn } from "./use-mes-warehouse-return"
import { sanitizeBobinaKgSlotInput } from "@/lib/bobina-kg-slot"
import { countDevolucionRechazadaBobinas, normalizeSalidaBobinaLabelMeta } from "./printing-turnos"
import { sanitizePositiveDecimalInput } from "./purchase-document-form-ui"
import {
  parseLamChecklistChecked,
  type LamChecklistEstado,
} from "./laminacion-checklist-config"
import {
  LAM_ACTUAL_KEY,
  LAM_ESTADO_KEY,
  LAM_PAUSE_REASONS,
  LAM_TURNOS_KEY,
  accumulateLaminacionFromJson,
  bootstrapLaminacionFormState,
  cumulativeDemountSeconds,
  clearLaminacionMirrorKeys,
  createNewLaminacionTurno,
  finalizeLaminacionTurnTimerNow,
  laminacionAggregatedTimerMirrorFromTurnos,
  formatTimerHms,
  laminacionTurnoToMirror,
  parseLaminacionTurnoActual,
  parseLaminacionTurnos,
  readLaminacionEstadoArea,
  syncLaminacionTurnoFromFormMirror,
  sumSalidaKgTurno,
  sumScrapKgTurno,
  LAM_BOBINAS_SLOTS,
  getMetaSeries,
  getNumericSeries,
  getSustratosLamRows,
  normalizeLaminacionFormForSave,
  normalizeBobinaLabelMeta,
  validateBobinaLabelSave,
  emptyBobinaLabelMeta,
  readLamNumber,
  sumSeriesKg,
  computeLamMaterialConsumo,
  computeLamMermaRefil,
  pickLamTurnoMaterialField,
  type BobinaLabelMeta,
  type LamLabelEditorMode,
  type LaminacionTurnoEntry,
  type LaminacionTurnTimer,
} from "./laminacion-turnos"
import "./work-order-planilla.css"
import { AlertCircle, CheckCircle2, CirclePause, CirclePlay, FileSearch, Flag, LogOut, NotebookPen, Save, Sparkles, Users } from "lucide-react"

import { getStoredUser } from "@/lib/auth-storage"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  product_id?: number | null
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

type LaminacionPauseEntry = { at: string; reason: string; obs: string; duration_sec: number }

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

function todayBobinaLabelFecha(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yyyy = String(now.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function labelEditorDraftFromMeta(meta: BobinaLabelMeta | undefined, mode: LamLabelEditorMode): BobinaLabelMeta {
  if (mode === "salida") {
    const draft = normalizeSalidaBobinaLabelMeta(meta ?? {})
    if (!draft.fecha.trim()) draft.fecha = todayBobinaLabelFecha()
    return draft
  }
  const draft = meta ? { ...meta } : emptyBobinaLabelMeta()
  if (!draft.fecha.trim()) draft.fecha = todayBobinaLabelFecha()
  return draft
}

/** Tonos visuales para confirmaciones del panel de laminación (alineados a cada acción). */
type MesLaminacionConfirmTone =
  | "emerald"
  | "sky"
  | "indigo"
  | "violet"
  | "amber"
  | "orange"
  | "rose"
  | "red"

const MES_MONTAJE_CONFIRM: Record<MesLaminacionConfirmTone, { panel: string; iconBox: string }> = {
  emerald: {
    panel:
      "border-emerald-200/80 bg-gradient-to-b from-emerald-50/55 to-background sm:max-w-md sm:rounded-lg dark:from-emerald-950/35 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-300",
  },
  sky: {
    panel:
      "border-sky-200/80 bg-gradient-to-b from-sky-50/55 to-background sm:max-w-md sm:rounded-lg dark:from-sky-950/35 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-100/80 text-sky-800 dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-300",
  },
  indigo: {
    panel:
      "border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-indigo-950/35 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-100/80 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/45 dark:text-indigo-300",
  },
  violet: {
    panel:
      "border-violet-200/70 bg-gradient-to-b from-violet-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-violet-950/30 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-100/80 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  },
  amber: {
    panel:
      "border-amber-200/85 bg-gradient-to-b from-amber-50/55 to-background sm:max-w-md sm:rounded-lg dark:from-amber-950/30 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-100/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-300",
  },
  orange: {
    panel:
      "border-orange-200/85 bg-gradient-to-b from-orange-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-orange-950/28 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-100/80 text-orange-900 dark:border-orange-800 dark:bg-orange-950/45 dark:text-orange-300",
  },
  rose: {
    panel:
      "border-rose-200/80 bg-gradient-to-b from-rose-50/50 to-background sm:max-w-md sm:rounded-lg dark:from-rose-950/28 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-100/80 text-rose-800 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-300",
  },
  red: {
    panel:
      "border-red-300/70 bg-gradient-to-b from-red-50/55 to-background sm:max-w-md sm:rounded-lg dark:from-red-950/40 dark:to-background",
    iconBox:
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-100/80 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
  },
}

type MesLaminacionConfirmDialogProps = {
  tone: MesLaminacionConfirmTone
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  confirmVariant?: "default" | "destructive"
}

function MesLaminacionConfirmDialog(props: MesLaminacionConfirmDialogProps) {
  const skin = MES_MONTAJE_CONFIRM[props.tone]
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={skin.panel}>
        <DialogHeader className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className={skin.iconBox}>{props.icon}</div>
            <div className="min-w-0 space-y-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">{props.title}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">{props.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant={props.confirmVariant ?? "default"} onClick={() => props.onConfirm()}>
            {props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const MES_LAMINACION_TOAST_SURFACE_STYLE = {
  backgroundColor: "#ffffff",
  opacity: 1,
} as const

const MES_LAMINACION_SUCCESS_TOAST_CLASSNAMES = {
  toast:
    "!bg-white !opacity-100 shadow-lg border border-slate-200 !text-slate-900 [--normal-bg:#ffffff] [--success-bg:#ffffff] [&_[data-close-button]]:!bg-white [&_[data-close-button]]:!border-slate-300 [&_[data-close-button]]:!opacity-100 [&_[data-description]]:!text-slate-600",
  title: "!text-slate-900 text-sm font-medium leading-snug",
  success: "!bg-white !border-slate-200 !text-slate-900",
  description: "!text-slate-600 text-sm leading-snug",
  icon: "text-violet-600",
  closeButton: "!bg-white !border-slate-300 hover:!bg-slate-50",
} as const

function mesLaminacionToastSuccess(message: string) {
  toast(message, {
    richColors: false,
    classNames: MES_LAMINACION_SUCCESS_TOAST_CLASSNAMES,
    style: MES_LAMINACION_TOAST_SURFACE_STYLE,
    icon: createElement(Sparkles, { className: "h-4 w-4 shrink-0 text-violet-600", "aria-hidden": true }),
  })
}

function mesLaminacionToastWarning(message: string) {
  toast(message, {
    richColors: false,
    classNames: {
      ...MES_LAMINACION_SUCCESS_TOAST_CLASSNAMES,
      toast:
        "!bg-white !opacity-100 shadow-lg border border-amber-200 !text-slate-900 [--normal-bg:#ffffff] [--warning-bg:#ffffff] [&_[data-close-button]]:!bg-white [&_[data-close-button]]:!border-amber-200 [&_[data-close-button]]:!opacity-100 [&_[data-description]]:!text-slate-600",
      warning: "!bg-white !border-amber-200 !text-slate-900",
      icon: "text-amber-600",
    },
    style: MES_LAMINACION_TOAST_SURFACE_STYLE,
    icon: createElement(AlertCircle, { className: "h-4 w-4 shrink-0 text-amber-600", "aria-hidden": true }),
  })
}

/** Borrador legacy del panel (solo se purga al cargar; ya no se escribe). */
const LEGACY_LAMINACION_DRAFT_KEY = "axones.laminacion.control.draft."

function purgeLegacyLaminacionDraft(workOrderId: number) {
  try {
    localStorage.removeItem(`${LEGACY_LAMINACION_DRAFT_KEY}${workOrderId}`)
  } catch {
    // ignore
  }
}

function clearLaminacionBrowserCache(workOrderId: number) {
  purgeLegacyLaminacionDraft(workOrderId)
  try {
    localStorage.removeItem(`axones.laminacion.timer-preview.${workOrderId}`)
  } catch {
    // ignore
  }
}

function mergePrefill(prefill: Record<string, unknown>, form?: Record<string, unknown> | null) {
  return { ...prefill, ...(form ?? {}) }
}

export default function WorkOrderLaminacionControlPanel({
  workOrderId,
  canFinalizeOrder = false,
}: {
  workOrderId: number
  /** Solo jefe/admin puede finalizar el área de laminacion (lamEstadoArea). */
  canFinalizeOrder?: boolean
}) {
  const lamObsTextareaId = useId().replace(/:/g, "")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [labelEditorOpen, setLabelEditorOpen] = useState(false)
  const [labelEditorMode, setLabelEditorMode] = useState<LamLabelEditorMode>("virgen")
  const [labelEditorIndex, setLabelEditorIndex] = useState(0)
  const [labelEditorDraft, setLabelEditorDraft] = useState<BobinaLabelMeta>(emptyBobinaLabelMeta())
  const [labelEditorError, setLabelEditorError] = useState("")
  const [checklistOpen, setChecklistOpen] = useState(false)

  /** Borrador para iniciar turno (sin turno activo). */
  const [draftTurno, setDraftTurno] = useState<"diurno" | "nocturno">("diurno")
  const [draftGrupo, setDraftGrupo] = useState<"A" | "B" | "C">("A")
  const [draftPeople, setDraftPeople] = useState<DraftPerson[]>([])
  const [draftStaging, setDraftStaging] = useState<{ name: string; role: DraftPersonRole }>({
    name: "",
    role: "operador",
  })
  const draftPeopleRef = useRef<DraftPerson[]>([])
  draftPeopleRef.current = draftPeople

  const draftOperadorName = useMemo(
    () => draftPeople.find((p) => p.role === "operador")?.name.trim() ?? "",
    [draftPeople],
  )
  const draftSupervisorName = useMemo(
    () => draftPeople.find((p) => p.role === "supervisor")?.name.trim() ?? "",
    [draftPeople],
  )
  const draftAyudantesLabel = useMemo(() => {
    const names = draftPeople
      .filter((p) => p.role === "ayudante")
      .map((p) => p.name.trim())
      .filter(Boolean)
    return names.join("; ")
  }, [draftPeople])
  const draftOperadorMissing = useMemo(() => !draftOperadorName, [draftOperadorName])

  const onDraftStagingName = useCallback((v: string) => {
    setDraftStaging((s) => ({ ...s, name: v }))
  }, [])

  const onDraftStagingRole = useCallback((v: DraftPersonRole) => {
    setDraftStaging((s) => ({ ...s, role: v }))
  }, [])

  const guardarDraftPerson = useCallback((name: string, role: DraftPersonRole) => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Escriba el nombre antes de guardar.")
      return
    }
    const prev = draftPeopleRef.current
    if (role === "supervisor" && prev.some((p) => p.role === "supervisor")) {
      mesLaminacionToastWarning("Solo puede haber un Supervisor en el turno.")
      return
    }
    if (role === "operador" && prev.some((p) => p.role === "operador")) {
      mesLaminacionToastWarning("Solo puede haber un Operador principal en el turno.")
      return
    }
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setDraftPeople((p) => [...p, { id, role, name: trimmed, grupo: draftGrupo, turno: draftTurno }])
    setDraftStaging((s) => ({ ...s, name: "" }))
  }, [draftGrupo, draftTurno])

  const removeDraftPerson = useCallback((id: string) => {
    setDraftPeople((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      setPrefill(payload.prefill ?? {})
      const mergedForm = mergePrefill(payload.prefill ?? {}, payload.form)
      const boot = bootstrapLaminacionFormState(mergedForm)
      const areaEstadoOnLoad = readLaminacionEstadoArea(boot[LAM_ESTADO_KEY])
      purgeLegacyLaminacionDraft(workOrderId)
      setForm(boot)
      if (areaEstadoOnLoad === "finalizada") {
        try {
          localStorage.removeItem(`axones.laminacion.timer-preview.${workOrderId}`)
        } catch {
          // ignore
        }
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT para laminacion.")
      setPrefill({})
      setForm({})
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { inventory_area: "material", per_page: 200, page: 1 },
        })
        if (!cancelled) setMaterials(data.data ?? [])
      } catch {
        if (!cancelled) setMaterials([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const entradaImpresaBobinas = useMemo(
    () => getNumericSeries(form, "lamEntradaImpresaBobinasKg", LAM_BOBINAS_SLOTS),
    [form],
  )
  const entradaVirgenBobinas = useMemo(
    () => getNumericSeries(form, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS),
    [form],
  )
  const salidaBobinas = useMemo(() => getNumericSeries(form, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS), [form])
  const entradaImpresaBobinasMeta = useMemo(
    () => getMetaSeries(form, "lamEntradaImpresaBobinasMeta", LAM_BOBINAS_SLOTS),
    [form],
  )
  const entradaVirgenBobinasMeta = useMemo(
    () => getMetaSeries(form, "lamEntradaVirgenBobinasMeta", LAM_BOBINAS_SLOTS),
    [form],
  )
  const salidaBobinasMeta = useMemo(() => getMetaSeries(form, "lamSalidaBobinasMeta", LAM_BOBINAS_SLOTS), [form])
  const totalEntradaImpresa = useMemo(() => sumSeriesKg(entradaImpresaBobinas), [entradaImpresaBobinas])
  const totalEntradaVirgen = useMemo(() => sumSeriesKg(entradaVirgenBobinas), [entradaVirgenBobinas])
  const sustratosLam = useMemo(() => getSustratosLamRows(form), [form])
  const materialById = useMemo(() => {
    const map = new Map<string, MaterialRow>()
    for (const m of materials) map.set(String(m.id), m)
    return map
  }, [materials])
  const totalSalida = useMemo(() => sumSeriesKg(salidaBobinas), [salidaBobinas])
  const closedTurnos = useMemo(() => parseLaminacionTurnos(form[LAM_TURNOS_KEY]), [form])
  const activeTurno = useMemo(() => parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY]), [form])
  const lamAdhesivoEntrada = pickLamTurnoMaterialField(
    activeTurno?.adhesivoEntradaKg,
    form.lamAdhesivoEntradaKg,
  )
  const lamAdhesivoSobro = pickLamTurnoMaterialField(activeTurno?.adhesivoSobroKg, form.lamAdhesivoSobroKg)
  const lamCatalizadorEntrada = pickLamTurnoMaterialField(
    activeTurno?.catalizadorEntradaKg,
    form.lamCatalizadorEntradaKg,
  )
  const lamCatalizadorSobro = pickLamTurnoMaterialField(
    activeTurno?.catalizadorSobroKg,
    form.lamCatalizadorSobroKg,
  )
  const lamAcetatoEntrada = pickLamTurnoMaterialField(activeTurno?.acetatoEntradaLt, form.lamAcetatoEntradaLt)
  const lamAcetatoSobro = pickLamTurnoMaterialField(activeTurno?.acetatoSobroLt, form.lamAcetatoSobroLt)
  const adhesivoConsumido = computeLamMaterialConsumo(lamAdhesivoEntrada, lamAdhesivoSobro)
  const catalizadorConsumido = computeLamMaterialConsumo(lamCatalizadorEntrada, lamCatalizadorSobro)
  const acetatoConsumido = computeLamMaterialConsumo(lamAcetatoEntrada, lamAcetatoSobro)
  const scrapTransparente = readLamNumber(
    activeTurno ? pickLamTurnoMaterialField(activeTurno.scrapTransparenteKg, form.lamScrapTransparenteKg) : form.lamScrapTransparenteKg,
  )
  const scrapImpreso = readLamNumber(
    activeTurno ? pickLamTurnoMaterialField(activeTurno.scrapImpresoKg, form.lamScrapImpresoKg) : form.lamScrapImpresoKg,
  )
  const scrapLaminado = readLamNumber(
    activeTurno ? pickLamTurnoMaterialField(activeTurno.scrapLaminadoKg, form.lamScrapLaminadoKg) : form.lamScrapLaminadoKg,
  )
  const totalScrap = scrapTransparente + scrapImpreso + scrapLaminado
  const totalEntradaTurno = totalEntradaImpresa + totalEntradaVirgen + adhesivoConsumido

  const lamWarehouseReturn = useMesWarehouseReturn({
    workOrderId,
    workOrderCode:
      readString(prefill.code) || readString(prefill.numeroOrden) || `OT-${workOrderId}`,
    form,
    setForm,
    config: {
      originArea: "Laminación",
      areaRequestTitlePrefix: "Devolución desde Laminación",
      keys: {
        devolucionBuenaKg: "lamDevolucionBuenaKg",
        devolucionRechazadaBobinas: "lamDevolucionRechazadaBobinas",
        devolucionRechazadaKg: "lamDevolucionRechazadaKg",
        devolucionRechazadaMotivo: "lamDevolucionRechazadaMotivo",
        ultimoEnvioMs: "lamDevolucionesAlmacenUltimoEnvioMs",
        snapBuena: "lamDevolucionesAlmacenSnapBuena",
        snapRech: "lamDevolucionesAlmacenSnapRech",
      },
    },
    onSuccess: mesLaminacionToastSuccess,
    defaultOperador: readString(form.lamOperador),
  })

  const devolucionRechazadaKg = readLamNumber(form.lamDevolucionRechazadaKg)
  const devolucionRechazadaBobinas = countDevolucionRechazadaBobinas(
    form.lamDevolucionRechazadaBobinas,
    form.lamDevolucionRechazadaKg,
  )

  const checklistCheckedIds = useMemo(
    () => parseLamChecklistChecked(form.lamChecklistChecked),
    [form.lamChecklistChecked],
  )
  const { mermaCalc, refilPct } = useMemo(
    () =>
      computeLamMermaRefil({
        totalEntradaImpresa,
        totalEntradaVirgen,
        adhesivoConsumido,
        totalSalida,
        totalScrap,
      }),
    [totalEntradaImpresa, totalEntradaVirgen, adhesivoConsumido, totalSalida, totalScrap],
  )

  const areaEstado = readLaminacionEstadoArea(form[LAM_ESTADO_KEY])
  const areaFinalizada = areaEstado === "finalizada"
  const canPreviewPlanillaReport = areaFinalizada
  const readOnlyOps = areaFinalizada && !canFinalizeOrder
  const hasActiveTurno = activeTurno !== null
  const jsonAccum = useMemo(
    () => accumulateLaminacionFromJson(closedTurnos, activeTurno),
    [closedTurnos, activeTurno],
  )

  const patchActiveTurn = useCallback((updater: (t: LaminacionTurnoEntry) => LaminacionTurnoEntry) => {
    setForm((prev) => {
      const cur = parseLaminacionTurnoActual(prev[LAM_ACTUAL_KEY])
      if (!cur) return prev
      const nextTurn = updater(cur)
      return {
        ...prev,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      }
    })
  }, [])

  const totalSalidaTurno = activeTurno
    ? sumSalidaKgTurno(activeTurno)
    : sumSeriesKg(getNumericSeries(form, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS))
  const pedidoTotalKg = readNumber(form.pedidoKg ?? prefill.pedidoKg)
  const producidoAcumuladoKg =
    readNumber(form.lamAcumuladoProducidoKg) > 0
      ? readNumber(form.lamAcumuladoProducidoKg)
      : jsonAccum.producidoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = jsonAccum.turnosRegistrados
  const totalProduccionAcumulada = jsonAccum.producidoKg
  const totalScrapAcumulada = jsonAccum.scrapKg
  const ultimoTurnoLabel = hasActiveTurno ? "Turno en curso" : jsonAccum.ultimoCierreLabel

  const [timerTick, setTimerTick] = useState(0)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [startTurnConfirmOpen, setStartTurnConfirmOpen] = useState(false)
  const [timerConfirm, setTimerConfirm] = useState<MesTimerConfirmKey | null>(null)
  const [takeoverConfirmOpen, setTakeoverConfirmOpen] = useState(false)
  const [previewTimerConfirmOpen, setPreviewTimerConfirmOpen] = useState(false)
  const [closeTurnConfirmOpen, setCloseTurnConfirmOpen] = useState(false)
  const [finalizeOtConfirmOpen, setFinalizeOtConfirmOpen] = useState(false)
  const [emptyShiftCloseDialogOpen, setEmptyShiftCloseDialogOpen] = useState(false)
  const pendingEmptyShiftCloseRef = useRef<{
    cur: LaminacionTurnoEntry
    finalizedTimer: LaminacionTurnTimer
  } | null>(null)
  const pauseReasons = LAM_PAUSE_REASONS

  const timerState = readString(form.lamTimerState) || "pending"
  const arranqueState = readString(form.lamTimerArranqueState) || "idle"
  const demountState = readString(form.lamTimerDemountState) || "idle"
  const arranqueRunning = arranqueState === "running"
  const demountRunning = demountState === "running"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const nowMs = Date.now() + timerTick * 0
  const operativoEstado = useMemo(
    () => deriveLaminacionOperativoEstado(form, nowMs),
    [form, timerTick],
  )
  const otEffectiveAccSec = useMemo(
    () => cumulativeEffectiveSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const otDeadAccSec = useMemo(
    () => cumulativeDeadSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const otTotalAccSec = useMemo(
    () => cumulativeTotalPersistedSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const otDemountAccSec = useMemo(
    () => cumulativeDemountSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  const displayEffectiveSec = otEffectiveAccSec
  const displayDeadSec = otDeadAccSec
  const displayTotalSec = otTotalAccSec
  const displayDemountSec = otDemountAccSec
  const kgHora =
    displayEffectiveSec > 0.01
      ? (producidoAcumuladoKg / (displayEffectiveSec / 3600)).toFixed(2)
      : "0.00"
  const displayHoraArranque = useMemo(() => {
    if (!activeTurno) return "—"
    const t = activeTurno.timer
    if (t.arranqueStartedAtMs > 0) {
      return formatHoraArranqueFromMs(t.arranqueStartedAtMs)
    }
    return formatHoraArranqueFromMs(horaArranqueMsFromTimer(t))
  }, [activeTurno])
  const pauseEntries = useMemo<LaminacionPauseEntry[]>(() => {
    const raw = form.lamTimerPauses
    if (!Array.isArray(raw)) return []
    return raw
      .map((x) => x as Partial<LaminacionPauseEntry>)
      .map((x) => ({
        at: readString(x.at),
        reason: readString(x.reason),
        obs: readString(x.obs),
        duration_sec: readNumber(x.duration_sec),
      }))
      .filter((x) => x.reason)
  }, [form.lamTimerPauses])

  const sessionUser = useMemo(() => getStoredUser(), [])
  const isBossLike = canFinalizeOrder
  const activeOwnerId = activeTurno?.control_owner_user_id ?? null
  const activeOwnerName = activeTurno?.control_owner_name ?? null
  const canEditByControl = useMemo(() => {
    if (!hasActiveTurno) return true
    if (isBossLike) return true
    if (!activeOwnerId || !sessionUser?.id) return true
    return activeOwnerId === sessionUser.id
  }, [activeOwnerId, hasActiveTurno, isBossLike, sessionUser?.id])

  const controlReadOnly = readOnlyOps || !canEditByControl

  const [pauseMotivoModalOpen, setPauseMotivoModalOpen] = useState(false)
  const wasTimerPausedRef = useRef(false)

  useEffect(() => {
    if (wasTimerPausedRef.current && !timerPaused) {
      setPauseMotivoModalOpen(false)
    }
    wasTimerPausedRef.current = timerPaused
  }, [timerPaused])

  const timerEverStarted = useMemo(
    () => hasProductionTimerStarted(mesTimerFieldsFromForm(form, "lam")),
    [form],
  )

  const canSaveProduction = useMemo(() => {
    if (controlReadOnly) return false
    return canSaveProductionAreaForm(form, MES_PRODUCTION_SAVE_CONFIG.laminacion)
  }, [controlReadOnly, form])

  const canPersistShiftOpen = useMemo(() => {
    if (controlReadOnly) return false
    return hasActiveTurno
  }, [controlReadOnly, hasActiveTurno])

  const canPersistEntreTurnos = useMemo(() => {
    if (controlReadOnly || areaFinalizada) return false
    if (hasActiveTurno) return false
    return closedTurnos.length > 0
  }, [areaFinalizada, closedTurnos.length, controlReadOnly, hasActiveTurno])

  const canClickGuardar = canSaveProduction || canPersistShiftOpen || canPersistEntreTurnos

  const guardarHint = useMemo(() => {
    if (controlReadOnly) return ""
    if (canSaveProduction) {
      return "Guardar cierra este turno, lo deja en el historial arriba y reinicia las rejillas para abrir otro turno (Turno / Grupo / Personal)."
    }
    if (canPersistShiftOpen) {
      return "Turno abierto: puede guardar cuadrilla sin producción. Para cerrar el turno con bobinas y tiempos, inicie el cronómetro (play) y pulse Guardar."
    }
    if (canPersistEntreTurnos) {
      return "Entre turnos: puede guardar de nuevo el historial y los kg acumulados en el servidor (p. ej. si la bandeja no se actualizó)."
    }
    return MES_SAVE_BLOCKED_MESSAGE
  }, [canPersistEntreTurnos, canPersistShiftOpen, canSaveProduction, controlReadOnly])

  const canPreviewTimerReport = useMemo(() => {
    if (!hasActiveTurno) return false
    if (controlReadOnly) return false
    if (areaFinalizada) return false
    return timerEverStarted
  }, [hasActiveTurno, controlReadOnly, areaFinalizada, timerEverStarted])

  const timerActionFlags = useMemo(
    () =>
      buildMesTimerActionFlags({
        base: !controlReadOnly && hasActiveTurno && !areaFinalizada,
        arranqueRunning,
        demountRunning,
        timerRunning,
        timerPaused,
        canFinalizeOrder,
        areaFinalizada,
        controlReadOnly,
        timerState,
        canPreview: canPreviewTimerReport,
      }),
    [
      areaFinalizada,
      arranqueRunning,
      canFinalizeOrder,
      canPreviewTimerReport,
      controlReadOnly,
      demountRunning,
      hasActiveTurno,
      timerPaused,
      timerRunning,
      timerState,
    ],
  )

  function requestTakeover() {
    if (readOnlyOps) return
    if (!hasActiveTurno) return
    if (isBossLike) {
      confirmTakeover()
      return
    }
    setTakeoverConfirmOpen(true)
  }

  function confirmTakeover() {
    if (readOnlyOps) return
    if (!hasActiveTurno) return
    const u = getStoredUser()
    if (!u) {
      toast.error("Sesión inválida. Vuelva a iniciar sesión.")
      return
    }
    const cur = activeTurno
    if (!cur) return
    const nextTurn: LaminacionTurnoEntry = {
      ...cur,
      control_owner_user_id: u.id,
      control_owner_name: u.name,
      control_taken_at: new Date().toISOString(),
    }
    patchActiveTurn(() => nextTurn)
    setTakeoverConfirmOpen(false)
    mesLaminacionToastSuccess("Control tomado. Puede editar el turno.")
    void persistLaminacionForm(
      {
        ...form,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: timerEverStarted,
      },
    )
  }

  function runOpenTimerReportPreview() {
    const payload = {
      generated_at: new Date().toISOString(),
      work_order_id: workOrderId,
      work_order_code: readString(prefill.code) || `OT-${workOrderId}`,
      product: readString((prefill as Record<string, unknown>).productName) || null,
      client: readString((prefill as Record<string, unknown>).clientName) || null,
      turno: {
        turno: readString(form.lamTurno),
        grupo: readString(form.lamGrupo),
        operador: readString(form.lamOperador),
        ayudante: readString(form.lamAyudante),
        supervisor: readString(form.lamSupervisor),
      },
      timer: {
        state: timerState,
        total_hms: formatTimerHms(displayTotalSec),
        dead_hms: formatTimerHms(displayDeadSec),
        effective_hms: formatTimerHms(displayEffectiveSec),
        kg_hora: kgHora,
      },
      pauses: pauseEntries.map((p) => ({
        at: p.at,
        reason: p.reason,
        obs: p.obs,
        duration_hms: formatTimerHms(p.duration_sec),
      })),
    }
    const previewHash = (() => {
      try {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
        return `#p=${encodeURIComponent(encoded)}`
      } catch {
        return ""
      }
    })()
    if (!previewHash) {
      toast.error("No se pudo preparar la vista previa.")
      return
    }
    const url = appAbsoluteUrl(
      `/ordenes-trabajo/${encodeURIComponent(String(workOrderId))}/laminacion/temporizador/vista-previa${previewHash}`,
    )
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function requestOpenTimerReportPreview() {
    if (!canPreviewTimerReport) {
      toast.error("Inicie el cronómetro para habilitar la vista previa.")
      return
    }
    setPreviewTimerConfirmOpen(true)
  }

  function openPlanillaPreview() {
    if (!areaFinalizada) {
      toast.error("Finalice el área de laminación para ver la planilla.")
      return
    }
    const ok = openLaminacionPlanillaPreviewFromSource({
      work_order_id: workOrderId,
      work_order_code: readString(prefill.code) || `OT-${workOrderId}`,
      client: readString((prefill as Record<string, unknown>).clientName) || null,
      product: readString((prefill as Record<string, unknown>).productName) || null,
      form: form as Record<string, unknown>,
      board_stage: "laminacion",
    })
    if (!ok) {
      toast.error("No se pudo abrir la vista previa de planilla.")
    }
  }

  function confirmOpenTimerReportPreview() {
    setPreviewTimerConfirmOpen(false)
    runOpenTimerReportPreview()
  }

  function requestCerrarTurnoActual() {
    if (controlReadOnly) return
    const cur = parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY])
    if (!cur) return
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador.")
      return
    }
    setCloseTurnConfirmOpen(true)
  }

  function confirmCloseTurnFirstStep() {
    setCloseTurnConfirmOpen(false)
    cerrarTurnoActual()
  }

  function requestFinalizarAreaLaminacion() {
    if (!canFinalizeOrder) return
    setFinalizeOtConfirmOpen(true)
  }

  function confirmFinalizarAreaLaminacion() {
    setFinalizeOtConfirmOpen(false)
    void finalizarAreaLaminacion()
  }

  const outlierWarnings = useMemo(() => {
    const warnings: string[] = []
    const MAX_KG_PRODUCCION = 50000
    const MAX_MERMA = 10000
    const MAX_METRAJE = 1000000

    if (totalSalidaTurno > MAX_KG_PRODUCCION) {
      warnings.push(`Salida del turno elevada (${totalSalidaTurno.toFixed(2)} Kg). Verifique unidad y captura.`)
    }
    const scrapTurno = activeTurno ? sumScrapKgTurno(activeTurno) : readLamNumber(form.lamScrapLaminadoKg)
    if (scrapTurno > MAX_MERMA) {
      warnings.push(`Desperdicio del turno alto (${scrapTurno.toFixed(2)} Kg).`)
    }
    const metraje = readNumber(form.lamMetrajeProduccion)
    if (metraje > MAX_METRAJE) {
      warnings.push(`Metraje elevado (${metraje.toFixed(0)}). Revise que no haya ceros extra.`)
    }
    if (pedidoTotalKg > 0 && producidoAcumuladoKg > pedidoTotalKg + 0.01) {
      warnings.push(
        `Producido acumulado (${producidoAcumuladoKg.toFixed(2)} Kg) supera el pedido (${pedidoTotalKg.toFixed(2)} Kg). Verifique unidades o captura.`,
      )
    }
    return warnings
  }, [totalSalidaTurno, form.lamScrapLaminadoKg, form.lamMetrajeProduccion, pedidoTotalKg, producidoAcumuladoKg])

  const persistLaminacionForm = useCallback(
    async (
      srcBase?: Record<string, unknown>,
      options?: {
        skipProductionSaveGuard?: boolean
        notifyProductionSave?: boolean
        successMessage?: string
        suppressSuccessToast?: boolean
      },
    ): Promise<boolean> => {
      const src = srcBase ?? form
      if (!Number.isFinite(workOrderId) || workOrderId < 1) return false
      const notifyProductionSave = options?.notifyProductionSave !== false

      if (
        notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !canSaveProductionAreaForm(src, MES_PRODUCTION_SAVE_CONFIG.laminacion)
      ) {
        toast.error(MES_SAVE_BLOCKED_MESSAGE)
        return false
      }

      const finalizingArea = readLaminacionEstadoArea(src[LAM_ESTADO_KEY]) === "finalizada"
      if (
        !finalizingArea &&
        !notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !parseLaminacionTurnoActual(src[LAM_ACTUAL_KEY])
      ) {
        toast.error("Abra un turno de planta antes de guardar.")
        return false
      }

      const act = parseLaminacionTurnoActual(src[LAM_ACTUAL_KEY])
      if (act) {
        const operador = act.operador.trim()
        const turno = act.turno
        const grupo = act.grupo
        if (!operador || !turno || !grupo) {
          toast.error("Laminación: complete turno, grupo y operador antes de guardar.")
          return false
        }
      }

      if (outlierWarnings.length > 0) {
        mesLaminacionToastWarning(`Se detectaron ${outlierWarnings.length} valores atípicos. Se guardará de todas formas.`)
      }

      let closedP = parseLaminacionTurnos(src[LAM_TURNOS_KEY])
      let actualP = parseLaminacionTurnoActual(src[LAM_ACTUAL_KEY])
      if (actualP) {
        actualP = syncLaminacionTurnoFromFormMirror(src, actualP)
      }
      const accFromJson = accumulateLaminacionFromJson(closedP, actualP)
      const closedTimerMirror =
        actualP === null && closedP.length > 0 ? laminacionAggregatedTimerMirrorFromTurnos(closedP) : null

      const seriesBase = actualP
        ? {
            entradaImpresaBobinas: actualP.entradaImpresaBobinasKg,
            entradaVirgenBobinas: actualP.entradaVirgenBobinasKg,
            salidaBobinas: actualP.salidaBobinasKg,
            entradaImpresaBobinasMeta: actualP.entradaImpresaBobinasMeta,
            entradaVirgenBobinasMeta: actualP.entradaVirgenBobinasMeta,
            salidaBobinasMeta: actualP.salidaBobinasMeta,
          }
        : {
            entradaImpresaBobinas: getNumericSeries(src, "lamEntradaImpresaBobinasKg", LAM_BOBINAS_SLOTS),
            entradaVirgenBobinas: getNumericSeries(src, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS),
            salidaBobinas: getNumericSeries(src, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS),
            entradaImpresaBobinasMeta: getMetaSeries(src, "lamEntradaImpresaBobinasMeta", LAM_BOBINAS_SLOTS),
            entradaVirgenBobinasMeta: getMetaSeries(src, "lamEntradaVirgenBobinasMeta", LAM_BOBINAS_SLOTS),
            salidaBobinasMeta: getMetaSeries(src, "lamSalidaBobinasMeta", LAM_BOBINAS_SLOTS),
          }

      const normalizedForm = normalizeLaminacionFormForSave(
        {
          ...src,
          [LAM_TURNOS_KEY]: closedP,
          [LAM_ACTUAL_KEY]: actualP,
          [LAM_ESTADO_KEY]: readLaminacionEstadoArea(src[LAM_ESTADO_KEY]),
          lamTimerEffectiveAccSec: normalizeNumericString(
            closedTimerMirror?.lamTimerEffectiveAccSec ?? src.lamTimerEffectiveAccSec,
          ),
          lamTimerDeadAccSec: normalizeNumericString(
            closedTimerMirror?.lamTimerDeadAccSec ?? src.lamTimerDeadAccSec,
          ),
          lamTimerState: readString(closedTimerMirror?.lamTimerState ?? src.lamTimerState) || "pending",
          lamTimerLastResumeAtMs: normalizeNumericString(
            closedTimerMirror?.lamTimerLastResumeAtMs ?? src.lamTimerLastResumeAtMs,
          ),
          lamTimerPauseAtMs: normalizeNumericString(
            closedTimerMirror?.lamTimerPauseAtMs ?? src.lamTimerPauseAtMs,
          ),
          lamRegistrosTurnos: String(accFromJson.turnosRegistrados),
          lamAcumuladoProducidoKg: normalizeNumericString(accFromJson.producidoKg),
          lamScrapAcumuladoKg: normalizeNumericString(accFromJson.scrapKg),
        },
        seriesBase,
      )

      const laminacionOnlyForm: Record<string, unknown> = Object.fromEntries(
        Object.entries(normalizedForm).filter(([k]) => k && k.startsWith("lam")),
      )

      setSaving(true)
      try {
        await apiFetch(`work-orders/${workOrderId}/orden-trabajo/laminacion-control`, {
          method: "PATCH",
          body: JSON.stringify({
            form: laminacionOnlyForm,
            origin_area: "laminacion",
            notify_on_production_save: notifyProductionSave,
          }),
        })
        setForm(bootstrapLaminacionFormState(normalizedForm))
        if (!options?.suppressSuccessToast) {
          mesLaminacionToastSuccess(
            options?.successMessage ??
              (notifyProductionSave
                ? "Control de laminación guardado."
                : "Turno de planta guardado en el servidor."),
          )
        }
        window.dispatchEvent(
          new CustomEvent(LAMINACION_CONTROL_SAVED_EVENT, { detail: { workOrderId } }),
        )
        window.dispatchEvent(new Event("alerts:refresh"))
        return true
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo guardar control de laminación.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [form, outlierWarnings.length, workOrderId],
  )

  useEffect(() => {
    if (!timerRunning && !timerPaused && !arranqueRunning && !demountRunning) return
    const id = window.setInterval(() => setTimerTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [timerPaused, timerRunning, arranqueRunning, demountRunning])

  function patchAndPersistTimer(
    updater: (timer: LaminacionTurnTimer) => LaminacionTurnTimer,
    successMessage?: string,
  ) {
    const cur = activeTurno
    if (!cur) return
    const nextTurn: LaminacionTurnoEntry = { ...cur, timer: updater(cur.timer) }
    patchActiveTurn(() => nextTurn)
    void persistLaminacionForm(
      {
        ...form,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage,
      },
    )
  }

  function requestTimerConfirm(key: MesTimerConfirmKey) {
    if (controlReadOnly) return
    setTimerConfirm(key)
  }

  function executeTimerConfirm(key: MesTimerConfirmKey) {
    if (!mesTimerConfirmNeedsActiveTurno(key)) {
      requestFinalizarAreaLaminacion()
      return
    }
    const cur = activeTurno
    if (!cur) return
    const phase = applyMesPhaseConfirmToTimer(key, cur.timer)
    if (phase) {
      patchAndPersistTimer(() => phase.timer, phase.message)
      return
    }
    switch (key) {
      case "startProduction":
        confirmStartProductionTimer()
        break
      case "startDeadTime":
        executePauseProductionTimer()
        break
      case "endDeadTime":
        confirmResumeProductionAfterDeadTime()
        break
      case "cerrarTurno":
        requestCerrarTurnoActual()
        break
      default:
        break
    }
  }

  function confirmStartProductionTimer() {
    if (!hasActiveTurno || controlReadOnly) return
    const now = Date.now()
    const cur = activeTurno
    if (!cur) return
    const nextTurn: LaminacionTurnoEntry = {
      ...cur,
      timer: {
        ...cur.timer,
        state: "running",
        startedAtMs: cur.timer.startedAtMs || now,
        deadAccSec: deadAccSecAfterResume(cur.timer, now),
        lastResumeAtMs: now,
        pauseAtMs: 0,
      },
    }
    patchActiveTurn(() => nextTurn)
    void persistLaminacionForm(
      {
        ...form,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        suppressSuccessToast: true,
      },
    )
  }

  function confirmResumeProductionAfterDeadTime() {
    if (!hasActiveTurno || controlReadOnly || !timerPaused) return
    const now = Date.now()
    const cur = activeTurno
    if (!cur) return
    const nextTurn: LaminacionTurnoEntry = {
      ...cur,
      timer: {
        ...cur.timer,
        state: "running",
        deadAccSec: deadAccSecAfterResume(cur.timer, now),
        lastResumeAtMs: now,
        pauseAtMs: 0,
      },
    }
    patchActiveTurn(() => nextTurn)
    void persistLaminacionForm(
      {
        ...form,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage: "Producción reanudada.",
      },
    )
  }

  /** Pausa atómica: un solo setForm + persist con el mismo snapshot (evita desincronía mirror / turno anidado). */
  function executePauseProductionTimer() {
    if (!timerRunning || controlReadOnly) return
    const now = Date.now()
    setForm((prev) => {
      const cur = parseLaminacionTurnoActual(prev[LAM_ACTUAL_KEY])
      if (!cur || cur.timer.state !== "running") return prev
      const last = cur.timer.lastResumeAtMs
      const nextTurn: LaminacionTurnoEntry = {
        ...cur,
        timer: {
          ...cur.timer,
          state: "paused",
          effectiveAccSec: cur.timer.effectiveAccSec + (last > 0 ? (now - last) / 1000 : 0),
          pauseAtMs: now,
          lastResumeAtMs: 0,
        },
      }
      const nextForm: Record<string, unknown> = {
        ...prev,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => {
        void persistLaminacionForm(nextForm, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          suppressSuccessToast: true,
        })
      })
      return nextForm
    })
    setPauseMotivoModalOpen(true)
  }

  function confirmPauseAndResume() {
    const reason = pauseReason.trim()
    if (!reason) {
      toast.error("Seleccione el motivo de parada.")
      return
    }
    const obs = pauseObs.trim()
    setForm((prev) => {
      const cur = parseLaminacionTurnoActual(prev[LAM_ACTUAL_KEY])
      if (!cur || cur.timer.state !== "paused") return prev
      const now = Date.now()
      const pauseStart = cur.timer.pauseAtMs
      const pauseDurationSec = pauseStart > 0 ? (now - pauseStart) / 1000 : 0
      const nextTurn: LaminacionTurnoEntry = {
        ...cur,
        timer: {
          ...cur.timer,
          state: "paused",
          deadAccSec: cur.timer.deadAccSec + pauseDurationSec,
          pauseAtMs: now,
          lastResumeAtMs: 0,
          pauses: [
            ...cur.timer.pauses,
            {
              at: new Date(now).toISOString(),
              reason,
              obs,
              duration_sec: pauseDurationSec,
            },
          ],
        },
      }
      const nextForm: Record<string, unknown> = {
        ...prev,
        [LAM_ACTUAL_KEY]: nextTurn,
        ...laminacionTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => {
        void persistLaminacionForm(nextForm, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          suppressSuccessToast: true,
        })
      })
      return nextForm
    })
    setPauseReason("")
    setPauseObs("")
    setPauseMotivoModalOpen(false)
    mesLaminacionToastSuccess("Parada registrada. El cronómetro sigue en pausa; use play para reanudar el tiempo efectivo.")
  }

  function requestIniciarTurno() {
    if (readOnlyOps) return
    if (hasActiveTurno) return
    if (!draftOperadorName) {
      toast.error(
        draftPeople.length > 0
          ? "Falta un Operador en la cuadrilla. Guarde al menos una persona con rol Operador (Ayudante no basta)."
          : "Guarde al menos un operador en la cuadrilla antes de iniciar el turno.",
      )
      return
    }
    setStartTurnConfirmOpen(true)
  }

  function confirmIniciarTurno() {
    if (readOnlyOps) return
    if (hasActiveTurno) return
    if (!draftOperadorName) {
      setStartTurnConfirmOpen(false)
      toast.error(
        draftPeople.length > 0
          ? "Falta un Operador en la cuadrilla. Guarde al menos una persona con rol Operador (Ayudante no basta)."
          : "Guarde al menos un operador en la cuadrilla antes de iniciar el turno.",
      )
      return
    }
    const u = getStoredUser()
    const t = createNewLaminacionTurno({
      turno: draftTurno,
      grupo: draftGrupo,
      operador: draftOperadorName,
      controlOwner: u ? { id: u.id, name: u.name } : null,
    })
    const turnoWithPeople: LaminacionTurnoEntry = {
      ...t,
      ayudante: draftAyudantesLabel,
      supervisor: draftSupervisorName,
    }
    const nextForm: Record<string, unknown> = {
      ...form,
      [LAM_ACTUAL_KEY]: turnoWithPeople,
      ...laminacionTurnoToMirror(turnoWithPeople),
      [LAM_TURNOS_KEY]: parseLaminacionTurnos(form[LAM_TURNOS_KEY]),
    }
    setForm(nextForm)
    setDraftPeople([])
    setDraftStaging({ name: "", role: "operador" })
    setStartTurnConfirmOpen(false)
    void (async () => {
      await persistLaminacionForm(nextForm, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage:
          "Turno de planta abierto y guardado. Use play en «Cronómetro de producción» para iniciar tiempos.",
      })
    })()
  }

  async function applyCerrarTurno(
    cur: LaminacionTurnoEntry,
    finalizedTimer: LaminacionTurnTimer,
    options?: { notifyProductionSave?: boolean; successMessage?: string },
  ): Promise<boolean> {
    const latestForm = formRef.current
    const syncedCur = syncLaminacionTurnoFromFormMirror(latestForm, cur)
    const u = getStoredUser()
    const closedAt = new Date().toISOString()
    const closed: LaminacionTurnoEntry = {
      ...syncedCur,
      timer: finalizedTimer,
      closed_at: closedAt,
      closed_by: u ? { id: u.id, name: u.name } : null,
    }
    const turnos = [...parseLaminacionTurnos(latestForm[LAM_TURNOS_KEY]), closed]
    const acc = accumulateLaminacionFromJson(turnos, null)
    const nextForm: Record<string, unknown> = {
      ...latestForm,
      [LAM_TURNOS_KEY]: turnos,
      [LAM_ACTUAL_KEY]: null,
      ...clearLaminacionMirrorKeys(),
      ...laminacionAggregatedTimerMirrorFromTurnos(turnos),
      lamAcumuladoProducidoKg: normalizeNumericString(acc.producidoKg),
      lamRegistrosTurnos: String(acc.turnosRegistrados),
      lamScrapAcumuladoKg: normalizeNumericString(acc.scrapKg),
    }
    const ok = await persistLaminacionForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: options?.notifyProductionSave === true,
      suppressSuccessToast: true,
    })
    if (ok) {
      mesLaminacionToastSuccess(
        options?.successMessage ??
          "Turno guardado en el historial. Elija Turno, Grupo y Personal para iniciar el siguiente.",
      )
      await load()
    } else {
      toast.error("No se pudo guardar el cierre del turno en el servidor. Se restauraron los datos del servidor.")
      await load()
    }
    return ok
  }

  async function cerrarTurnoYGuardarHistorial(options?: {
    notifyProductionSave?: boolean
  }): Promise<boolean> {
    if (controlReadOnly) return false
    const latestForm = formRef.current
    const curRaw = parseLaminacionTurnoActual(latestForm[LAM_ACTUAL_KEY])
    if (!curRaw) {
      toast.error("No hay turno de planta abierto.")
      return false
    }
    const cur = syncLaminacionTurnoFromFormMirror(latestForm, curRaw)
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador antes de guardar.")
      return false
    }
    const finalizedTimer = finalizeLaminacionTurnTimerNow(cur.timer)
    if (finalizedTimer.effectiveAccSec < 0.01 && sumSalidaKgTurno(cur) < 0.005) {
      pendingEmptyShiftCloseRef.current = { cur, finalizedTimer }
      setEmptyShiftCloseDialogOpen(true)
      return false
    }
    return applyCerrarTurno(cur, finalizedTimer, {
      notifyProductionSave: options?.notifyProductionSave,
    })
  }

  function confirmEmptyShiftClose() {
    const p = pendingEmptyShiftCloseRef.current
    pendingEmptyShiftCloseRef.current = null
    setEmptyShiftCloseDialogOpen(false)
    if (!p) return
    void applyCerrarTurno(p.cur, p.finalizedTimer, { notifyProductionSave: true })
  }

  function cerrarTurnoActual() {
    void cerrarTurnoYGuardarHistorial({ notifyProductionSave: true })
  }

  async function finalizarAreaLaminacion() {
    if (!canFinalizeOrder) {
      toast.error("Solo jefatura puede finalizar el área de laminación.")
      return
    }
    const prev = form
    let turnos = parseLaminacionTurnos(prev[LAM_TURNOS_KEY])
    const cur = parseLaminacionTurnoActual(prev[LAM_ACTUAL_KEY])
    const u = getStoredUser()
    if (cur) {
      const closed: LaminacionTurnoEntry = {
        ...cur,
        timer: finalizeLaminacionTurnTimerNow(cur.timer),
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
      }
      turnos = [...turnos, closed]
    }
    const acc = accumulateLaminacionFromJson(turnos, null)
    const nextForm: Record<string, unknown> = {
      ...prev,
      [LAM_TURNOS_KEY]: turnos,
      [LAM_ACTUAL_KEY]: null,
      [LAM_ESTADO_KEY]: "finalizada",
      ...clearLaminacionMirrorKeys(),
      ...laminacionAggregatedTimerMirrorFromTurnos(turnos),
      lamAcumuladoProducidoKg: normalizeNumericString(acc.producidoKg),
      lamRegistrosTurnos: String(acc.turnosRegistrados),
      lamScrapAcumuladoKg: normalizeNumericString(acc.scrapKg),
    }
    setForm(bootstrapLaminacionFormState(nextForm))
    const ok = await persistLaminacionForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      clearLaminacionBrowserCache(workOrderId)
      mesLaminacionToastSuccess(
        "Área de laminación finalizada. La OT pasará a Finalizadas e Historial en la bandeja.",
      )
      await load()
    } else {
      toast.error("No se pudo finalizar el área de laminación. Revise su conexión o permisos de jefatura.")
    }
  }

  function openLabelEditor(mode: LamLabelEditorMode, idx: number) {
    const meta =
      mode === "impresa"
        ? entradaImpresaBobinasMeta[idx]
        : mode === "virgen"
          ? entradaVirgenBobinasMeta[idx]
          : salidaBobinasMeta[idx]
    setLabelEditorMode(mode)
    setLabelEditorIndex(idx)
    setLabelEditorDraft(labelEditorDraftFromMeta(meta, mode))
    setLabelEditorError("")
    setLabelEditorOpen(true)
  }

  function updateLabelDraft(key: keyof BobinaLabelMeta, value: string) {
    setLabelEditorDraft((prev) => ({ ...prev, [key]: value }))
    if (key === "fecha" && labelEditorError) setLabelEditorError("")
  }

  function clearLabelEditor() {
    if (labelEditorMode === "salida") {
      setLabelEditorDraft({ ...normalizeSalidaBobinaLabelMeta({}), fecha: todayBobinaLabelFecha() })
    } else {
      setLabelEditorDraft({ ...emptyBobinaLabelMeta(), fecha: todayBobinaLabelFecha() })
    }
    setLabelEditorError("")
  }

  function saveLabelEditor() {
    const normalized =
      labelEditorMode === "salida"
        ? normalizeSalidaBobinaLabelMeta(labelEditorDraft)
        : normalizeBobinaLabelMeta(labelEditorDraft)
    const err = validateBobinaLabelSave(normalized)
    if (err) {
      setLabelEditorError(err)
      return
    }
    patchActiveTurn((t) => {
      const next = { ...t }
      if (labelEditorMode === "impresa") {
        const meta = [...t.entradaImpresaBobinasMeta]
        meta[labelEditorIndex] = normalized
        next.entradaImpresaBobinasMeta = meta
      } else if (labelEditorMode === "virgen") {
        const meta = [...t.entradaVirgenBobinasMeta]
        meta[labelEditorIndex] = normalized
        next.entradaVirgenBobinasMeta = meta
      } else {
        const meta = [...t.salidaBobinasMeta]
        meta[labelEditorIndex] = normalized
        next.salidaBobinasMeta = meta
        const nextSalidaKg = [...t.salidaBobinasKg]
        while (nextSalidaKg.length < LAM_BOBINAS_SLOTS) nextSalidaKg.push("")
        const pesoLabel = readNumber(normalized.peso)
        if (pesoLabel > 0.005 && readNumber(nextSalidaKg[labelEditorIndex]) < 0.005) {
          nextSalidaKg[labelEditorIndex] = normalizeNumericString(pesoLabel)
          next.salidaBobinasKg = nextSalidaKg.slice(0, LAM_BOBINAS_SLOTS)
        }
      }
      return next
    })
    setLabelEditorOpen(false)
    setLabelEditorError("")
  }

  function patchBobinaKg(
    field: "entradaImpresaBobinasKg" | "entradaVirgenBobinasKg" | "salidaBobinasKg",
    idx: number,
    v: string,
  ) {
    const kg = sanitizeBobinaKgSlotInput(v)
    patchActiveTurn((t) => {
      const next = { ...t }
      if (field === "entradaImpresaBobinasKg") {
        const arr = [...t.entradaImpresaBobinasKg]
        arr[idx] = kg
        next.entradaImpresaBobinasKg = arr
      } else if (field === "entradaVirgenBobinasKg") {
        const arr = [...t.entradaVirgenBobinasKg]
        arr[idx] = kg
        next.entradaVirgenBobinasKg = arr
      } else {
        const arr = [...t.salidaBobinasKg]
        arr[idx] = kg
        next.salidaBobinasKg = arr
      }
      return next
    })
  }

  async function guardar() {
    if (canSaveProduction) {
      await cerrarTurnoYGuardarHistorial({ notifyProductionSave: true })
      return
    }
    if (canPersistShiftOpen) {
      await persistLaminacionForm(undefined, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage:
          "Turno guardado. Inicie el cronómetro (play) para habilitar el guardado de producción con aviso a otras áreas.",
      })
      return
    }
    if (canPersistEntreTurnos) {
      await persistLaminacionForm(undefined, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage: "Producción acumulada sincronizada con el servidor.",
      })
      return
    }
    toast.error(MES_SAVE_BLOCKED_MESSAGE)
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de laminación…</p>

  return (
    <div className="ax-mes space-y-4">
      {hasActiveTurno && !readOnlyOps && !canEditByControl ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">Turno en control de otro usuario</div>
              <div className="text-amber-950/80">
                Control actual: <span className="font-semibold">{activeOwnerName ?? "—"}</span>
                <span className="mt-1 block font-mono tabular-nums">
                  Tiempo efectivo acumulado (OT): {formatHmsFromSeconds(otEffectiveAccSec)}
                </span>
              </div>
            </div>
            <Button type="button" variant="outline" className="border-amber-300" onClick={requestTakeover}>
              Tomar control
            </Button>
          </div>
        </div>
      ) : null}
      {outlierWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="mb-1 font-semibold">Advertencias de captura (no bloqueantes)</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {outlierWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="ax-ot">
        <div className="ot-section">
          <div className="section-header">
            <span className="inline-flex items-center gap-2">
              <Layers className="h-4 w-4" />
              AREA DE LAMINACION
            </span>
          </div>
          <div className="section-body">
            <div className="ot-grid ot-cols-4">
              <div className="ot-field sm:col-span-2 lg:col-span-1">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="ot-label">Figura embobinado</label>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Figura
                  </Badge>
                </div>
                <WindingFigurePicker
                  value={readString(form.figuraEmbobinadoLam)}
                  onChange={() => undefined}
                  className="pointer-events-none"
                />
              </div>
              <div className="ot-field">
                <label className="ot-label">Gramaje adhesivo (g/m2)</label>
                <input className="ot-input" value={readString(form.gramajeAdhesivo)} placeholder="1,5 A 2,2" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Relacion mezcla</label>
                <input className="ot-input" value={readString(form.relacionMezcla)} placeholder="100/80" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Observaciones</label>
                <input className="ot-input" value={readString(form.obsLaminacion)} readOnly />
              </div>
            </div>

            <div className="ot-lam-materiales-block">
              <div className="ot-lam-materiales-table">
                <span className="ot-lam-materiales-head">Materiales</span>
                <span className="ot-lam-materiales-head ot-lam-materiales-head--numeric">Kilos (kg)</span>
                <span className="ot-lam-materiales-head ot-lam-materiales-head--numeric">Metros (m)</span>

                <span className="ot-lam-materiales-label">Lámina impresa</span>
                <div className="ot-lam-materiales-cell">
                  <input
                    className="ot-input ot-lam-materiales-value-input"
                    readOnly
                    value={formatDecimalTwoDisplay(readNumberString(form.kgLaminaImpresaLaminacion))}
                    placeholder="420,00"
                  />
                </div>
                <div className="ot-lam-materiales-cell">
                  <input
                    className="ot-input ot-lam-materiales-value-input"
                    readOnly
                    value={lamMaterialMetrosDisplay(form.metrosLaminaImpresaLaminacion, "metrosLaminaImpresaLaminacion", null)}
                    placeholder="N/A"
                  />
                </div>

                <span className="ot-lam-materiales-label">Lámina virgen</span>
                <div className="ot-lam-materiales-cell">
                  <input
                    className="ot-input ot-lam-materiales-value-input"
                    readOnly
                    value={formatDecimalTwoDisplay(readNumberString(form.kgLaminaVirgenLaminacion))}
                    placeholder="420,00"
                  />
                </div>
                <div className="ot-lam-materiales-cell">
                  <input
                    className="ot-input ot-lam-materiales-value-input"
                    readOnly
                    value={lamMaterialMetrosDisplay(form.metrosLaminaVirgenLaminacion, "metrosLaminaVirgenLaminacion", null)}
                    placeholder="N/A"
                  />
                </div>

                <span className="ot-lam-materiales-label">Adhesivo para laminación</span>
                <div className="ot-lam-materiales-cell">
                  <input
                    className="ot-input ot-lam-materiales-value-input"
                    readOnly
                    value={formatDecimalTwoDisplay(readNumberString(form.kgAdhesivoLaminacion))}
                    placeholder="33,00"
                  />
                </div>
                <div className="ot-lam-materiales-cell">
                  <input
                    className="ot-input ot-lam-materiales-value-input"
                    readOnly
                    value={lamMaterialMetrosDisplay(form.metrosAdhesivoLaminacion, "metrosAdhesivoLaminacion", null)}
                    placeholder="N/A"
                  />
                </div>

                <span className="ot-lam-materiales-label">Catalizador para laminación</span>
                <div className="ot-lam-materiales-cell">
                  <input
                    className="ot-input ot-lam-materiales-value-input"
                    readOnly
                    value={formatDecimalTwoDisplay(readNumberString(form.kgCatalizadorLaminacion))}
                    placeholder="23,00"
                  />
                </div>
                <div className="ot-lam-materiales-cell">
                  <input
                    className="ot-input ot-lam-materiales-value-input"
                    readOnly
                    value={lamMaterialMetrosDisplay(form.metrosCatalizadorLaminacion, "metrosCatalizadorLaminacion", null)}
                    placeholder="N/A"
                  />
                </div>
              </div>
            </div>

            <div className="ot-section">
              <div className="section-header section-sublam">
                <span className="inline-flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  SUSTRATOS VIRGEN A UTILIZAR (LAMINACION)
                </span>
              </div>
              <div className="section-body">
                {sustratosLam.map((r, idx) => {
                  const material = materialById.get(r.material_id)
                  const free = readString(r.material_free_text).trim()
                  const materialLabel = free
                    ? free
                    : material
                      ? `${material.sku} · ${material.name}`
                      : readString(r.material_id).trim()
                        ? readString(r.material_id)
                        : ""
                  return (
                    <div key={idx} className="ot-grid ot-cols-2-asym ot-sustrato-lam">
                      <div className="ot-field">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="ot-label">{`Sustrato ${idx + 1}`}</label>
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Inventario
                          </Badge>
                        </div>
                        <input className="ot-input" value={materialLabel} placeholder="Seleccionar del inventario..." readOnly />
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Kg a utilizar</label>
                        <input className="ot-input" value={r.kg} placeholder="Ej: 430" readOnly />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="ot-grid ot-cols-4">
              <div className="ot-field">
                <label className="ot-label">Kg entrada</label>
                <input className="ot-input" value={readNumberString(form.kgEntradaLam)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Kg salida</label>
                <input className="ot-input" value={readNumberString(form.kgSalidaLam)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Metraje</label>
                <input className="ot-input" value={readNumberString(form.metrajeLam)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Merma</label>
                <input className="ot-input" value={readNumberString(form.mermaLam)} readOnly />
              </div>
            </div>

            <div className="ot-grid ot-cols-4">
              <div className="ot-field">
                <label className="ot-label">Kg entrada 2 (trilam.)</label>
                <input className="ot-input" value={readNumberString(form.kgEntradaLam2)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Kg salida 2 (trilam.)</label>
                <input className="ot-input" value={readNumberString(form.kgSalidaLam2)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Metraje 2</label>
                <input className="ot-input" value={readNumberString(form.metrajeLam2)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Merma 2</label>
                <input className="ot-input" value={readNumberString(form.mermaLam2)} readOnly />
              </div>
            </div>
          </div>
        </div>
      </div>

      <MesOperativoEstadoCard
        areaLabel="Laminación"
        estado={operativoEstado}
        producidoKg={totalProduccionAcumulada}
      />

      <div className="no-print mb-2 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-violet-300 text-violet-900 hover:bg-violet-50"
          onClick={() => setChecklistOpen(true)}
          disabled={controlReadOnly && areaFinalizada}
        >
          <ListChecks className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          Chequeo laminación
        </Button>
      </div>

      <WorkOrderLaminacionOpsSection
        pedidoTotalKg={pedidoTotalKg}
        producidoAcumuladoKg={producidoAcumuladoKg}
        faltanteKg={faltanteKg}
        turnosRegistrados={turnosRegistrados}
        totalProduccionAcumulada={totalProduccionAcumulada}
        totalScrapAcumulada={totalScrapAcumulada}
        ultimoTurnoLabel={ultimoTurnoLabel}
        timerState={timerState}
        totalSec={displayTotalSec}
        deadSec={displayDeadSec}
        effectiveSec={displayEffectiveSec}
        timerShowsOtAccumulated={closedTurnos.length > 0 || hasActiveTurno}
        kgHora={kgHora}
        horaArranque={displayHoraArranque}
        demountSec={displayDemountSec}
        arranqueRunning={arranqueRunning}
        demountRunning={demountRunning}
        timerRunning={timerRunning}
        timerPaused={timerPaused}
        timerActionFlags={timerActionFlags}
        onRequestTimerConfirm={requestTimerConfirm}
        pauseReasons={pauseReasons}
        pauseReason={pauseReason}
        pauseObs={pauseObs}
        pauseMotivoDialogOpen={pauseMotivoModalOpen}
        onPauseMotivoDialogOpenChange={setPauseMotivoModalOpen}
        pauseEntries={pauseEntries}
        lamTurno={readString(form.lamTurno)}
        lamGrupo={readString(form.lamGrupo)}
        lamOperador={readString(form.lamOperador)}
        lamAyudante={readString(form.lamAyudante)}
        lamSupervisor={readString(form.lamSupervisor)}
        metrajeRaw={readNumberString(form.lamMetrajeProduccion)}
        entradaImpresaBobinas={entradaImpresaBobinas}
        entradaImpresaMeta={entradaImpresaBobinasMeta}
        entradaVirgenBobinas={entradaVirgenBobinas}
        entradaVirgenMeta={entradaVirgenBobinasMeta}
        salidaBobinas={salidaBobinas}
        salidaMeta={salidaBobinasMeta}
        totalEntradaImpresa={totalEntradaImpresa}
        totalEntradaVirgen={totalEntradaVirgen}
        totalSalida={totalSalida}
        totalScrap={totalScrap}
        totalEntradaTurno={totalEntradaTurno}
        adhesivoEntradaRaw={lamAdhesivoEntrada}
        adhesivoSobroRaw={lamAdhesivoSobro}
        catalizadorEntradaRaw={lamCatalizadorEntrada}
        catalizadorSobroRaw={lamCatalizadorSobro}
        acetatoEntradaRaw={lamAcetatoEntrada}
        acetatoSobroRaw={lamAcetatoSobro}
        adhesivoConsumido={adhesivoConsumido}
        catalizadorConsumido={catalizadorConsumido}
        acetatoConsumido={acetatoConsumido}
        devolucionBuenaRaw={readNumberString(form.lamDevolucionBuenaKg)}
        devolucionRechazadaRaw={readNumberString(form.lamDevolucionRechazadaBobinas)}
        devolucionRechazadaMotivoRaw={readString(form.lamDevolucionRechazadaMotivo)}
        devolucionRechazadaKg={devolucionRechazadaKg}
        devolucionesPendienteAlmacen={lamWarehouseReturn.devolucionesPendienteAlmacen}
        warehouseReturn={lamWarehouseReturn.warehouseReturnPanelProps}
        checklistOpen={checklistOpen}
        checklistCheckedIds={checklistCheckedIds}
        checklistEstado={(readString(form.lamChecklistEstado) as LamChecklistEstado) || ""}
        checklistObs={readString(form.lamChecklistObs)}
        checklistElaborado={readString(form.lamChecklistElaborado)}
        checklistRevisado={readString(form.lamChecklistRevisado)}
        checklistAprobadoPor={readString(form.lamChecklistAprobadoPor)}
        onChecklistOpenChange={setChecklistOpen}
        onChecklistToggleItem={(id, checked) => {
          setForm((prev) => {
            const cur = parseLamChecklistChecked(prev.lamChecklistChecked)
            const next = checked ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)
            return { ...prev, lamChecklistChecked: next }
          })
        }}
        onChecklistEstado={(v) => setForm((prev) => ({ ...prev, lamChecklistEstado: v }))}
        onChecklistObs={(v) => setForm((prev) => ({ ...prev, lamChecklistObs: v }))}
        onChecklistElaborado={(v) => setForm((prev) => ({ ...prev, lamChecklistElaborado: v }))}
        onChecklistRevisado={(v) => setForm((prev) => ({ ...prev, lamChecklistRevisado: v }))}
        onChecklistAprobadoPor={(v) => setForm((prev) => ({ ...prev, lamChecklistAprobadoPor: v }))}
        scrapTransparenteRaw={readNumberString(form.lamScrapTransparenteKg)}
        scrapImpresoRaw={readNumberString(form.lamScrapImpresoKg)}
        scrapLaminadoRaw={readNumberString(form.lamScrapLaminadoKg)}
        scrapImpresoDestinoRaw={readString(form.lamScrapImpresoDestino) || "bopp"}
        scrapLaminadoDestinoRaw={readString(form.lamScrapLaminadoDestino) || "bopp"}
        onSetScrapImpresoDestino={(v) =>
          setForm((prev) => ({ ...prev, lamScrapImpresoDestino: v }))
        }
        onSetScrapLaminadoDestino={(v) =>
          setForm((prev) => ({ ...prev, lamScrapLaminadoDestino: v }))
        }
        mermaCalc={mermaCalc}
        refilPct={refilPct}
        onEntradaImpresaChange={(idx, v) => patchBobinaKg("entradaImpresaBobinasKg", idx, v)}
        onEntradaVirgenChange={(idx, v) => patchBobinaKg("entradaVirgenBobinasKg", idx, v)}
        onSalidaChange={(idx, v) => patchBobinaKg("salidaBobinasKg", idx, v)}
        onOpenImpresaLabel={(idx) => openLabelEditor("impresa", idx)}
        onOpenVirgenLabel={(idx) => openLabelEditor("virgen", idx)}
        onOpenSalidaLabel={(idx) => openLabelEditor("salida", idx)}
        onSetAdhesivoEntrada={(v) =>
          patchActiveTurn((t) => ({ ...t, adhesivoEntradaKg: sanitizePositiveDecimalInput(v, 3) }))
        }
        onSetAdhesivoSobro={(v) =>
          patchActiveTurn((t) => ({ ...t, adhesivoSobroKg: sanitizePositiveDecimalInput(v, 3) }))
        }
        onSetCatalizadorEntrada={(v) =>
          patchActiveTurn((t) => ({ ...t, catalizadorEntradaKg: sanitizePositiveDecimalInput(v, 3) }))
        }
        onSetCatalizadorSobro={(v) =>
          patchActiveTurn((t) => ({ ...t, catalizadorSobroKg: sanitizePositiveDecimalInput(v, 3) }))
        }
        onSetAcetatoEntrada={(v) =>
          patchActiveTurn((t) => ({ ...t, acetatoEntradaLt: sanitizePositiveDecimalInput(v, 3) }))
        }
        onSetAcetatoSobro={(v) =>
          patchActiveTurn((t) => ({ ...t, acetatoSobroLt: sanitizePositiveDecimalInput(v, 3) }))
        }
        onSetDevolucionBuena={(v) => setForm((prev) => ({ ...prev, lamDevolucionBuenaKg: v }))}
        onSetDevolucionRechazada={(v) => {
          const raw = String(v ?? "").trim().replace(",", ".")
          const n = raw === "" ? 0 : Number(raw)
          const rechZero = !Number.isFinite(n) || n <= 0
          const bobinas = rechZero ? "" : String(Math.max(0, Math.floor(n)))
          setForm((prev) => ({
            ...prev,
            lamDevolucionRechazadaKg: "",
            lamDevolucionRechazadaBobinas: bobinas,
            lamDevolucionRechazadaMotivo: rechZero ? "" : readString(prev.lamDevolucionRechazadaMotivo),
          }))
        }}
        devolucionRechazada={devolucionRechazadaBobinas}
        onSetScrapTransparente={(v) => patchActiveTurn((t) => ({ ...t, scrapTransparenteKg: v }))}
        onSetScrapImpreso={(v) => patchActiveTurn((t) => ({ ...t, scrapImpresoKg: v }))}
        onSetScrapLaminado={(v) => patchActiveTurn((t) => ({ ...t, scrapLaminadoKg: v }))}
        labelEditorOpen={labelEditorOpen}
        labelEditorMode={labelEditorMode}
        labelEditorIndex={labelEditorIndex}
        labelEditorDraft={labelEditorDraft}
        labelEditorError={labelEditorError}
        onLabelOpenChange={(open) => {
          setLabelEditorOpen(open)
          if (!open) setLabelEditorError("")
        }}
        onLabelDraftChange={updateLabelDraft}
        onLabelClear={clearLabelEditor}
        onLabelSave={saveLabelEditor}
        formatTimerHms={formatTimerHms}
        setPauseReason={setPauseReason}
        setPauseObs={setPauseObs}
        confirmPauseAndResume={confirmPauseAndResume}
        hasActiveTurno={hasActiveTurno}
        areaFinalizada={areaFinalizada}
        readOnlyOps={controlReadOnly}
        canFinalizeOrder={canFinalizeOrder}
        draftTurno={draftTurno}
        draftGrupo={draftGrupo}
        draftPeople={draftPeople}
        draftOperadorMissing={draftOperadorMissing}
        draftStagingName={draftStaging.name}
        draftStagingRole={draftStaging.role}
        onDraftTurno={setDraftTurno}
        onDraftGrupo={setDraftGrupo}
        onDraftStagingName={onDraftStagingName}
        onDraftStagingRole={onDraftStagingRole}
        onDraftPersonGuardar={guardarDraftPerson}
        onDraftPersonRemove={removeDraftPerson}
        onIniciarTurno={requestIniciarTurno}
        onCerrarTurnoActual={requestCerrarTurnoActual}
        onFinalizarAreaLaminacion={requestFinalizarAreaLaminacion}
        closedTurnos={closedTurnos}
        onSetTurno={(v) => patchActiveTurn((t) => ({ ...t, turno: v }))}
        onSetGrupo={(v) => patchActiveTurn((t) => ({ ...t, grupo: v }))}
        onActivePersonnelApply={(people) => {
          const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
          patchActiveTurn((t) => ({ ...t, operador, ayudante, supervisor }))
        }}
        onSetMetraje={(v) => patchActiveTurn((t) => ({ ...t, metrajeProduccion: v }))}
        canPreviewTimerReport={canPreviewTimerReport}
        onPreviewTimerReport={requestOpenTimerReportPreview}
        canPreviewPlanillaReport={canPreviewPlanillaReport}
        onPreviewPlanillaReport={openPlanillaPreview}
        simplifiedTimerActions
      />

      {(() => {
        const doneObs = !!readString(form.lamObservaciones).trim()
        return (
          <MesSectionShell
            title={
              <span className="inline-flex items-center gap-2">
                <NotebookPen className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Observaciones del turno
              </span>
            }
            subtle
            headerRight={
              doneObs ? (
                <div className="mes-badge-done">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Completo
                </div>
              ) : null
            }
          >
            <Textarea
              id={lamObsTextareaId}
              name="lamObservaciones"
              aria-label="Observaciones del turno"
              value={readString(form.lamObservaciones)}
              onChange={(e) => {
                if (!hasActiveTurno || controlReadOnly) return
                patchActiveTurn((t) => ({ ...t, observaciones: e.target.value }))
              }}
              placeholder={
                hasActiveTurno
                  ? "Observaciones adicionales..."
                  : "Inicie un turno para registrar observaciones."
              }
              disabled={controlReadOnly || !hasActiveTurno}
            />
          </MesSectionShell>
        )
      })()}

      <div className="no-print mb-12 flex flex-col items-center gap-2">
        {guardarHint ? (
          <p className="max-w-md text-center text-xs text-muted-foreground">{guardarHint}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={() => void guardar()} disabled={saving || !canClickGuardar}>
            <Save className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {timerConfirm ? (
        <MesLaminacionConfirmDialog
          tone={getMesTimerConfirm("laminacion")[timerConfirm].tone}
          open
          onOpenChange={(open) => {
            if (!open) setTimerConfirm(null)
          }}
          icon={<CirclePlay className="h-5 w-5" aria-hidden />}
          title={getMesTimerConfirm("laminacion")[timerConfirm].title}
          description={getMesTimerConfirm("laminacion")[timerConfirm].description}
          confirmLabel={getMesTimerConfirm("laminacion")[timerConfirm].confirmLabel}
          confirmVariant={
            getMesTimerConfirm("laminacion")[timerConfirm].destructive ? "destructive" : "default"
          }
          onConfirm={() => {
            const key = timerConfirm
            setTimerConfirm(null)
            executeTimerConfirm(key)
          }}
        />
      ) : null}

      <MesLaminacionConfirmDialog
        tone="violet"
        open={previewTimerConfirmOpen}
        onOpenChange={setPreviewTimerConfirmOpen}
        icon={<FileSearch className="h-5 w-5" aria-hidden />}
        title="Vista previa del cronómetro"
        description="Se abrirá una pestaña nueva con el reporte de tiempos y pausas registrados hasta este momento."
        confirmLabel="Abrir vista previa"
        onConfirm={() => confirmOpenTimerReportPreview()}
      />

      <MesLaminacionConfirmDialog
        tone="violet"
        open={takeoverConfirmOpen}
        onOpenChange={setTakeoverConfirmOpen}
        icon={<Users className="h-5 w-5" aria-hidden />}
        title="Tomar control del turno"
        description={
          <>
            Este turno está siendo gestionado por{" "}
            <span className="font-semibold text-foreground">{activeOwnerName ?? "otro usuario"}</span>. ¿Desea tomar
            el control para editar?
          </>
        }
        confirmLabel="Tomar control"
        onConfirm={() => confirmTakeover()}
      />

      <MesLaminacionConfirmDialog
        tone="rose"
        open={closeTurnConfirmOpen}
        onOpenChange={setCloseTurnConfirmOpen}
        icon={<LogOut className="h-5 w-5" aria-hidden />}
        title="Cerrar turno"
        description="Se cerrará el registro de turno de planta en curso y se consolidará el cronómetro en el historial. Podrá abrir otro turno de planta después. ¿Confirma el cierre?"
        confirmLabel="Sí, cerrar turno"
        onConfirm={() => confirmCloseTurnFirstStep()}
      />

      <MesLaminacionConfirmDialog
        tone="red"
        open={finalizeOtConfirmOpen}
        onOpenChange={setFinalizeOtConfirmOpen}
        icon={<Flag className="h-5 w-5" aria-hidden />}
        title="Finalizar área de laminacion (OT)"
        description="Marcará el área de laminacion como finalizada en la orden. Revise que los datos del turno estén completos antes de continuar."
        confirmLabel="Sí, finalizar área"
        confirmVariant="destructive"
        onConfirm={() => confirmFinalizarAreaLaminacion()}
      />

      <MesLaminacionConfirmDialog
        tone="orange"
        open={emptyShiftCloseDialogOpen}
        onOpenChange={(open) => {
          setEmptyShiftCloseDialogOpen(open)
          if (!open) pendingEmptyShiftCloseRef.current = null
        }}
        icon={<AlertCircle className="h-5 w-5" aria-hidden />}
        title="Cerrar turno sin actividad"
        description="El turno no registra tiempo efectivo ni producción. ¿Desea cerrarlo igual?"
        confirmLabel="Sí, cerrar igual"
        onConfirm={() => confirmEmptyShiftClose()}
      />

      <MesLaminacionConfirmDialog
        tone="indigo"
        open={startTurnConfirmOpen}
        onOpenChange={setStartTurnConfirmOpen}
        icon={<Sparkles className="h-5 w-5" aria-hidden />}
        title="Abrir turno de planta (registro)"
        description="Confirme para abrir el registro de turno de planta (Diurno/Nocturno y grupo), habilitar el cronómetro y el resumen operativo del turno en curso."
        confirmLabel="Confirmar e iniciar"
        onConfirm={() => confirmIniciarTurno()}
      />

    </div>
  )
}
