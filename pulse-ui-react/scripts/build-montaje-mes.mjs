import fs from "node:fs"
import path from "node:path"

const root = path.join(process.cwd(), "src", "pages", "axones")
const srcPath = path.join(root, "WorkOrderPrintingOpsSection.tsx")
const outPath = path.join(root, "WorkOrderMontajeOpsSection.tsx")

function rep(s) {
  return s
    .replaceAll("WorkOrderPrintingOpsSection", "WorkOrderMontajeOpsSection")
    .replaceAll("./printing-turnos", "./montaje-turnos")
    .replaceAll("PrintingTurnoEntry", "MontajeTurnoEntry")
    .replaceAll("PrintingPauseEntry", "MontajePauseEntry")
    .replaceAll("PRINTING_REJECT_REASONS", "MON_PAUSE_REASONS")
    .replaceAll("personnelLinesFromPrintingTurno", "personnelLinesFromMontajeTurno")
    .replaceAll("sumSalidaKg", "sumProduccionKg")
    .replaceAll("sumScrapKg", "sumMermaKg")
    .replaceAll("impTurno", "montTurno")
    .replaceAll("impGrupo", "montGrupo")
    .replaceAll("impOperador", "montOperador")
    .replaceAll("impAyudante", "montAyudante")
    .replaceAll("impSupervisor", "montSupervisor")
    .replaceAll("impDraftPersonName", "montDraftPersonName")
    .replaceAll("impPauseMotivo", "montPauseMotivo")
    .replaceAll("impPauseObs", "montPauseObs")
    .replaceAll("Área de impresión", "Área de montaje")
    .replaceAll("impresión", "montaje")
    .replaceAll("Impresión", "Montaje")
    .replaceAll("onFinalizarAreaImpresion", "onFinalizarAreaMontaje")
    .replaceAll("totalEntradaAcumulada", "totalProduccionAcumulada")
    .replaceAll("totalEntradaTurno", "kgProduccionTurno")
    .replaceAll("totalScrap", "totalMermaAcumulada")
    .replaceAll("Total entrada acumulada", "Producción acumulada (Kg)")
    .replaceAll("Total scrap acumulado", "Merma acumulada (Kg)")
    .replaceAll("Salida ", "Producción ")
    .replaceAll("Scrap ", "Merma ")
    .replaceAll("(Impresión)", "(Montaje)")
}

const lines = fs.readFileSync(srcPath, "utf8").split("\n")

const cutAt = lines.findIndex((l) => l.includes('"Ingreso de material virgen"'))
const pauseAt = lines.findIndex((l) => l.includes("open={props.pauseMotivoDialogOpen}"))
const labelAt = lines.findIndex((l) => l.includes("open={props.labelEditorOpen}"))
const cumAt = lines.findIndex((l) => l.includes("open={cumulativeTurnosDialogOpen}"))

if ([cutAt, pauseAt, labelAt, cumAt].some((i) => i < 0)) {
  throw new Error(`markers: cut=${cutAt} pause=${pauseAt} label=${labelAt} cum=${cumAt}`)
}

const productionSection = `      {props.hasActiveTurno ? (
      <>
      <MesSectionShell
        title={mesSectionTitle(Weight, "Producción del turno")}
        subtle
        headerRight={<MesSectionHeaderExtras isDone={doneProduccion} />}
      >
        <motion.div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            {fieldLabel(mk("kg-prod"), Weight, "Kg producción")}
            <Input
              id={mk("kg-prod")}
              name="montKgProduccion"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.kgProduccionRaw}
              onChange={(e) => props.onSetKgProduccion(e.target.value)}
              disabled={inputDisabled}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("merma"), TrendingDown, "Merma (Kg)")}
            <Input
              id={mk("merma")}
              name="montMermaKg"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.mermaRaw}
              onChange={(e) => props.onSetMerma(e.target.value)}
              disabled={inputDisabled}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            {fieldLabel(mk("metraje"), Ruler, "Metraje montaje")}
            <Input
              id={mk("metraje")}
              name="montMetraje"
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={props.metrajeRaw}
              onChange={(e) => props.onSetMetraje(e.target.value)}
              disabled={inputDisabled}
              placeholder="0"
            />
          </div>
        </div>
      </MesSectionShell>
      </>
      ) : null}
`.replace(/motion\.div/g, "div")

const assembled = [
  ...lines.slice(0, cutAt),
  productionSection,
  ...lines.slice(pauseAt, labelAt),
  ...lines.slice(cumAt),
].join("\n")

let out = rep(assembled)

out = out.replace(
  /import \{[\s\S]*?\} from "\.\/montaje-turnos"/,
  `import {
  MON_PAUSE_REASONS,
  sumProduccionKg,
  type MontajeTurnoEntry,
} from "./montaje-turnos"`,
)

out = out.replace(/export type \{ BobinaLabelMeta, WarehouseReturnDraft \}\n\n/, "")

out = out.replace(
  /type PrintingPauseEntry = \{ at: string; reason: string; obs: string; duration_sec: number \}\n\n/,
  "type MontajePauseEntry = { at: string; reason: string; obs: string; duration_sec: number }\n\n",
)

out = out.replace(
  /type LabelEditorMode = "entrada" \| "salida"\n/,
  "",
)

// Replace Props block
out = out.replace(/type Props = \{[\s\S]*?\n\}/m, `type Props = {
  pedidoTotalKg: number
  producidoAcumuladoKg: number
  faltanteKg: number
  turnosRegistrados: number
  totalProduccionAcumulada: number
  kgProduccionTurno: number
  totalMermaAcumulada: number
  ultimoTurnoLabel: string
  timerState: string
  totalSec: number
  deadSec: number
  effectiveSec: number
  kgHora: string
  timerRunning: boolean
  timerPaused: boolean
  pauseReasons: string[]
  pauseReason: string
  pauseObs: string
  pauseMotivoDialogOpen: boolean
  onPauseMotivoDialogOpenChange: (open: boolean) => void
  pauseEntries: MontajePauseEntry[]
  montTurno: string
  montGrupo: string
  montOperador: string
  montAyudante: string
  montSupervisor: string
  kgProduccionRaw: string
  mermaRaw: string
  metrajeRaw: string
  formatTimerHms: (s: number) => string
  setPauseReason: (v: string) => void
  setPauseObs: (v: string) => void
  startProductionTimer: () => void
  pauseProductionTimer: () => void
  confirmPauseAndResume: () => void
  onSetTurno: (v: "diurno" | "nocturno") => void
  onSetGrupo: (v: "A" | "B" | "C") => void
  onActivePersonnelApply: (people: DraftPerson[]) => void
  onSetKgProduccion: (v: string) => void
  onSetMerma: (v: string) => void
  onSetMetraje: (v: string) => void
  hasActiveTurno: boolean
  areaFinalizada: boolean
  readOnlyOps: boolean
  canFinalizeOrder: boolean
  draftTurno: "diurno" | "nocturno"
  draftGrupo: "A" | "B" | "C"
  draftPeople: DraftPerson[]
  draftOperadorMissing: boolean
  draftStagingName: string
  draftStagingRole: DraftPersonRole
  onDraftTurno: (v: "diurno" | "nocturno") => void
  onDraftGrupo: (v: "A" | "B" | "C") => void
  onDraftStagingName: (v: string) => void
  onDraftStagingRole: (v: DraftPersonRole) => void
  onDraftPersonGuardar: (name: string, role: DraftPersonRole) => void
  onDraftPersonRemove: (id: string) => void
  onIniciarTurno: () => void
  onCerrarTurnoActual: () => void
  onFinalizarAreaMontaje: () => void | Promise<void>
  closedTurnos: MontajeTurnoEntry[]
  canPreviewTimerReport: boolean
  onPreviewTimerReport: () => void
  canResetAll: boolean
  onResetAll: () => void
}`)

out = out.replace(
  /function hasMeta[\s\S]*?function labelTooltipText[\s\S]*?\n\}/m,
  "",
)

out = out.replace(
  "function personnelLinesFromMontajeTurno(t: MontajeTurnoEntry): string[] {",
  `function sumMermaKg(t: MontajeTurnoEntry): number {
  const n = Number(String(t.mermaKg ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function personnelLinesFromMontajeTurno(t: MontajeTurnoEntry): string[] {`,
)

out = out.replace(
  /const autoIngresoMaterial[\s\S]*?const doneResumen = autoResumen\n/,
  `const doneProduccion =
    num(props.kgProduccionRaw) > 0 || num(props.mermaRaw) > 0 || num(props.metrajeRaw) > 0

`,
)

out = out.replace(
  /props\.entradaBobinas\.some[\s\S]*?const doneResumen = autoResumen\n/,
  "",
)

out = out.replace(
  /const autoInfoTurno[\s\S]*?const doneInfoTurno = autoInfoTurno\n/,
  `const autoInfoTurno =
    !!props.montOperador.trim() ||
    !!props.montAyudante.trim() ||
    !!props.montSupervisor.trim() ||
    !!props.montTurno.trim() ||
    !!props.montGrupo.trim()
  const doneInfoTurno = autoInfoTurno
`,
)

out = out.replace(
  /const motivoComboLabel[\s\S]*?const rechMaterialSelected[\s\S]*?\)\n\n/,
  "",
)

out = out.replace(/canPreviewDesperdicioReport[\s\S]*?onPreviewDesperdicioReport[\s\S]*?\n/, "")

// Footer acumulado: use Factory icon instead of ArrowDownToLine for production line
out = out.replace(
  `<ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Producción acumulada (Kg):`,
  `<Factory className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Producción acumulada:`,
)

fs.writeFileSync(outPath, out)
console.log("OK", outPath, out.length)
