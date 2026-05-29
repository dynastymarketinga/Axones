import { useMemo } from "react"
import { ListChecks } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

import {
  LAM_CHECKLIST_ITEMS,
  type LamChecklistEstado,
} from "./laminacion-checklist-config"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkedIds: string[]
  estado: LamChecklistEstado
  observaciones: string
  elaborado: string
  revisado: string
  aprobadoPor: string
  disabled?: boolean
  onToggleItem: (id: string, checked: boolean) => void
  onEstado: (v: LamChecklistEstado) => void
  onObservaciones: (v: string) => void
  onElaborado: (v: string) => void
  onRevisado: (v: string) => void
  onAprobadoPor: (v: string) => void
}

export default function LaminacionChecklistDialog(props: Props) {
  const progress = useMemo(() => {
    const n = LAM_CHECKLIST_ITEMS.filter((it) => props.checkedIds.includes(it.id)).length
    return `${n}/${LAM_CHECKLIST_ITEMS.length} completados`
  }, [props.checkedIds])

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-violet-700" aria-hidden />
            Lista de chequeo — área de laminación
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Fecha: {new Date().toLocaleDateString("es-VE")} · {progress}
          </p>
          <ul className="divide-y rounded-md border">
            {LAM_CHECKLIST_ITEMS.map((item) => {
              const on = props.checkedIds.includes(item.id)
              return (
                <li key={item.id} className="flex gap-2 p-2.5 text-sm">
                  <Checkbox
                    id={`lam-chk-${item.id}`}
                    checked={on}
                    disabled={props.disabled}
                    onCheckedChange={(v) => props.onToggleItem(item.id, v === true)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`lam-chk-${item.id}`}
                    className={cn("min-w-0 flex-1 cursor-pointer leading-snug", on && "text-foreground")}
                  >
                    <span className="font-semibold">{item.id}.</span> {item.text}
                  </label>
                </li>
              )
            })}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Estado de inspección</Label>
              <ToggleGroup
                type="single"
                className="flex flex-wrap justify-start gap-1"
                value={props.estado || undefined}
                onValueChange={(v) => props.onEstado((v as LamChecklistEstado) || "")}
                disabled={props.disabled}
              >
                <ToggleGroupItem value="aprobado" className="text-xs">
                  Aprobado
                </ToggleGroupItem>
                <ToggleGroupItem value="rechazado" className="text-xs">
                  Rechazado
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lam-chk-obs" className="text-xs font-semibold">
                Observaciones del chequeo
              </Label>
              <Textarea
                id="lam-chk-obs"
                rows={2}
                className="text-sm"
                value={props.observaciones}
                onChange={(e) => props.onObservaciones(e.target.value)}
                disabled={props.disabled}
                placeholder="Observaciones del chequeo…"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="lam-chk-elab" className="text-xs">
                Elaborado por
              </Label>
              <Input
                id="lam-chk-elab"
                className="h-9"
                value={props.elaborado}
                onChange={(e) => props.onElaborado(e.target.value)}
                disabled={props.disabled}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lam-chk-rev" className="text-xs">
                Revisado por
              </Label>
              <Input
                id="lam-chk-rev"
                className="h-9"
                value={props.revisado}
                onChange={(e) => props.onRevisado(e.target.value)}
                disabled={props.disabled}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lam-chk-apr" className="text-xs">
                Aprobado por
              </Label>
              <Input
                id="lam-chk-apr"
                className="h-9"
                value={props.aprobadoPor}
                onChange={(e) => props.onAprobadoPor(e.target.value)}
                disabled={props.disabled}
                placeholder="Nombre"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
