import fs from "node:fs"
import path from "node:path"

const root = path.join(process.cwd(), "src", "pages", "axones")
const src = fs.readFileSync(path.join(root, "WorkOrderPrintingControlPanel.tsx"), "utf8")

function rep(s) {
  return s
    .replaceAll("WorkOrderPrintingControlPanel", "WorkOrderMontajeControlPanel")
    .replaceAll("WorkOrderPrintingOpsSection", "WorkOrderMontajeOpsSection")
    .replaceAll("./printing-turnos", "./montaje-turnos")
    .replaceAll("./WorkOrderPrintingOpsSection", "./WorkOrderMontajeOpsSection")
    .replaceAll("PRINTING_CONTROL_SAVED_EVENT", "MONTAJE_CONTROL_SAVED_EVENT")
    .replaceAll("@/lib/printing-mes-band-status", "@/lib/montaje-mes-band-status")
    .replaceAll("PrintingTurnoEntry", "MontajeTurnoEntry")
    .replaceAll("PrintingTurnTimer", "MontajeTurnTimer")
    .replaceAll("PrintingPauseEntry", "MontajePauseEntry")
    .replaceAll("IMP_TURNOS_KEY", "MON_TURNOS_KEY")
    .replaceAll("IMP_ACTUAL_KEY", "MON_ACTUAL_KEY")
    .replaceAll("IMP_ESTADO_KEY", "MON_ESTADO_KEY")
    .replaceAll("IMP_BOBINAS_SLOTS", "MON_BOBINAS_SLOTS")
    .replaceAll("bootstrapPrintingFormState", "bootstrapMontajeFormState")
    .replaceAll("clearPrintingMirrorKeys", "clearMontajeMirrorKeys")
    .replaceAll("createNewPrintingTurno", "createNewMontajeTurno")
    .replaceAll("parsePrintingTurnoActual", "parseMontajeTurnoActual")
    .replaceAll("parsePrintingTurnos", "parseMontajeTurnos")
    .replaceAll("printingTurnoToMirror", "montajeTurnoToMirror")
    .replaceAll("accumulatePrintingFromJson", "accumulateMontajeFromJson")
    .replaceAll("PRINTING_REJECT_REASONS", "MON_PAUSE_REASONS")
    .replaceAll("sumEntradaKg", "sumProduccionKg")
    .replaceAll("sumSalidaKg", "sumProduccionKg")
    .replaceAll("LOCAL_PRINTING_DRAFT_PREFIX", "LOCAL_MONTAJE_DRAFT_PREFIX")
    .replaceAll("MesPrintingConfirmDialog", "MesMontajeConfirmDialog")
    .replaceAll("MesPrintingConfirmTone", "MesMontajeConfirmTone")
    .replaceAll("MES_PRINTING_CONFIRM", "MES_MONTAJE_CONFIRM")
    .replaceAll("mesPrintingToastSuccess", "mesMontajeToastSuccess")
    .replaceAll("mesPrintingToastWarning", "mesMontajeToastWarning")
    .replaceAll("persistPrintingForm", "persistMontajeForm")
    .replaceAll("persistPrintingFormCb", "persistMontajeFormCb")
    .replaceAll("impObsTextareaId", "montObsTextareaId")
    .replaceAll("impTimer", "montTimer")
    .replaceAll("impTurno", "montTurno")
    .replaceAll("impGrupo", "montGrupo")
    .replaceAll("impOperador", "montOperador")
    .replaceAll("impAyudante", "montAyudante")
    .replaceAll("impSupervisor", "montSupervisor")
    .replaceAll("impObservaciones", "montObservaciones")
    .replaceAll("impAcumuladoProducidoKg", "montAcumuladoProducidoKg")
    .replaceAll("impRegistrosTurnos", "montRegistrosTurnos")
    .replaceAll("impMermaKg", "montMermaKg")
    .replaceAll("impMetrajeProduccion", "montMetraje")
    .replaceAll("impKgProduccion", "montKgProduccion")
    .replaceAll("impresion", "montaje")
    .replaceAll("Impresión", "Montaje")
    .replaceAll("impresión", "montaje")
    .replaceAll("printing-control", "orden-trabajo")
    .replaceAll("printing.timer-preview", "montaje.timer-preview")
    .replaceAll("printing.wastage-preview", "montaje.wastage-preview")
    .replaceAll("/impresion/", "/montaje/")
    .replaceAll("requestFinalizarAreaImpresion", "requestFinalizarAreaMontaje")
    .replaceAll("confirmFinalizarAreaImpresion", "confirmFinalizarAreaMontaje")
    .replaceAll("finalizarAreaImpresion", "finalizarAreaMontaje")
    .replaceAll("openDesperdicioPreview", "/* openDesperdicioPreview */")
    .replaceAll("canPreviewDesperdicioReport", "canPreviewDesperdicioReportRemoved")
}

let out = rep(src)

// Remove bobina/warehouse imports and types from ops import
out = out.replace(
  /import WorkOrderMontajeOpsSection, \{[\s\S]*?\} from "\.\/WorkOrderMontajeOpsSection"/,
  `import WorkOrderMontajeOpsSection, {
  type DraftPerson,
  type DraftPersonRole,
  stringsFromActivePersonnel,
} from "./WorkOrderMontajeOpsSection"`,
)

out = out.replace(/import type \{ LaravelPaginated, MaterialRow \}[\s\S]*?from "@\/types\/api"\n/, "")
out = out.replace(/type ProductionSummaryPayload[\s\S]*?\n\}/m, "")
out = out.replace(/type InventoryReturnCreated[\s\S]*?\n\}/m, "")
out = out.replace(/type BobinaLabelMeta[\s\S]*?WarehouseReturnDraft[\s\S]*?from "\.\/montaje-turnos"\n/, `import {
  MON_ACTUAL_KEY,
  MON_ESTADO_KEY,
  MON_TURNOS_KEY,
  accumulateMontajeFromJson,
  bootstrapMontajeFormState,
  clearMontajeMirrorKeys,
  createNewMontajeTurno,
  finalizeTurnTimerNow,
  formatTimerHms,
  montajeTurnoToMirror,
  parseMontajeTurnoActual,
  parseMontajeTurnos,
  readEstadoArea,
  sumProduccionKg,
  type MontajeTurnoEntry,
  type MontajeTurnTimer,
} from "./montaje-turnos"
`)

// Remove duplicate import block if any
out = out.replace(
  /import \{\n  IMP_ACTUAL_KEY,[\s\S]*?from "\.\/montaje-turnos"\n/,
  "",
)

out = out.replace(/function formatTimerHms[\s\S]*?\n\}\n\n/, "")

// persist: use PUT orden-trabajo instead of PATCH printing-control
out = out.replace(
  /await apiFetch\(`work-orders\/\$\{workOrderId\}\/orden-trabajo`, \{\n          method: "PATCH",[\s\S]*?notify_on_production_save: true,\n          \}\),\n        \}\)/,
  `await apiFetch(\`work-orders/\${workOrderId}/orden-trabajo\`, {
          method: "PUT",
          body: JSON.stringify({
            form: normalizedForm,
            origin_area: "montaje",
            notify_on_production_save: true,
          }),
        })`,
)

out = out.replace(/printingOnlyForm[\s\S]*?Object\.entries\(normalizedForm\)\.filter\(\(\[k\]\) => k && k\.startsWith\("imp"\)\),[\s\S]*?\n\n/, "")

out = out.replace(
  /const normalizedForm: Record<string, unknown> = \{[\s\S]*?impAcumuladoProducidoKg: normalizeNumericString\(accFromJson\.producidoKg\),\n      \}/,
  `const normalizedForm: Record<string, unknown> = {
        ...src,
        [MON_TURNOS_KEY]: closedP,
        [MON_ACTUAL_KEY]: actualP,
        [MON_ESTADO_KEY]: readEstadoArea(src[MON_ESTADO_KEY]),
        montKgProduccion: normalizeNumericString(actualP?.kgProduccion ?? src.montKgProduccion),
        montMermaKg: normalizeNumericString(actualP?.mermaKg ?? src.montMermaKg),
        montMetraje: normalizeNumericString(actualP?.metrajeMontaje ?? src.montMetraje),
        montTimerEffectiveAccSec: normalizeNumericString(src.montTimerEffectiveAccSec),
        montTimerDeadAccSec: normalizeNumericString(src.montTimerDeadAccSec),
        montRegistrosTurnos: String(accFromJson.turnosRegistrados),
        montAcumuladoProducidoKg: normalizeNumericString(accFromJson.producidoKg),
      }`,
)

// Strip bobina series from persist validation
out = out.replace(
  /const eb = getNumericSeries[\s\S]*?const sm = getMetaSeries[\s\S]*?\n\n/,
  "",
)

out = out.replace(
  /Montaje: complete turno/g,
  "Montaje: complete turno",
)

out = out.replace(/Devolución rechazada[\s\S]*?return\n      \}/g, "")

// Remove warehouse state and functions - large blocks - use regex
out = out.replace(/const \[returnWarehouseOpen[\s\S]*?bobinaCode: "",\n  \}\)/m, "")
out = out.replace(/const \[returnLoadingMaterialsGood[\s\S]*?returnMaterialOptionsBad, setReturnMaterialOptionsBad\] = useState<MaterialRow\[\]\(\[\]\)/m, "")
out = out.replace(/devolucionesPendienteAlmacen[\s\S]*?form\.impDevolucionesAlmacenSnapRech,\n  \]\)/m, "const devolucionesPendienteAlmacen = false")

// Simplify metrics
out = out.replace(
  /const entradaBobinas[\s\S]*?const refilPct = materialConsumido[\s\S]*?100 : 0\n/,
  `const kgProduccionTurno = readNumber(form.montKgProduccion)
  const mermaTurno = readNumber(form.montMermaKg)
  const metrajeTurno = readNumber(form.montMetraje)
`,
)

out = out.replace(
  /const pedidoTotalKg[\s\S]*?const ultimoTurnoLabel = hasHistoricalPrinting[\s\S]*?: formUltimoTurnoLabel\n/,
  `const pedidoTotalKg = readNumber(form.pedidoKg ?? prefill.pedidoKg)
  const jsonAccum = useMemo(
    () => accumulateMontajeFromJson(closedTurnos, activeTurno),
    [closedTurnos, activeTurno],
  )
  const producidoAcumuladoKg = readNumber(form.montAcumuladoProducidoKg) > 0
    ? readNumber(form.montAcumuladoProducidoKg)
    : jsonAccum.producidoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = jsonAccum.turnosRegistrados
  const totalProduccionAcumulada = jsonAccum.producidoKg
  const totalMermaAcumulada = closedTurnos.reduce((a, t) => a + readNumber(t.mermaKg), 0) + (activeTurno ? readNumber(activeTurno.mermaKg) : 0)
  const formUltimoTurnoLabel = hasActiveTurno ? "Turno en curso" : jsonAccum.ultimoCierreLabel
  const ultimoTurnoLabel = formUltimoTurnoLabel
`,
)

out = out.replace(/const kgHora = effectiveSec > 0 \? \(totalSalida \/ \(effectiveSec \/ 3600\)\)/, "const kgHora = effectiveSec > 0 ? (kgProduccionTurno / (effectiveSec / 3600))")

// Remove label editor functions
out = out.replace(/function openLabelEditor[\s\S]*?function saveLabelEditor[\s\S]*?\n  \}\n\n/g, "")
out = out.replace(/function handleReturnWarehouseOpenChange[\s\S]*?async function submitReturn[\s\S]*?\n  \}\n\n/g, "")

// Remove desperdicio preview function body
out = out.replace(/function openDesperdicioPreview\(\) \{[\s\S]*?\n  \}\n\n/g, "")

// Fix cerrar turno empty check
out = out.replace(
  /sumProduccionKg\(cur\) === 0 &&\n      sumProduccionKg\(cur\) === 0/,
  "sumProduccionKg(cur) === 0",
)

out = out.replace(
  /finalizeTurnTimerNow\(cur\.timer\)[\s\S]*?sumEntradaKg\(cur\) === 0/,
  (m) => m.replace("sumEntradaKg(cur) === 0", "sumProduccionKg(cur) === 0"),
)

// OpsSection props - replace large block
const opsStart = out.indexOf("<WorkOrderMontajeOpsSection")
const opsEnd = out.indexOf("/>", opsStart) + 2
// Find closing of WorkOrderMontajeOpsSection - it's self-closing with many props - actually it's multiline until />

// Replace WorkOrderMontajeOpsSection props block with simplified version
out = out.replace(
  /<WorkOrderMontajeOpsSection[\s\S]*?devolucionesPendienteAlmacen=\{devolucionesPendienteAlmacen\}\n      \/>/,
  `<WorkOrderMontajeOpsSection
        pedidoTotalKg={pedidoTotalKg}
        producidoAcumuladoKg={producidoAcumuladoKg}
        faltanteKg={faltanteKg}
        turnosRegistrados={turnosRegistrados}
        totalProduccionAcumulada={totalProduccionAcumulada}
        kgProduccionTurno={kgProduccionTurno}
        totalMermaAcumulada={totalMermaAcumulada}
        ultimoTurnoLabel={ultimoTurnoLabel}
        timerState={timerState}
        totalSec={totalSec}
        deadSec={deadSec}
        effectiveSec={effectiveSec}
        kgHora={kgHora}
        timerRunning={timerRunning}
        timerPaused={timerPaused}
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
        kgProduccionRaw={readNumberString(form.montKgProduccion)}
        mermaRaw={readNumberString(form.montMermaKg)}
        metrajeRaw={readNumberString(form.montMetraje)}
        formatTimerHms={formatTimerHms}
        setPauseReason={setPauseReason}
        setPauseObs={setPauseObs}
        startProductionTimer={startProductionTimer}
        pauseProductionTimer={requestPauseProductionTimer}
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
        onSetTurno={(v) => patchActiveTurn((t) => ({ ...t, turno: v }))}
        onSetGrupo={(v) => patchActiveTurn((t) => ({ ...t, grupo: v }))}
        onActivePersonnelApply={(people) => {
          const { operador, ayudante, supervisor } = stringsFromActivePersonnel(people)
          patchActiveTurn((t) => ({ ...t, operador, ayudante, supervisor }))
        }}
        onSetKgProduccion={(v) => patchActiveTurn((t) => ({ ...t, kgProduccion: v }))}
        onSetMerma={(v) => patchActiveTurn((t) => ({ ...t, mermaKg: v }))}
        onSetMetraje={(v) => patchActiveTurn((t) => ({ ...t, metrajeMontaje: v }))}
        canPreviewTimerReport={canPreviewTimerReport}
        onPreviewTimerReport={requestOpenTimerReportPreview}
        canResetAll={!saving && !controlReadOnly}
        onResetAll={requestResetAll}
      />`,
)

// Create montaje-mes-band-status if missing
const bandPath = path.join(process.cwd(), "src", "lib", "montaje-mes-band-status.ts")
if (!fs.existsSync(bandPath)) {
  fs.writeFileSync(
    bandPath,
    `export const MONTAJE_CONTROL_SAVED_EVENT = "axones.montaje.control.saved"\n`,
  )
}

fs.writeFileSync(path.join(root, "WorkOrderMontajeControlPanel.tsx"), out)
console.log("Wrote control panel", out.length)
