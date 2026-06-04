"use client"

import { createElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { MesOperativoEstadoCard, MesSectionShell } from "@/components/axones/mes"
import { apiFetch, ApiError } from "@/lib/api"
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
import WorkOrderMontajeOpsSection, {
  type DraftPerson,
  type DraftPersonRole,
  stringsFromActivePersonnel,
} from "./WorkOrderMontajeOpsSection"
import WorkOrderMontajeClicheMaterialSection from "./WorkOrderMontajeClicheMaterialSection"
import {
  clearMontajeTurnCaptureFormKeys,
  MON_CILINDRO_KEY,
  MON_CLICHE_KEY,
  MON_CODIGO_KEY,
  MON_COLOR_KEY,
  MON_FILAS_EXTRA_KEY,
  MON_MATERIALES_KEY,
  MON_MATERIALES_MONTAJE_KEY,
  MON_STICKY_BACK_KEY,
  montajeFilasExtraForSave,
  montajeMaterialesForSave,
  readMontajeFilasExtraState,
  readMontajeMaterialesState,
  type MontajeFilaMontaje,
  type MontajeMaterialFila,
} from "./montaje-cliche-material"
import { showAxonesSuccessSwal } from "@/lib/axones-success-swal"
import {
  deriveMontajeOperativoEstado,
  MONTAJE_CONTROL_SAVED_EVENT,
} from "@/lib/montaje-mes-band-status"
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
  canSaveProductionAreaForm,
  hasProductionTimerStarted,
  mesTimerFieldsFromForm,
  MES_PRODUCTION_SAVE_CONFIG,
  MES_SAVE_BLOCKED_MESSAGE,
} from "@/lib/mes-timer-guards"
import {
  MON_ACTUAL_KEY,
  MON_ESTADO_KEY,
  MON_PAUSE_REASONS,
  MON_TURNOS_KEY,
  accumulateMontajeFromJson,
  bootstrapMontajeFormState,
  clearMontajeMirrorKeys,
  clearMontajeShiftMirrorKeysOnly,
  createNewMontajeTurno,
  timerToLegacyFlat,
  finalizeTurnTimerNow,
  formatTimerHms,
  montajeTurnoToMirror,
  parseMontajeTurnoActual,
  parseMontajeTurnos,
  resolveMontajeTurnoActual,
  cumulativeArranqueSeconds,
  cumulativeDemountSeconds,
  readEstadoArea,
  sumMermaKg,
  sumProduccionKg,
  type MontajeTurnoEntry,
  type MontajeTurnTimer,
} from "./montaje-turnos"
import {
  MONTAJE_TIMER_CONFIRM,
  montajeTimerConfirmNeedsActiveTurno,
  type MontajeTimerActionFlags,
  type MontajeTimerConfirmKey,
} from "./montaje-timer-actions"
import "./work-order-planilla.css"
import {
  AlertCircle,
  CheckCircle2,
  CirclePlay,
  FileSearch,
  Flag,
  LogOut,
  NotebookPen,
  Save,
  Sparkles,
  Users,
} from "lucide-react"

import { getStoredUser } from "@/lib/auth-storage"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  product_id?: number | null
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

type MontajePauseEntry = { at: string; reason: string; obs: string; duration_sec: number }
type MontajeLastClosedSnapshot = {
  turno: "diurno" | "nocturno" | ""
  grupo: "A" | "B" | "C" | ""
  operador: string
  ayudante: string
  supervisor: string
  observaciones: string
  numCliche: string
  numCilindro: string
  filasExtra: MontajeFilaMontaje[]
  materialesMontaje: MontajeMaterialFila[]
}

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

function parseLastClosedSnapshot(raw: unknown): MontajeLastClosedSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const turnoRaw = readString(o.turno).toLowerCase()
  const grupoRaw = readString(o.grupo).toUpperCase()
  const turno: MontajeLastClosedSnapshot["turno"] =
    turnoRaw === "diurno" || turnoRaw === "nocturno" ? (turnoRaw as "diurno" | "nocturno") : ""
  const grupo: MontajeLastClosedSnapshot["grupo"] =
    grupoRaw === "A" || grupoRaw === "B" || grupoRaw === "C" ? (grupoRaw as "A" | "B" | "C") : ""
  return {
    turno,
    grupo,
    operador: readString(o.operador),
    ayudante: readString(o.ayudante),
    supervisor: readString(o.supervisor),
    observaciones: readString(o.observaciones),
    numCliche: readString(o.numCliche),
    numCilindro: (() => {
      const leg = readString(o.numCilindro)
      if (leg) return leg
      if (Array.isArray(o.cilindros) && o.cilindros.length > 0) {
        return readString(o.cilindros[0])
      }
      return ""
    })(),
    filasExtra: Array.isArray(o.filasExtra)
      ? readMontajeFilasExtraState(o.filasExtra)
      : readMontajeFilasExtraState(undefined, o.clichesAdicionales, o.cilindrosAdicionales),
    materialesMontaje: Array.isArray(o.materialesMontaje)
      ? readMontajeMaterialesState(o.materialesMontaje)
      : readMontajeMaterialesState(
          undefined,
          o.stickyBack,
          o.codigo,
          o.color,
          o.materialesUsados,
        ),
  }
}

const MON_LAST_CLOSED_SNAPSHOT_KEY = "montLastClosedSnapshot"
const LEGACY_MONTAJE_DRAFT_KEY = "axones.montaje.control.draft."

/** Tonos visuales para confirmaciones del panel de montaje (alineados a cada acción). */
type MesMontajeConfirmTone =
  | "emerald"
  | "sky"
  | "indigo"
  | "violet"
  | "amber"
  | "orange"
  | "rose"
  | "red"

const MES_MONTAJE_CONFIRM: Record<MesMontajeConfirmTone, { panel: string; iconBox: string }> = {
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

type MesMontajeConfirmDialogProps = {
  tone: MesMontajeConfirmTone
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  confirmVariant?: "default" | "destructive"
}

function MesMontajeConfirmDialog(props: MesMontajeConfirmDialogProps) {
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

type MesMontajeGuardarChoiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  canFinalizeArea: boolean
  hasActiveTurno: boolean
  betweenShiftsMode: boolean
  onGuardarSesion: () => void
  onFinalizarTurno: () => void
  onFinalizarArea: () => void
}

function MesMontajeGuardarChoiceDialog(props: MesMontajeGuardarChoiceDialogProps) {
  const skin = MES_MONTAJE_CONFIRM.violet
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="gap-5 border-slate-200 bg-white sm:max-w-lg dark:border-slate-700 dark:bg-slate-950">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-start gap-3">
            <div className={skin.iconBox}>
              <Save className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Guardar en el sistema</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {props.betweenShiftsMode ? (
                  <>
                    Está <span className="font-semibold text-foreground">entre turnos</span> (sin cuadrilla activa).
                    Confirme el registro en servidor o cierre el área Montaje si la OT terminó.
                  </>
                ) : (
                  <>
                    Turno de planta en curso. Al terminar la jornada, elija si cierra el turno o finaliza el área
                    Montaje en el sistema.
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/80">
          <p className="font-medium text-slate-900 dark:text-slate-100">¿Qué desea hacer?</p>
          <ul className="list-none space-y-2.5 text-slate-600 dark:text-slate-300">
            <li className="flex gap-2">
              <LogOut className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              <span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Finalizar turno</span>
                {" — "}
                {props.betweenShiftsMode
                  ? "Sincroniza tiempos, kg, mermas y datos de cliché/material acumulados."
                  : "Cierra el turno de planta en curso y guarda arranque, producción y material."}
              </span>
            </li>
            {props.canFinalizeArea ? (
              <li className="flex gap-2">
                <Flag className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                <span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Finalizar cierre</span>
                  {" — "}
                  Marca el área Montaje como finalizada en la OT y mueve la orden a Historial.
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        <DialogFooter className="!flex-row flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!props.betweenShiftsMode && !props.hasActiveTurno}
            onClick={() => {
              props.onOpenChange(false)
              if (props.betweenShiftsMode) {
                props.onGuardarSesion()
              } else {
                props.onFinalizarTurno()
              }
            }}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Finalizar turno
          </Button>
          {props.canFinalizeArea ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                props.onOpenChange(false)
                props.onFinalizarArea()
              }}
            >
              <Flag className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Finalizar cierre
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const MES_MONTAJE_WARNING_TOAST_CLASSNAMES = {
  toast:
    "!border !border-amber-200 !bg-white !text-slate-900 shadow-md [&_[data-description]]:!text-slate-600",
  title: "!text-slate-900 text-sm font-medium",
  warning: "!bg-white !border-amber-200 !text-slate-900",
  description: "!text-slate-600 text-sm leading-snug",
  icon: "text-amber-600",
} as const

function mesMontajeSwalSuccess(message: string) {
  void showAxonesSuccessSwal(message)
}

/** Texto del modal «Guardado» según estado MES y permisos. */
function montajeGuardadoSwalContent(
  formSnapshot: Record<string, unknown>,
  canFinalizeArea: boolean,
): { text?: string; html?: string } {
  const op = deriveMontajeOperativoEstado(formSnapshot)
  const wf = op.workflow

  if (wf === "entre_turnos") {
    const finalizeAreaLine = canFinalizeArea
      ? `<li><span class="font-semibold">Finalizar cierre</span>: si ya no queda montaje en esta OT, pulse <span class="font-semibold">Guardar</span> y elija esta opción.</li>`
      : `<li><span class="font-semibold">Finalizar cierre</span>: avise a jefatura cuando el montaje de la OT esté completo.</li>`
    return {
      html: `<p class="text-sm leading-relaxed">Estado: <span class="font-semibold">Entre turnos</span> — datos guardados en el servidor.</p>
<p class="mt-3 text-sm font-semibold">Próximo paso</p>
<ul class="mt-1 list-disc space-y-2 pl-5 text-left text-sm leading-relaxed">
<li><span class="font-semibold">Finalizar turno</span> (siguiente cuadrilla): abra un <span class="font-semibold">turno nuevo</span> arriba; al terminar la jornada, <span class="font-semibold">Guardar → Finalizar turno</span>.</li>
${finalizeAreaLine}
</ul>`,
    }
  }

  if (wf === "turno_abierto") {
    const finalizeAreaHint = canFinalizeArea
      ? ' o <span class="font-semibold">Finalizar cierre</span>'
      : ""
    return {
      html: `<p class="text-sm leading-relaxed">Turno de planta abierto. Inicie el cronómetro (play) para registrar tiempos.</p>
<p class="mt-2 text-sm leading-relaxed">Al terminar la jornada: <span class="font-semibold">Guardar → Finalizar turno</span>${finalizeAreaHint}.</p>`,
    }
  }

  const text = op.title.trim()
  return text ? { text } : {}
}

/** Modal breve: título + detalle opcional (estado en bandeja). */
function mesMontajeSwalWithBandeja(
  formSnapshot: Record<string, unknown>,
  title: string,
  detail?: string,
  canFinalizeArea = false,
) {
  if (detail?.trim()) {
    void showAxonesSuccessSwal(title, detail.trim())
    return
  }
  if (title === "Guardado") {
    const content = montajeGuardadoSwalContent(formSnapshot, canFinalizeArea)
    void showAxonesSuccessSwal(title, content.text, { html: content.html })
    return
  }
  const op = deriveMontajeOperativoEstado(formSnapshot)
  const text = op.title.trim()
  void showAxonesSuccessSwal(title, text && text !== title ? text : undefined)
}

function mesMontajeToastWarning(message: string) {
  toast.warning(message, {
    richColors: false,
    classNames: MES_MONTAJE_WARNING_TOAST_CLASSNAMES,
    icon: createElement(AlertCircle, { className: "h-4 w-4 shrink-0 text-amber-600", "aria-hidden": true }),
  })
}

function purgeLegacyMontajeDraft(workOrderId: number) {
  try {
    localStorage.removeItem(`${LEGACY_MONTAJE_DRAFT_KEY}${workOrderId}`)
  } catch {
    // ignore
  }
}

function clearMontajeBrowserCache(workOrderId: number) {
  purgeLegacyMontajeDraft(workOrderId)
  try {
    localStorage.removeItem(`axones.montaje.timer-preview.${workOrderId}`)
  } catch {
    // ignore
  }
}

function mergePrefill(prefill: Record<string, unknown>, form?: Record<string, unknown> | null) {
  return { ...prefill, ...(form ?? {}) }
}

export default function WorkOrderMontajeControlPanel({
  workOrderId,
  canFinalizeOrder = false,
}: {
  workOrderId: number
  /** Solo jefe/admin puede finalizar el área de montaje (montEstadoArea). */
  canFinalizeOrder?: boolean
}) {
  const montObsTextareaId = useId().replace(/:/g, "")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastServerSaveAt, setLastServerSaveAt] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})

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

  const draftOperadoresLabel = useMemo(() => {
    const names = draftPeople
      .filter((p) => p.role === "operador")
      .map((p) => p.name.trim())
      .filter(Boolean)
    return names.join("; ")
  }, [draftPeople])
  const draftSupervisoresLabel = useMemo(() => {
    const names = draftPeople
      .filter((p) => p.role === "supervisor")
      .map((p) => p.name.trim())
      .filter(Boolean)
    return names.join("; ")
  }, [draftPeople])
  const draftAyudantesLabel = useMemo(() => {
    const names = draftPeople
      .filter((p) => p.role === "ayudante")
      .map((p) => p.name.trim())
      .filter(Boolean)
    return names.join("; ")
  }, [draftPeople])
  const draftOperadorMissing = useMemo(() => !draftOperadoresLabel, [draftOperadoresLabel])

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
      const boot = bootstrapMontajeFormState(mergedForm)
      const areaEstado = readEstadoArea(boot[MON_ESTADO_KEY])
      purgeLegacyMontajeDraft(workOrderId)
      setForm(boot)
      if (areaEstado === "finalizada") {
        try {
          localStorage.removeItem(`axones.montaje.timer-preview.${workOrderId}`)
        } catch {
          // ignore
        }
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT para montaje.")
      setPrefill({})
      setForm({})
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  const closedTurnos = useMemo(() => parseMontajeTurnos(form[MON_TURNOS_KEY]), [form])
  const activeTurno = useMemo(() => resolveMontajeTurnoActual(form), [form])
  const areaEstado = readEstadoArea(form[MON_ESTADO_KEY])
  const areaFinalizada = areaEstado === "finalizada"
  const readOnlyOps = areaFinalizada && !canFinalizeOrder

  const montajeFilasExtra = useMemo(
    () =>
      readMontajeFilasExtraState(
        form[MON_FILAS_EXTRA_KEY],
        form.montClichesAdicionales,
        form.montCilindrosAdicionales,
      ),
    [form],
  )
  const montajeMateriales = useMemo(
    () =>
      readMontajeMaterialesState(
        form[MON_MATERIALES_MONTAJE_KEY],
        form[MON_STICKY_BACK_KEY],
        form[MON_CODIGO_KEY],
        form[MON_COLOR_KEY],
        form[MON_MATERIALES_KEY],
      ),
    [form],
  )
  const hasActiveTurno = activeTurno !== null
  const lastClosedTurno = useMemo(
    () => (closedTurnos.length > 0 ? closedTurnos[closedTurnos.length - 1] : null),
    [closedTurnos],
  )
  const lastClosedSnapshot = useMemo(
    () => parseLastClosedSnapshot(form[MON_LAST_CLOSED_SNAPSHOT_KEY]),
    [form],
  )
  const visibleNumCliche = hasActiveTurno
    ? readString(form[MON_CLICHE_KEY])
    : (lastClosedSnapshot?.numCliche ?? readString(form[MON_CLICHE_KEY]))
  const visibleNumCilindro = hasActiveTurno
    ? readString(form[MON_CILINDRO_KEY])
    : (lastClosedSnapshot?.numCilindro ?? readString(form[MON_CILINDRO_KEY]))
  const visibleFilasExtra = hasActiveTurno
    ? montajeFilasExtra
    : (lastClosedSnapshot?.filasExtra.length ? lastClosedSnapshot.filasExtra : montajeFilasExtra)
  const visibleMaterialesMontaje = hasActiveTurno
    ? montajeMateriales
    : lastClosedSnapshot?.materialesMontaje.length
      ? lastClosedSnapshot.materialesMontaje
      : montajeMateriales
  const visibleObsTurno = hasActiveTurno
    ? readString(form.montObservaciones)
    : (lastClosedSnapshot?.observaciones ?? readString(form.montObservaciones))
  const jsonAccum = useMemo(
    () => accumulateMontajeFromJson(closedTurnos, activeTurno),
    [closedTurnos, activeTurno],
  )

  const patchActiveTurn = useCallback((updater: (t: MontajeTurnoEntry) => MontajeTurnoEntry) => {
    setForm((prev) => {
      const cur = parseMontajeTurnoActual(prev[MON_ACTUAL_KEY])
      if (!cur) return prev
      const nextTurn = updater(cur)
      return {
        ...prev,
        [MON_ACTUAL_KEY]: nextTurn,
        ...montajeTurnoToMirror(nextTurn),
      }
    })
  }, [])

  const pedidoTotalKg = readNumber(form.pedidoKg ?? prefill.pedidoKg)
  const producidoAcumuladoKg =
    readNumber(form.montAcumuladoProducidoKg) > 0
      ? readNumber(form.montAcumuladoProducidoKg)
      : jsonAccum.producidoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = jsonAccum.turnosRegistrados
  const totalProduccionAcumulada = jsonAccum.producidoKg
  const totalMermaAcumulada =
    closedTurnos.reduce((a, t) => a + sumMermaKg(t), 0) +
    (activeTurno ? sumMermaKg(activeTurno) : 0)
  const ultimoTurnoLabel = hasActiveTurno ? "Turno en curso" : jsonAccum.ultimoCierreLabel

  const [timerTick, setTimerTick] = useState(0)
  const [pauseReason, setPauseReason] = useState("")
  const [pauseObs, setPauseObs] = useState("")
  const [startTurnConfirmOpen, setStartTurnConfirmOpen] = useState(false)
  const [timerConfirm, setTimerConfirm] = useState<MontajeTimerConfirmKey | null>(null)
  const [takeoverConfirmOpen, setTakeoverConfirmOpen] = useState(false)
  const [previewTimerConfirmOpen, setPreviewTimerConfirmOpen] = useState(false)
  const [guardarChoiceOpen, setGuardarChoiceOpen] = useState(false)
  const [closeTurnConfirmOpen, setCloseTurnConfirmOpen] = useState(false)
  const [finalizeOtConfirmOpen, setFinalizeOtConfirmOpen] = useState(false)
  const [emptyShiftCloseDialogOpen, setEmptyShiftCloseDialogOpen] = useState(false)
  const pendingEmptyShiftCloseRef = useRef<{
    cur: MontajeTurnoEntry
    finalizedTimer: MontajeTurnTimer
  } | null>(null)
  const canFinalizeOrderRef = useRef(canFinalizeOrder)
  canFinalizeOrderRef.current = canFinalizeOrder
  const pauseReasons = MON_PAUSE_REASONS

  const pauseEntries = useMemo<MontajePauseEntry[]>(() => {
    const raw = form.montTimerPauses
    if (!Array.isArray(raw)) return []
    return raw
      .map((x) => x as Partial<MontajePauseEntry>)
      .map((x) => ({
        at: readString(x.at),
        reason: readString(x.reason),
        obs: readString(x.obs),
        duration_sec: readNumber(x.duration_sec),
      }))
      .filter((x) => x.reason)
  }, [form.montTimerPauses])

  const timerState = readString(form.montTimerState) || "pending"
  const arranqueState = readString(form.montTimerArranqueState) || "idle"
  const montajeOpState = readString(form.montTimerMontajeOpState) || "idle"
  const demountState = readString(form.montTimerDemountState) || "idle"
  const arranqueRunning = arranqueState === "running"
  const montajeOpRunning = montajeOpState === "running"
  const demountRunning = demountState === "running"
  const timerRunning = timerState === "running"
  const timerPaused = timerState === "paused"
  const effectiveAcc = readNumber(form.montTimerEffectiveAccSec)
  const deadAcc = readNumber(form.montTimerDeadAccSec)
  const lastResumeAt = readNumber(form.montTimerLastResumeAtMs)
  const pauseAt = readNumber(form.montTimerPauseAtMs)
  const nowMs = Date.now() + timerTick * 0

  const operativoEstado = useMemo(
    () => deriveMontajeOperativoEstado(form, nowMs),
    [form, timerTick],
  )

  const shiftEffectiveSec =
    effectiveAcc + (timerRunning && lastResumeAt > 0 ? (nowMs - lastResumeAt) / 1000 : 0)
  const pauseAwaitingMotive = timerPaused && pauseAt > 0 && pauseEntries.length === 0
  const shiftDeadSec = deadAcc + (pauseAwaitingMotive ? (nowMs - pauseAt) / 1000 : 0)
  const shiftTotalSec = shiftEffectiveSec + shiftDeadSec
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
  const otArranqueAccSec = useMemo(
    () => cumulativeArranqueSeconds(closedTurnos, activeTurno, nowMs),
    [closedTurnos, activeTurno, timerTick],
  )
  /** Cronómetro visible: acumulado OT (todos los turnos), alineado con la bandeja Montaje. */
  const displayEffectiveSec = otEffectiveAccSec
  const displayDeadSec = otDeadAccSec
  const displayTotalSec = otTotalAccSec
  const displayDemountSec = otDemountAccSec
  const displayArranqueSec = otArranqueAccSec
  const kgProduccionTurno = activeTurno
    ? sumProduccionKg(activeTurno)
    : readNumber(form.montKgProduccion)
  /** Kg/Hora usa acumulado OT cuando el cronómetro muestra tiempos de todos los turnos. */
  const kgForKgHora =
    closedTurnos.length > 0 || hasActiveTurno
      ? totalProduccionAcumulada
      : kgProduccionTurno
  const kgHora =
    displayEffectiveSec > 0.01
      ? (kgForKgHora / (displayEffectiveSec / 3600)).toFixed(2)
      : "0.00"
  const displayHoraArranque = useMemo(() => {
    if (!activeTurno) return "—"
    const t = activeTurno.timer
    if (t.arranqueStartedAtMs > 0) {
      return formatHoraArranqueFromMs(t.arranqueStartedAtMs)
    }
    return formatHoraArranqueFromMs(horaArranqueMsFromTimer(t))
  }, [activeTurno])

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

  const timerEverStarted = useMemo(() => {
    if (hasProductionTimerStarted(mesTimerFieldsFromForm(form, "mont"))) return true
    const t = activeTurno?.timer
    if (!t) {
      return (
        readNumber(form.montTimerArranqueAccSec) > 0 ||
        readNumber(form.montTimerMontajeOpAccSec) > 0 ||
        readNumber(form.montTimerDemountAccSec) > 0
      )
    }
    return (
      t.arranqueAccSec > 0.01 ||
      t.arranqueState !== "idle" ||
      t.montajeOpAccSec > 0.01 ||
      t.montajeOpState !== "idle" ||
      t.demountAccSec > 0.01 ||
      t.demountState !== "idle"
    )
  }, [form, activeTurno])

  const canPreviewTimerReport = useMemo(() => {
    if (!hasActiveTurno) return false
    if (controlReadOnly) return false
    if (areaFinalizada) return false
    return timerEverStarted
  }, [hasActiveTurno, controlReadOnly, areaFinalizada, timerEverStarted])

  const timerActionFlags = useMemo((): MontajeTimerActionFlags => {
    const base = !controlReadOnly && hasActiveTurno && !areaFinalizada && timerState !== "completed"
    return {
      canStartArranque:
        base && !arranqueRunning && !montajeOpRunning && !demountRunning && !timerRunning && !timerPaused,
      canStopArranque: base && arranqueRunning,
      canStartMontajeOp:
        base && !montajeOpRunning && !arranqueRunning && !demountRunning && !timerRunning && !timerPaused,
      canStopMontajeOp: base && montajeOpRunning,
      canStartDemount:
        base && !demountRunning && !arranqueRunning && !montajeOpRunning && !timerRunning && !timerPaused,
      canStopDemount: base && demountRunning,
      canStartProduction:
        base && !timerRunning && !timerPaused && !arranqueRunning && !montajeOpRunning && !demountRunning,
      canStopProduction: base && timerRunning,
      canStartDeadTime: base && timerRunning,
      canEndDeadTime: base && timerPaused,
      canCerrarTurno: base,
      canFinalizarOrden: canFinalizeOrder && !areaFinalizada && (!controlReadOnly || canFinalizeOrder),
      canPreview: canPreviewTimerReport,
    }
  }, [
    areaFinalizada,
    arranqueRunning,
    canFinalizeOrder,
    canPreviewTimerReport,
    controlReadOnly,
    demountRunning,
    hasActiveTurno,
    montajeOpRunning,
    timerPaused,
    timerRunning,
    timerState,
  ])

  const canSaveProduction = useMemo(() => {
    if (controlReadOnly) return false
    return canSaveProductionAreaForm(form, MES_PRODUCTION_SAVE_CONFIG.montaje)
  }, [controlReadOnly, form])

  const canPersistShiftOpen = useMemo(() => {
    if (controlReadOnly) return false
    return hasActiveTurno
  }, [controlReadOnly, hasActiveTurno])

  const canPersistBetweenShifts = useMemo(() => {
    if (controlReadOnly || areaFinalizada) return false
    if (hasActiveTurno) return false
    return closedTurnos.length > 0
  }, [areaFinalizada, closedTurnos.length, controlReadOnly, hasActiveTurno])

  const canClickGuardar = canSaveProduction || canPersistShiftOpen || canPersistBetweenShifts

  const guardarHint = useMemo(() => {
    if (controlReadOnly) return ""
    if (hasActiveTurno && (canSaveProduction || canPersistShiftOpen)) {
      return "Al pulsar Guardar elija «Finalizar turno» o «Finalizar cierre» del área Montaje."
    }
    if (canPersistBetweenShifts) {
      return "Entre turnos: pulse Guardar y elija «Finalizar turno» (sincronizar) o «Finalizar cierre» si el montaje terminó."
    }
    if (canSaveProduction || canPersistShiftOpen) {
      return "Pulse Guardar para enviar datos al servidor."
    }
    if (!hasActiveTurno && closedTurnos.length === 0) {
      return "Inicie un turno de planta para registrar datos."
    }
    return MES_SAVE_BLOCKED_MESSAGE
  }, [
    canPersistBetweenShifts,
    canPersistShiftOpen,
    canSaveProduction,
    closedTurnos.length,
    controlReadOnly,
    hasActiveTurno,
  ])

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
    const nextTurn: MontajeTurnoEntry = {
      ...cur,
      control_owner_user_id: u.id,
      control_owner_name: u.name,
      control_taken_at: new Date().toISOString(),
    }
    patchActiveTurn(() => nextTurn)
    setTakeoverConfirmOpen(false)
    mesMontajeSwalSuccess("Control del turno asignado.")
    void persistMontajeForm(
      {
        ...form,
        [MON_ACTUAL_KEY]: nextTurn,
        ...montajeTurnoToMirror(nextTurn),
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
        turno: readString(form.montTurno),
        grupo: readString(form.montGrupo),
        operador: readString(form.montOperador),
        ayudante: readString(form.montAyudante),
        supervisor: readString(form.montSupervisor),
      },
      timer: {
        state: timerState,
        total_hms: formatTimerHms(shiftTotalSec),
        dead_hms: formatTimerHms(shiftDeadSec),
        effective_hms: formatTimerHms(shiftEffectiveSec),
        kg_hora: kgHora,
      },
      pauses: pauseEntries.map((p) => ({
        at: p.at,
        reason: p.reason,
        obs: p.obs,
        duration_hms: formatTimerHms(p.duration_sec),
      })),
    }
    try {
      localStorage.setItem(
        `axones.montaje.timer-preview.${workOrderId}`,
        JSON.stringify(payload),
      )
    } catch {
      toast.error("No se pudo guardar la vista previa en el navegador.")
      return
    }
    // Abrir dentro del sistema (SPA) bajo /axones (basename del router)
    // usando una pestaña nueva para mantener la pantalla operativa abierta.
    const url = `${window.location.origin}/axones/ordenes-trabajo/${encodeURIComponent(
      String(workOrderId),
    )}/montaje/temporizador/vista-previa`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function requestOpenTimerReportPreview() {
    if (!canPreviewTimerReport) {
      toast.error("Inicie el cronómetro para habilitar la vista previa.")
      return
    }
    setPreviewTimerConfirmOpen(true)
  }

  function confirmOpenTimerReportPreview() {
    setPreviewTimerConfirmOpen(false)
    runOpenTimerReportPreview()
  }

  function requestCerrarTurnoActual() {
    if (controlReadOnly) return
    const cur = parseMontajeTurnoActual(form[MON_ACTUAL_KEY])
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

  function requestFinalizarAreaMontaje() {
    if (!canFinalizeOrder) return
    setFinalizeOtConfirmOpen(true)
  }

  function confirmFinalizarAreaMontaje() {
    setFinalizeOtConfirmOpen(false)
    void finalizarAreaMontaje()
  }

  const MAX_KG_PRODUCCION = 50_000

  const outlierWarnings = useMemo(() => {
    const warnings: string[] = []
    if (pedidoTotalKg > 0 && producidoAcumuladoKg > pedidoTotalKg + 0.01) {
      warnings.push(
        `Producido acumulado (${producidoAcumuladoKg.toFixed(2)} Kg) supera el pedido (${pedidoTotalKg.toFixed(2)} Kg). Verifique unidades o captura.`,
      )
    }
    if (kgProduccionTurno > MAX_KG_PRODUCCION) {
      warnings.push(
        `Producción del turno elevada (${kgProduccionTurno.toFixed(2)} Kg). Verifique unidad y captura.`,
      )
    }
    return warnings
  }, [pedidoTotalKg, producidoAcumuladoKg, kgProduccionTurno])

  const persistMontajeForm = useCallback(
    async (
      srcBase?: Record<string, unknown>,
      options?: {
        skipProductionSaveGuard?: boolean
        /** Sin notificación inter-área ni validación MES completa (solo abrir turno). */
        notifyProductionSave?: boolean
        successMessage?: string
        /** Evita aviso por defecto cuando el llamador muestra SweetAlert con `mesMontajeSwalWithBandeja`. */
        suppressSuccessToast?: boolean
      },
    ) => {
      const src = srcBase ?? form
      if (!Number.isFinite(workOrderId) || workOrderId < 1) return false
      const notifyProductionSave = options?.notifyProductionSave !== false

      if (
        notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !canSaveProductionAreaForm(src, MES_PRODUCTION_SAVE_CONFIG.montaje)
      ) {
        toast.error(MES_SAVE_BLOCKED_MESSAGE)
        return false
      }

      const hasClosed = parseMontajeTurnos(src[MON_TURNOS_KEY]).length > 0
      if (
        !notifyProductionSave &&
        !options?.skipProductionSaveGuard &&
        !resolveMontajeTurnoActual(src) &&
        !hasClosed
      ) {
        toast.error("Abra un turno de planta antes de guardar.")
        return false
      }

      const act = resolveMontajeTurnoActual(src)
      if (act) {
        const operador = act.operador.trim()
        const turno = act.turno
        const grupo = act.grupo
        if (!operador || !turno || !grupo) {
          toast.error("Montaje: complete turno, grupo y operador antes de guardar.")
          return false
        }
      }

      if (outlierWarnings.length > 0) {
        mesMontajeToastWarning(`Se detectaron ${outlierWarnings.length} valores atípicos. Se guardará de todas formas.`)
      }

      const closedP = parseMontajeTurnos(src[MON_TURNOS_KEY])
      const actualP = resolveMontajeTurnoActual(src)
      const accFromJson = accumulateMontajeFromJson(closedP, actualP)

      const normalizedForm: Record<string, unknown> = {
        ...src,
        [MON_TURNOS_KEY]: closedP,
        [MON_ACTUAL_KEY]: actualP,
        [MON_ESTADO_KEY]: readEstadoArea(src[MON_ESTADO_KEY]),
        montTimerEffectiveAccSec: normalizeNumericString(src.montTimerEffectiveAccSec),
        montTimerDeadAccSec: normalizeNumericString(src.montTimerDeadAccSec),
        montRegistrosTurnos: String(accFromJson.turnosRegistrados),
        montAcumuladoProducidoKg: normalizeNumericString(accFromJson.producidoKg),
        montKgProduccion: normalizeNumericString(actualP?.kgProduccion ?? src.montKgProduccion),
        montMermaKg: normalizeNumericString(actualP?.mermaKg ?? src.montMermaKg),
        montMetraje: normalizeNumericString(actualP?.metrajeKg ?? src.montMetraje),
        [MON_CLICHE_KEY]: readString(src[MON_CLICHE_KEY]).trim(),
        [MON_CILINDRO_KEY]: readString(src[MON_CILINDRO_KEY]).trim(),
        [MON_FILAS_EXTRA_KEY]: montajeFilasExtraForSave(
          readMontajeFilasExtraState(
            src[MON_FILAS_EXTRA_KEY],
            src.montClichesAdicionales,
            src.montCilindrosAdicionales,
          ),
        ),
        [MON_MATERIALES_MONTAJE_KEY]: montajeMaterialesForSave(
          readMontajeMaterialesState(
            src[MON_MATERIALES_MONTAJE_KEY],
            src[MON_STICKY_BACK_KEY],
            src[MON_CODIGO_KEY],
            src[MON_COLOR_KEY],
            src[MON_MATERIALES_KEY],
          ),
        ),
        [MON_STICKY_BACK_KEY]: "",
        [MON_CODIGO_KEY]: "",
        [MON_COLOR_KEY]: "",
        montClichesAdicionales: [],
        montCilindrosAdicionales: [],
        montCilindros: [],
        montMaterialesUsados: [],
      }

      setSaving(true)
      try {
        const res = await apiFetch<{ updated_at?: string }>(`work-orders/${workOrderId}/orden-trabajo`, {
          method: "PUT",
          body: JSON.stringify({
            form: normalizedForm,
            origin_area: "montaje",
            notify_on_production_save: notifyProductionSave,
          }),
        })
        setForm(bootstrapMontajeFormState(normalizedForm))
        if (res?.updated_at) {
          setLastServerSaveAt(res.updated_at)
        }
        if (!options?.suppressSuccessToast) {
          if (options?.successMessage) {
            mesMontajeSwalSuccess(options.successMessage)
          } else {
            mesMontajeSwalWithBandeja(normalizedForm, "Guardado", undefined, canFinalizeOrderRef.current)
          }
        }
        window.dispatchEvent(
          new CustomEvent(MONTAJE_CONTROL_SAVED_EVENT, { detail: { workOrderId } }),
        )
        return true
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo guardar control de montaje.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [form, outlierWarnings.length, workOrderId],
  )

  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    if (areaFinalizada) return
    if (!timerRunning && !timerPaused && !arranqueRunning && !montajeOpRunning && !demountRunning) return
    const id = window.setInterval(() => setTimerTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [areaFinalizada, timerPaused, timerRunning, arranqueRunning, montajeOpRunning, demountRunning])

  // Auto-guardado cada 60s mientras corre el temporizador (si tengo control).
  useEffect(() => {
    if (!timerRunning && !arranqueRunning && !montajeOpRunning && !demountRunning) return
    if (controlReadOnly) return
    const id = window.setInterval(() => {
      if (controlReadOnly) return
      if (saving) return
      void persistMontajeForm(formRef.current, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        suppressSuccessToast: true,
      })
    }, 60000)
    return () => window.clearInterval(id)
  }, [timerRunning, arranqueRunning, montajeOpRunning, demountRunning, controlReadOnly, saving, persistMontajeForm])

  function persistActiveTurnSnapshot(nextTurn: MontajeTurnoEntry, successMessage?: string) {
    void persistMontajeForm(
      {
        ...form,
        [MON_ACTUAL_KEY]: nextTurn,
        ...montajeTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage,
      },
    )
  }

  function patchAndPersistTimer(
    updater: (timer: MontajeTurnTimer) => MontajeTurnTimer,
    successMessage?: string,
  ) {
    const cur = activeTurno
    if (!cur) return
    const nextTurn: MontajeTurnoEntry = { ...cur, timer: updater(cur.timer) }
    patchActiveTurn(() => nextTurn)
    persistActiveTurnSnapshot(nextTurn, successMessage)
  }

  function requestTimerConfirm(key: MontajeTimerConfirmKey) {
    if (controlReadOnly) return
    setTimerConfirm(key)
  }

  function executeTimerConfirm(key: MontajeTimerConfirmKey) {
    if (!montajeTimerConfirmNeedsActiveTurno(key)) {
      if (!canFinalizeOrder) return
      requestFinalizarAreaMontaje()
      return
    }
    switch (key) {
      case "startArranque": {
        const now = Date.now()
        patchAndPersistTimer(
          (t) => ({
            ...t,
            arranqueState: "running",
            arranqueStartedAtMs: t.arranqueStartedAtMs || now,
            arranqueLastResumeAtMs: now,
          }),
          "Arranque iniciado.",
        )
        break
      }
      case "stopArranque": {
        const now = Date.now()
        patchAndPersistTimer((t) => {
          const last = t.arranqueLastResumeAtMs
          return {
            ...t,
            arranqueState: "stopped",
            arranqueAccSec: t.arranqueAccSec + (last > 0 ? (now - last) / 1000 : 0),
            arranqueLastResumeAtMs: 0,
          }
        }, "Arranque detenido.")
        break
      }
      case "startMontajeOp": {
        const now = Date.now()
        patchAndPersistTimer(
          (t) => ({
            ...t,
            montajeOpState: "running",
            montajeOpStartedAtMs: t.montajeOpStartedAtMs || now,
            montajeOpLastResumeAtMs: now,
          }),
          "Montaje (operación) iniciado.",
        )
        break
      }
      case "stopMontajeOp": {
        const now = Date.now()
        patchAndPersistTimer((t) => {
          const last = t.montajeOpLastResumeAtMs
          return {
            ...t,
            montajeOpState: "stopped",
            montajeOpAccSec: t.montajeOpAccSec + (last > 0 ? (now - last) / 1000 : 0),
            montajeOpLastResumeAtMs: 0,
          }
        }, "Montaje (operación) finalizado.")
        break
      }
      case "startDemount": {
        const now = Date.now()
        patchAndPersistTimer(
          (t) => ({
            ...t,
            demountState: "running",
            demountStartedAtMs: t.demountStartedAtMs || now,
            demountLastResumeAtMs: now,
          }),
          "Desmontaje iniciado.",
        )
        break
      }
      case "stopDemount": {
        const now = Date.now()
        patchAndPersistTimer((t) => {
          const last = t.demountLastResumeAtMs
          return {
            ...t,
            demountState: "stopped",
            demountAccSec: t.demountAccSec + (last > 0 ? (now - last) / 1000 : 0),
            demountLastResumeAtMs: 0,
          }
        }, "Desmontaje finalizado.")
        break
      }
      case "startProduction":
        confirmStartProductionTimer()
        break
      case "stopProduction": {
        const now = Date.now()
        patchAndPersistTimer((t) => {
          if (t.state !== "running") return t
          const last = t.lastResumeAtMs
          return {
            ...t,
            state: "pending",
            effectiveAccSec: t.effectiveAccSec + (last > 0 ? (now - last) / 1000 : 0),
            lastResumeAtMs: 0,
            pauseAtMs: 0,
          }
        }, "Producción detenida.")
        break
      }
      case "startDeadTime":
        executePauseProductionTimer()
        break
      case "endDeadTime":
        confirmResumeProductionAfterDeadTime()
        break
      case "cerrarTurno": {
        const cur = activeTurno
        if (!cur?.operador.trim() || !cur.turno || !cur.grupo) {
          toast.error("Complete turno, grupo y operador.")
          return
        }
        cerrarTurnoActual()
        break
      }
      default:
        break
    }
  }

  function confirmStartProductionTimer() {
    if (!hasActiveTurno || controlReadOnly) return
    const now = Date.now()
    const cur = activeTurno
    if (!cur) return
    const nextTurn: MontajeTurnoEntry = {
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
    void persistMontajeForm(
      {
        ...form,
        [MON_ACTUAL_KEY]: nextTurn,
        ...montajeTurnoToMirror(nextTurn),
      },
      {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        successMessage: "Producción iniciada y guardada.",
      },
    ).then(() => tryAdvanceBoardStageToMontaje())
  }

  function confirmResumeProductionAfterDeadTime() {
    if (!hasActiveTurno || controlReadOnly || !timerPaused) return
    const now = Date.now()
    const cur = activeTurno
    if (!cur) return
    const nextTurn: MontajeTurnoEntry = {
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
    void persistMontajeForm(
      {
        ...form,
        [MON_ACTUAL_KEY]: nextTurn,
        ...montajeTurnoToMirror(nextTurn),
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
      const cur = resolveMontajeTurnoActual(prev)
      if (!cur || cur.timer.state !== "running") return prev
      const last = cur.timer.lastResumeAtMs
      const nextTurn: MontajeTurnoEntry = {
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
        [MON_ACTUAL_KEY]: nextTurn,
        ...montajeTurnoToMirror(nextTurn),
      }
      queueMicrotask(() => {
        void persistMontajeForm(nextForm, {
          skipProductionSaveGuard: true,
          notifyProductionSave: false,
          suppressSuccessToast: true,
        })
      })
      return nextForm
    })
    setPauseMotivoModalOpen(true)
  }

  async function confirmPauseAndResume() {
    const reason = pauseReason.trim()
    if (!reason) {
      toast.error("Seleccione el motivo de parada.")
      return
    }
    const obs = pauseObs.trim()
    const cur = resolveMontajeTurnoActual(form)
    if (!cur || cur.timer.state !== "paused") return
    const now = Date.now()
    const pauseStart = cur.timer.pauseAtMs
    const pauseDurationSec = pauseStart > 0 ? (now - pauseStart) / 1000 : 0
    const nextTurn: MontajeTurnoEntry = {
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
      ...form,
      [MON_ACTUAL_KEY]: nextTurn,
      ...montajeTurnoToMirror(nextTurn),
    }
    setForm(bootstrapMontajeFormState(nextForm))
    setPauseReason("")
    setPauseObs("")
    setPauseMotivoModalOpen(false)
    const ok = await persistMontajeForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      mesMontajeSwalWithBandeja(nextForm, "Parada guardada", "Reanude con play.")
    }
  }

  function requestIniciarTurno() {
    if (readOnlyOps) return
    if (hasActiveTurno) return
    if (!draftOperadoresLabel) {
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
    if (!draftOperadoresLabel) {
      setStartTurnConfirmOpen(false)
      toast.error(
        draftPeople.length > 0
          ? "Falta un Operador en la cuadrilla. Guarde al menos una persona con rol Operador (Ayudante no basta)."
          : "Guarde al menos un operador en la cuadrilla antes de iniciar el turno.",
      )
      return
    }
    const u = getStoredUser()
    const t = createNewMontajeTurno({
      turno: draftTurno,
      grupo: draftGrupo,
      operador: draftOperadoresLabel,
      controlOwner: u ? { id: u.id, name: u.name } : null,
    })
    const turnoWithPeople: MontajeTurnoEntry = {
      ...t,
      ayudante: draftAyudantesLabel,
      supervisor: draftSupervisoresLabel,
    }
    const nextForm: Record<string, unknown> = {
      ...form,
      [MON_ACTUAL_KEY]: turnoWithPeople,
      ...montajeTurnoToMirror(turnoWithPeople),
      ...clearMontajeTurnCaptureFormKeys(),
      [MON_TURNOS_KEY]: parseMontajeTurnos(form[MON_TURNOS_KEY]),
    }
    setForm(nextForm)
    setDraftPeople([])
    setDraftStaging({ name: "", role: "operador" })
    setStartTurnConfirmOpen(false)
    void (async () => {
      const ok = await persistMontajeForm(nextForm, {
        skipProductionSaveGuard: true,
        notifyProductionSave: false,
        suppressSuccessToast: true,
      })
      if (ok) {
        mesMontajeSwalWithBandeja(nextForm, "Guardado", undefined, canFinalizeOrder)
        await tryAdvanceBoardStageToMontaje()
        await load()
      }
    })()
  }

  async function applyCerrarTurno(cur: MontajeTurnoEntry, finalizedTimer: MontajeTurnTimer) {
    const u = getStoredUser()
    const closed: MontajeTurnoEntry = {
      ...cur,
      timer: finalizedTimer,
      closed_at: new Date().toISOString(),
      closed_by: u ? { id: u.id, name: u.name } : null,
    }
    const closedSnapshot: MontajeLastClosedSnapshot = {
      turno: cur.turno,
      grupo: cur.grupo,
      operador: cur.operador,
      ayudante: cur.ayudante,
      supervisor: cur.supervisor,
      observaciones: readString(form.montObservaciones),
      numCliche: readString(form[MON_CLICHE_KEY]),
      numCilindro: readString(form[MON_CILINDRO_KEY]),
      filasExtra: montajeFilasExtraForSave(montajeFilasExtra),
      materialesMontaje: montajeMaterialesForSave(montajeMateriales),
    }
    const nextForm: Record<string, unknown> = {
      ...form,
      [MON_TURNOS_KEY]: [...parseMontajeTurnos(form[MON_TURNOS_KEY]), closed],
      [MON_ACTUAL_KEY]: null,
      ...clearMontajeShiftMirrorKeysOnly(),
      ...clearMontajeTurnCaptureFormKeys(),
      ...timerToLegacyFlat(finalizedTimer),
      [MON_LAST_CLOSED_SNAPSHOT_KEY]: closedSnapshot,
    }
    setForm(bootstrapMontajeFormState(nextForm))
    const ok = await persistMontajeForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      mesMontajeSwalWithBandeja(nextForm, "Turno cerrado")
      await load()
    }
  }

  function confirmEmptyShiftClose() {
    const p = pendingEmptyShiftCloseRef.current
    pendingEmptyShiftCloseRef.current = null
    setEmptyShiftCloseDialogOpen(false)
    if (!p) return
    applyCerrarTurno(p.cur, p.finalizedTimer)
  }

  function cerrarTurnoActual() {
    if (controlReadOnly) return
    const cur = resolveMontajeTurnoActual(form)
    if (!cur) return
    if (!cur.operador.trim() || !cur.turno || !cur.grupo) {
      toast.error("Complete turno, grupo y operador.")
      return
    }
    const finalizedTimer = finalizeTurnTimerNow(cur.timer)
    if (finalizedTimer.effectiveAccSec < 0.01 && sumProduccionKg(cur) === 0) {
      pendingEmptyShiftCloseRef.current = { cur, finalizedTimer }
      setEmptyShiftCloseDialogOpen(true)
      return
    }
    void applyCerrarTurno(cur, finalizedTimer)
  }

  async function finalizarAreaMontaje() {
    if (!canFinalizeOrder) return
    const prev = form
    let turnos = parseMontajeTurnos(prev[MON_TURNOS_KEY])
    const cur = parseMontajeTurnoActual(prev[MON_ACTUAL_KEY])
    const u = getStoredUser()
    if (cur) {
      const closed: MontajeTurnoEntry = {
        ...cur,
        timer: finalizeTurnTimerNow(cur.timer),
        closed_at: new Date().toISOString(),
        closed_by: u ? { id: u.id, name: u.name } : null,
      }
      turnos = [...turnos, closed]
    }
    const nextForm: Record<string, unknown> = {
      ...prev,
      [MON_TURNOS_KEY]: turnos,
      [MON_ACTUAL_KEY]: null,
      [MON_ESTADO_KEY]: "finalizada",
      ...clearMontajeMirrorKeys(),
      [MON_LAST_CLOSED_SNAPSHOT_KEY]: null,
    }
    clearMontajeBrowserCache(workOrderId)
    setForm(bootstrapMontajeFormState(nextForm))
    const ok = await persistMontajeForm(nextForm, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
      suppressSuccessToast: true,
    })
    if (ok) {
      mesMontajeSwalWithBandeja(nextForm, "Montaje finalizado")
      await load()
    }
  }

  async function tryAdvanceBoardStageToMontaje() {
    const stageOrder: Record<string, number> = {
      nueva: 0,
      pendiente: 1,
      montaje: 2,
      impresion: 3,
      laminacion: 4,
      corte: 5,
      completada: 6,
    }
    try {
      const wo = await apiFetch<{ board_stage?: string | null }>(`work-orders/${workOrderId}`)
      const bs = (wo.board_stage ?? "nueva").toLowerCase()
      if ((stageOrder[bs] ?? -1) >= stageOrder.montaje) return
      await apiFetch(`work-orders/${workOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: "montaje" }),
      })
    } catch {
      /* sin permiso o red: el turno igual quedó guardado */
    }
  }

  function handleGuardarSesion() {
    void persistMontajeForm(undefined, {
      skipProductionSaveGuard: true,
      notifyProductionSave: false,
    })
  }

  function requestGuardar() {
    if (saving || !canClickGuardar) {
      if (!canClickGuardar) {
        toast.error(
          !hasActiveTurno && closedTurnos.length === 0
            ? "Inicie un turno de planta antes de guardar."
            : MES_SAVE_BLOCKED_MESSAGE,
        )
      }
      return
    }
    if (hasActiveTurno) {
      const cur = resolveMontajeTurnoActual(form)
      if (cur && (!cur.operador.trim() || !cur.turno || !cur.grupo)) {
        toast.error("Complete turno, grupo y operador antes de guardar.")
        return
      }
      setGuardarChoiceOpen(true)
      return
    }
    if (canPersistBetweenShifts) {
      setGuardarChoiceOpen(true)
      return
    }
    if (canFinalizeOrder) {
      setGuardarChoiceOpen(true)
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de montaje…</p>

  return (
    <div className="ax-mes space-y-4">
      <MesOperativoEstadoCard
        areaLabel="Montaje"
        estado={operativoEstado}
        producidoKg={totalProduccionAcumulada}
        lastServerSaveAt={lastServerSaveAt}
      />
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

      <WorkOrderMontajeOpsSection
        pedidoTotalKg={pedidoTotalKg}
        producidoAcumuladoKg={producidoAcumuladoKg}
        faltanteKg={faltanteKg}
        turnosRegistrados={turnosRegistrados}
        totalProduccionAcumulada={totalProduccionAcumulada}
        totalMermaAcumulada={totalMermaAcumulada}
        kgProduccionTurno={kgProduccionTurno}
        kgProduccionRaw={readNumberString(activeTurno?.kgProduccion ?? form.montKgProduccion)}
        mermaRaw={readNumberString(activeTurno?.mermaKg ?? form.montMermaKg)}
        metrajeRaw={readNumberString(activeTurno?.metrajeKg ?? form.montMetraje)}
        onSetKgProduccion={(v) => patchActiveTurn((t) => ({ ...t, kgProduccion: v }))}
        onSetMerma={(v) => patchActiveTurn((t) => ({ ...t, mermaKg: v }))}
        onSetMetraje={(v) => patchActiveTurn((t) => ({ ...t, metrajeKg: v }))}
        ultimoTurnoLabel={ultimoTurnoLabel}
        timerState={timerState}
        totalSec={displayTotalSec}
        deadSec={displayDeadSec}
        demountSec={displayDemountSec}
        arranqueSec={displayArranqueSec}
        arranqueRunning={arranqueRunning}
        effectiveSec={displayEffectiveSec}
        timerShowsOtAccumulated={closedTurnos.length > 0 || hasActiveTurno}
        kgHora={kgHora}
        horaArranque={displayHoraArranque}
        montajeOpRunning={montajeOpRunning}
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
        montTurno={readString(form.montTurno)}
        montGrupo={readString(form.montGrupo)}
        montOperador={readString(form.montOperador)}
        montAyudante={readString(form.montAyudante)}
        montSupervisor={readString(form.montSupervisor)}
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
        onFinalizarAreaMontaje={requestFinalizarAreaMontaje}
        closedTurnos={closedTurnos}
        lastClosedTurno={lastClosedTurno}
        onSetTurno={(v) => patchActiveTurn((t) => ({ ...t, turno: v }))}
        onSetGrupo={(v) => patchActiveTurn((t) => ({ ...t, grupo: v }))}
        onActivePersonnelApply={(people) => {
          const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
          patchActiveTurn((t) => ({ ...t, operador, ayudante, supervisor }))
        }}
        canPreviewTimerReport={canPreviewTimerReport}
        onPreviewTimerReport={requestOpenTimerReportPreview}
        simplifiedTimerActions
        showTimerActions={hasActiveTurno}
      />

      {hasActiveTurno || areaFinalizada ? (
        <WorkOrderMontajeClicheMaterialSection
          numCliche={visibleNumCliche}
          numCilindro={visibleNumCilindro}
          filasExtra={visibleFilasExtra}
          materialesMontaje={visibleMaterialesMontaje}
          readOnly={controlReadOnly || !hasActiveTurno}
          onNumClicheChange={(v) => setForm((prev) => ({ ...prev, [MON_CLICHE_KEY]: v }))}
          onNumCilindroChange={(v) => setForm((prev) => ({ ...prev, [MON_CILINDRO_KEY]: v }))}
          onFilasExtraChange={(rows: MontajeFilaMontaje[]) =>
            setForm((prev) => ({ ...prev, [MON_FILAS_EXTRA_KEY]: rows }))
          }
          onMaterialesMontajeChange={(rows: MontajeMaterialFila[]) =>
            setForm((prev) => ({ ...prev, [MON_MATERIALES_MONTAJE_KEY]: rows }))
          }
        />
      ) : null}

      {hasActiveTurno || areaFinalizada ? (
      (() => {
        const doneObs = !!visibleObsTurno.trim()
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
              id={montObsTextareaId}
              name="montObservaciones"
              aria-label="Observaciones del turno"
              value={visibleObsTurno}
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
      })()
      ) : null}

      <div className="no-print mb-12 flex flex-col items-center gap-2">
        {guardarHint ? (
          <p className="max-w-md text-center text-xs text-muted-foreground">{guardarHint}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={requestGuardar} disabled={saving || !canClickGuardar}>
            <Save className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <MesMontajeGuardarChoiceDialog
        open={guardarChoiceOpen}
        onOpenChange={setGuardarChoiceOpen}
        canFinalizeArea={canFinalizeOrder}
        hasActiveTurno={hasActiveTurno}
        betweenShiftsMode={canPersistBetweenShifts && !hasActiveTurno}
        onGuardarSesion={handleGuardarSesion}
        onFinalizarTurno={requestCerrarTurnoActual}
        onFinalizarArea={requestFinalizarAreaMontaje}
      />

      {timerConfirm ? (
        <MesMontajeConfirmDialog
          tone={MONTAJE_TIMER_CONFIRM[timerConfirm].tone}
          open
          onOpenChange={(open) => {
            if (!open) setTimerConfirm(null)
          }}
          icon={<CirclePlay className="h-5 w-5" aria-hidden />}
          title={MONTAJE_TIMER_CONFIRM[timerConfirm].title}
          description={MONTAJE_TIMER_CONFIRM[timerConfirm].description}
          confirmLabel={MONTAJE_TIMER_CONFIRM[timerConfirm].confirmLabel}
          confirmVariant={
            MONTAJE_TIMER_CONFIRM[timerConfirm].destructive ? "destructive" : "default"
          }
          onConfirm={() => {
            const key = timerConfirm
            setTimerConfirm(null)
            executeTimerConfirm(key)
          }}
        />
      ) : null}

      <MesMontajeConfirmDialog
        tone="violet"
        open={previewTimerConfirmOpen}
        onOpenChange={setPreviewTimerConfirmOpen}
        icon={<FileSearch className="h-5 w-5" aria-hidden />}
        title="Vista previa del cronómetro"
        description="Se abrirá una pestaña nueva con el reporte de tiempos y pausas registrados hasta este momento."
        confirmLabel="Abrir vista previa"
        onConfirm={() => confirmOpenTimerReportPreview()}
      />

      <MesMontajeConfirmDialog
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

      <MesMontajeConfirmDialog
        tone="rose"
        open={closeTurnConfirmOpen}
        onOpenChange={setCloseTurnConfirmOpen}
        icon={<LogOut className="h-5 w-5" aria-hidden />}
        title="Finalizar turno"
        description="Se cerrará el registro de turno de planta en curso y se consolidará el cronómetro en el historial. Podrá abrir otro turno de planta después. ¿Confirma el cierre?"
        confirmLabel="Sí, finalizar turno"
        onConfirm={() => confirmCloseTurnFirstStep()}
      />

      <MesMontajeConfirmDialog
        tone="red"
        open={finalizeOtConfirmOpen}
        onOpenChange={setFinalizeOtConfirmOpen}
        icon={<Flag className="h-5 w-5" aria-hidden />}
        title="Finalizar área de montaje (OT)"
        description="Marcará el área como finalizada, detendrá el cronómetro, mostrará «Finalizado» en la bandeja Montaje y moverá la OT a la pestaña Historial. Revise que los datos del turno estén completos."
        confirmLabel="Sí, finalizar área"
        confirmVariant="destructive"
        onConfirm={() => confirmFinalizarAreaMontaje()}
      />

      <MesMontajeConfirmDialog
        tone="orange"
        open={emptyShiftCloseDialogOpen}
        onOpenChange={(open) => {
          setEmptyShiftCloseDialogOpen(open)
          if (!open) pendingEmptyShiftCloseRef.current = null
        }}
        icon={<AlertCircle className="h-5 w-5" aria-hidden />}
        title="Finalizar turno sin actividad"
        description="El turno no registra tiempo efectivo ni producción. ¿Desea cerrarlo igual?"
        confirmLabel="Sí, cerrar igual"
        onConfirm={() => confirmEmptyShiftClose()}
      />

      <MesMontajeConfirmDialog
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
