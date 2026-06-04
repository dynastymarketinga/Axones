import { useEffect, useId, useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowUpFromLine,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Factory,
  Layers,
  Package,
  Printer,
  UserRound,
  Weight,
  Clock,
  Hash,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { emptyBobinaLabelMeta, type BobinaLabelMeta } from "./printing-turnos"
import { normalizeBobinaLabelMeta } from "./laminacion-turnos"

const BOBINA_LABEL_INPUT_CLASS = "ot-input-unified h-10 bg-background shadow-sm"

export function hasBobinaLabelMeta(meta: BobinaLabelMeta | undefined): boolean {
  if (!meta) return false
  return Object.values(meta).some((v) => String(v ?? "").trim() !== "")
}

export function bobinaLabelTooltipText(meta: BobinaLabelMeta | undefined): string {
  if (!meta || !hasBobinaLabelMeta(meta)) return "Sin etiqueta registrada"
  const parts: string[] = []
  if (meta.referencia.trim()) parts.push(meta.referencia.trim())
  if (meta.peso.trim()) parts.push(`${meta.peso.trim()} Kg`)
  if (meta.fecha.trim()) parts.push(meta.fecha.trim())
  return parts.length ? parts.join(" · ") : "Etiqueta registrada"
}

export function todayBobinaLabelFecha(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

export function bobinaLabelDraftFromMeta(meta: BobinaLabelMeta | undefined): BobinaLabelMeta {
  const draft = meta ? { ...meta } : emptyBobinaLabelMeta()
  if (!draft.fecha.trim()) draft.fecha = todayBobinaLabelFecha()
  return draft
}

function parseBobinaLabelFecha(value: string): Date | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return undefined
  const [, day, month, year] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return undefined
  }
  return parsed
}

function formatBobinaLabelFecha(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = String(date.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function bobinaLabelFechaDisplay(value: string): string {
  const trimmed = value.trim()
  return parseBobinaLabelFecha(trimmed) ? trimmed : "Seleccionar fecha"
}

function BobinaLabelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-primary/10 bg-gradient-to-b from-muted/30 to-muted/10 p-4 shadow-sm">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-primary/75">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function BobinaLabelField({
  id,
  label,
  icon: Icon,
  className,
  children,
}: {
  id: string
  label: string
  icon: LucideIcon
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
        {label}
      </Label>
      {children}
    </div>
  )
}

export type MesBobinaEntradaLabelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slotIndex: number
  draft: BobinaLabelMeta
  onDraftChange: (key: keyof BobinaLabelMeta, value: string) => void
  error: string
  onClear: () => void
  onSave: () => void
  /** Título corto del material, p. ej. «impresa». */
  materialLabel?: string
}

export function MesBobinaEntradaLabelDialog({
  open,
  onOpenChange,
  slotIndex,
  draft,
  onDraftChange,
  error,
  onClear,
  onSave,
  materialLabel = "impresa",
}: MesBobinaEntradaLabelDialogProps) {
  const formFieldId = useId().replace(/:/g, "")
  const mk = (suffix: string) => `${formFieldId}-${suffix}`
  const [labelFechaPickerOpen, setLabelFechaPickerOpen] = useState(false)

  useEffect(() => {
    if (!open) setLabelFechaPickerOpen(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-2 border-b border-primary/10 bg-gradient-to-r from-primary/5 via-background to-primary/5 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-left">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-4 w-4" aria-hidden />
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <span>Etiqueta bobina {materialLabel} de entrada</span>
              <Badge variant="secondary" className="font-mono text-xs font-semibold">
                #{slotIndex + 1}
              </Badge>
            </span>
          </DialogTitle>
          <DialogDescription className="text-left">
            Registre los datos de la bobina. Todos los campos son opcionales.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,680px)] space-y-4 overflow-y-auto px-6 py-5">
          <BobinaLabelSection title="Fecha y hora">
            <BobinaLabelField id={mk("label-fecha")} label="Fecha bobina" icon={CalendarDays}>
              <Popover open={labelFechaPickerOpen} onOpenChange={setLabelFechaPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id={mk("label-fecha")}
                    type="button"
                    variant="outline"
                    name="corLabelFecha"
                    className={cn(
                      BOBINA_LABEL_INPUT_CLASS,
                      "w-full justify-between px-3 font-normal",
                      !draft.fecha.trim() && "text-muted-foreground",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden />
                      {bobinaLabelFechaDisplay(draft.fecha)}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <UiCalendar
                    mode="single"
                    selected={parseBobinaLabelFecha(draft.fecha)}
                    defaultMonth={parseBobinaLabelFecha(draft.fecha) ?? new Date()}
                    onSelect={(date) => {
                      if (!date) return
                      onDraftChange("fecha", formatBobinaLabelFecha(date))
                      setLabelFechaPickerOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </BobinaLabelField>
            <BobinaLabelField id={mk("label-hora")} label="Hora" icon={Clock}>
              <Input
                id={mk("label-hora")}
                name="corLabelHora"
                type="time"
                value={draft.hora}
                onChange={(e) => onDraftChange("hora", e.target.value)}
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
          </BobinaLabelSection>

          <BobinaLabelSection title="Identificación">
            <BobinaLabelField id={mk("label-referencia")} label="Referencia bobina" icon={Hash}>
              <Input
                id={mk("label-referencia")}
                name="corLabelReferencia"
                value={draft.referencia}
                onChange={(e) => onDraftChange("referencia", e.target.value)}
                placeholder="Ref. o lote"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
            <BobinaLabelField id={mk("label-pedido-lote")} label="Pedido / Lote" icon={ClipboardList}>
              <Input
                id={mk("label-pedido-lote")}
                name="corLabelPedidoLote"
                value={draft.pedido_lote}
                onChange={(e) => onDraftChange("pedido_lote", e.target.value)}
                placeholder="N° pedido o lote"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
            <BobinaLabelField id={mk("label-lote")} label="Lote" icon={Layers} className="sm:col-span-2">
              <Input
                id={mk("label-lote")}
                name="corLabelLote"
                value={draft.lote}
                onChange={(e) => onDraftChange("lote", e.target.value)}
                placeholder="Lote"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
          </BobinaLabelSection>

          <BobinaLabelSection title="Origen y personal">
            <BobinaLabelField id={mk("label-proveedor")} label="Proveedor" icon={Factory}>
              <Input
                id={mk("label-proveedor")}
                name="corLabelProveedor"
                value={draft.proveedor}
                onChange={(e) => onDraftChange("proveedor", e.target.value)}
                placeholder="Proveedor"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
            <BobinaLabelField id={mk("label-operador")} label="Operador" icon={UserRound}>
              <Input
                id={mk("label-operador")}
                name="corLabelOperador"
                value={draft.operador}
                onChange={(e) => onDraftChange("operador", e.target.value)}
                placeholder="Operador"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
            <BobinaLabelField
              id={mk("label-maquina-origen")}
              label="Máquina origen"
              icon={Printer}
              className="sm:col-span-2"
            >
              <Input
                id={mk("label-maquina-origen")}
                name="corLabelMaquinaOrigen"
                value={draft.maquina_origen}
                onChange={(e) => onDraftChange("maquina_origen", e.target.value)}
                placeholder="Impresión / laminación"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
          </BobinaLabelSection>

          <BobinaLabelSection title="Medidas">
            <BobinaLabelField id={mk("label-peso")} label="Peso (Kg)" icon={Weight}>
              <Input
                id={mk("label-peso")}
                name="corLabelPeso"
                value={draft.peso}
                onChange={(e) => onDraftChange("peso", e.target.value)}
                placeholder="Ej: 120"
                inputMode="decimal"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
            <BobinaLabelField id={mk("label-metraje")} label="Metraje" icon={ArrowUpFromLine}>
              <Input
                id={mk("label-metraje")}
                name="corLabelMetraje"
                value={draft.metraje}
                onChange={(e) => onDraftChange("metraje", e.target.value)}
                placeholder="Metros"
                inputMode="decimal"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
            <BobinaLabelField
              id={mk("label-medida-ancho")}
              label="Medida / Ancho (mm)"
              icon={Layers}
              className="sm:col-span-2"
            >
              <Input
                id={mk("label-medida-ancho")}
                name="corLabelMedidaAncho"
                value={draft.medida_ancho}
                onChange={(e) => onDraftChange("medida_ancho", e.target.value)}
                placeholder="Ej: 610"
                inputMode="decimal"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
          </BobinaLabelSection>

          <BobinaLabelSection title="Tratamiento">
            <BobinaLabelField id={mk("label-trat-int")} label="Tratamiento interno" icon={Layers}>
              <Input
                id={mk("label-trat-int")}
                name="corLabelTratamientoInterno"
                value={draft.tratamiento_interno}
                onChange={(e) => onDraftChange("tratamiento_interno", e.target.value)}
                placeholder="Dinas"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
            <BobinaLabelField id={mk("label-trat-ext")} label="Tratamiento externo" icon={Layers}>
              <Input
                id={mk("label-trat-ext")}
                name="corLabelTratamientoExterno"
                value={draft.tratamiento_externo}
                onChange={(e) => onDraftChange("tratamiento_externo", e.target.value)}
                placeholder="Dinas"
                className={BOBINA_LABEL_INPUT_CLASS}
              />
            </BobinaLabelField>
          </BobinaLabelSection>
        </div>

        {error ? <p className="px-6 pb-2 text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 border-t border-primary/10 bg-muted/20 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClear}>
            Limpiar
          </Button>
          <Button type="button" onClick={onSave}>
            Guardar etiqueta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function normalizeEntradaLabelForSave(draft: BobinaLabelMeta): BobinaLabelMeta {
  return normalizeBobinaLabelMeta(draft)
}
