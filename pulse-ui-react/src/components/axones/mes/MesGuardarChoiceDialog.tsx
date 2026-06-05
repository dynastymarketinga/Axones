"use client"

import { Flag, LogOut, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export const MES_GUARDAR_AREA_LABELS = {
  montaje: "Montaje",
  printing: "Impresión",
  laminacion: "Laminación",
  corte: "Corte",
  tintas: "Tintas y Mezcla de tinta",
} as const

export type MesGuardarAreaKey = keyof typeof MES_GUARDAR_AREA_LABELS

const GUARDAR_ICON_BOX =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-100/80 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"

export type MesGuardarChoiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  areaLabel: string
  canFinalizeArea: boolean
  hasActiveTurno: boolean
  betweenShiftsMode: boolean
  onGuardarSesion: () => void
  onFinalizarTurno: () => void
  onFinalizarArea: () => void
}

export function MesGuardarChoiceDialog(props: MesGuardarChoiceDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="gap-5 border-slate-200 bg-white sm:max-w-lg dark:border-slate-700 dark:bg-slate-950">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-start gap-3">
            <div className={GUARDAR_ICON_BOX}>
              <Save className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Guardar en el sistema</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {props.betweenShiftsMode ? (
                  <>
                    Está <span className="font-semibold text-foreground">entre turnos</span> (sin cuadrilla activa).
                    Confirme el registro en servidor o cierre el área {props.areaLabel} si la OT terminó.
                  </>
                ) : (
                  <>
                    Turno de planta en curso. Al terminar la jornada, elija si cierra el turno o finaliza el área{" "}
                    {props.areaLabel} en el sistema.
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
                  ? "Sincroniza tiempos, kg, mermas y datos acumulados en el servidor."
                  : "Cierra el turno de planta en curso y guarda arranque, producción y material."}
              </span>
            </li>
            {props.canFinalizeArea ? (
              <li className="flex gap-2">
                <Flag className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                <span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Finalizar cierre</span>
                  {" — "}
                  Marca el área {props.areaLabel} como finalizada en la OT y la muestra en En curso → Finalizadas.
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

export function mesGuardarChoiceHint(opts: {
  areaLabel: string
  controlReadOnly: boolean
  hasActiveTurno: boolean
  canSaveProduction: boolean
  canPersistShiftOpen: boolean
  canPersistBetweenShifts: boolean
  closedTurnosCount: number
  blockedMessage: string
}): string {
  if (opts.controlReadOnly) return ""
  if (opts.hasActiveTurno && (opts.canSaveProduction || opts.canPersistShiftOpen)) {
    return `Al pulsar Guardar elija «Finalizar turno» o «Finalizar cierre» del área ${opts.areaLabel}.`
  }
  if (opts.canPersistBetweenShifts) {
    return `Entre turnos: pulse Guardar y elija «Finalizar turno» (sincronizar) o «Finalizar cierre» si el trabajo en ${opts.areaLabel} terminó.`
  }
  if (opts.canSaveProduction || opts.canPersistShiftOpen) {
    return `Al pulsar Guardar elija «Finalizar turno» o «Finalizar cierre» del área ${opts.areaLabel}.`
  }
  if (!opts.hasActiveTurno && opts.closedTurnosCount === 0) {
    return "Inicie un turno de planta para registrar datos."
  }
  return opts.blockedMessage
}
