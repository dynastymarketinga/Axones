import { ArrowRight, Layers, Workflow } from "lucide-react"

import type { ScrapSubstrateGroupConfig } from "@/lib/scrap-substrate-catalog"
import { cn } from "@/lib/utils"

type ScrapClassificationHelpProps = {
  groups: ScrapSubstrateGroupConfig[]
}

const GROUP_MEANING: Record<string, { title: string; body: string; accent: string }> = {
  bopp: {
    title: "BOPP",
    body: "Film de polipropileno biorientado. Incluye el desperdicio impreso registrado en la planilla de impresión.",
    accent: "border-sky-500/25 bg-sky-500/[0.06] text-sky-950 dark:text-sky-100",
  },
  polietileno: {
    title: "Polietileno",
    body: "Capas y desperdicio de polietileno (PE, PEBD, PEAD, etc.). Material distinto al BOPP.",
    accent: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-950 dark:text-emerald-100",
  },
  transparente: {
    title: "Transparente",
    body: "Film transparente / CPP registrado en impresión y laminación (kg «Transparente» en la planilla de la OT).",
    accent: "border-violet-500/25 bg-violet-500/[0.06] text-violet-950 dark:text-violet-100",
  },
}

const FLOW_STEPS = [
  {
    step: "1",
    title: "Cargar desperdicio en la planilla de la OT",
    body: "Los kilos se registran en Impresión, Laminación y Corte (refile, impreso, mal corte, etc.). El inventario y las bobinas no alimentan este reporte.",
  },
  {
    step: "2",
    title: "Definir sustrato en Corte (si aplica)",
    body: "En la planilla, “Sustrato del desperdicio” puede quedar en Auto o elegirse a mano. Lo manual tiene prioridad sobre la estructura del producto.",
  },
  {
    step: "3",
    title: "Consultar la pestaña que corresponda",
    body: "BOPP, Polietileno y Transparente muestran las mismas columnas de kg, pero solo las OT y los kilos que pertenecen a ese tipo de film.",
  },
  {
    step: "4",
    title: "Revisar merma por área (otras pestañas)",
    body: "Por órdenes de trabajo y Por áreas muestran totales en kg por OT o por área (suma de todas las cubetas de film).",
  },
] as const

export function ScrapClassificationHelp({ groups }: ScrapClassificationHelpProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white shadow-sm dark:border-slate-700/60 dark:from-slate-900/40 dark:to-card"
      role="note"
    >
      <header className="border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Workflow className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-foreground text-sm font-semibold">Guía del reporte de desperdicio</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tres pestañas separan el desperdicio por <strong>tipo de film</strong> (materiales distintos entre sí).
              Transparente, BOPP y polietileno son cubetas de clasificación distintas en planta.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 py-3.5">
        <section>
          <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Qué significa cada pestaña
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((g) => {
              const meta = GROUP_MEANING[g.id] ?? {
                title: g.label,
                body: "Grupo de sustrato configurado para este reporte.",
                accent: "border-border bg-muted/40 text-foreground",
              }
              return (
                <div
                  key={g.id}
                  className={cn("rounded-xl border px-3 py-2.5 text-sm leading-snug", meta.accent)}
                >
                  <p className="font-semibold">{meta.title}</p>
                  <p className="mt-1 opacity-90">{meta.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Flujo en el día a día
          </p>
          <ol className="space-y-2">
            {FLOW_STEPS.map((item) => (
              <li
                key={item.step}
                className="flex gap-3 rounded-lg border border-slate-200/60 bg-white/60 px-3 py-2 dark:border-slate-700/50 dark:bg-slate-900/30"
              >
                <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  {item.step}
                </span>
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-muted-foreground flex items-start gap-2 border-t border-slate-200/70 pt-3 text-xs leading-relaxed dark:border-slate-700/60">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          Si una OT no aparece en BOPP, Polietileno o Transparente, revise en Corte el sustrato del desperdicio o la
          estructura del producto (mezclas como BOPP + PEBD requieren definición explícita). Kilos en 0 = aún no
          cargaron desperdicio en planilla para esa OT.
        </p>
      </div>
    </div>
  )
}
