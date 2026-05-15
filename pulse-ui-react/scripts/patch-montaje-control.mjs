import fs from "node:fs"
import path from "node:path"

const file = path.join(process.cwd(), "src", "pages", "axones", "WorkOrderMontajeControlPanel.tsx")
let s = fs.readFileSync(file, "utf8")

const pairs = [
  ["WorkOrderPrintingControlPanel", "WorkOrderMontajeControlPanel"],
  ["WorkOrderPrintingOpsSection", "WorkOrderMontajeOpsSection"],
  ["./WorkOrderPrintingOpsSection", "./WorkOrderMontajeOpsSection"],
  ["./printing-turnos", "./montaje-turnos"],
  ["@/lib/printing-mes-band-status", "@/lib/montaje-mes-band-status"],
  ["PRINTING_CONTROL_SAVED_EVENT", "MONTAJE_CONTROL_SAVED_EVENT"],
  ["PrintingTurnoEntry", "MontajeTurnoEntry"],
  ["PrintingTurnTimer", "MontajeTurnTimer"],
  ["PrintingPauseEntry", "MontajePauseEntry"],
  ["IMP_TURNOS_KEY", "MON_TURNOS_KEY"],
  ["IMP_ACTUAL_KEY", "MON_ACTUAL_KEY"],
  ["IMP_ESTADO_KEY", "MON_ESTADO_KEY"],
  ["bootstrapPrintingFormState", "bootstrapMontajeFormState"],
  ["clearPrintingMirrorKeys", "clearMontajeMirrorKeys"],
  ["createNewPrintingTurno", "createNewMontajeTurno"],
  ["parsePrintingTurnoActual", "parseMontajeTurnoActual"],
  ["parsePrintingTurnos", "parseMontajeTurnos"],
  ["printingTurnoToMirror", "montajeTurnoToMirror"],
  ["accumulatePrintingFromJson", "accumulateMontajeFromJson"],
  ["LOCAL_PRINTING_DRAFT_PREFIX", "LOCAL_MONTAJE_DRAFT_PREFIX"],
  ["MesPrintingConfirmDialog", "MesMontajeConfirmDialog"],
  ["MesPrintingConfirmTone", "MesMontajeConfirmTone"],
  ["MES_PRINTING_CONFIRM", "MES_MONTAJE_CONFIRM"],
  ["mesPrintingToastSuccess", "mesMontajeToastSuccess"],
  ["mesPrintingToastWarning", "mesMontajeToastWarning"],
  ["persistPrintingForm", "persistMontajeForm"],
  ["persistPrintingFormCb", "persistMontajeFormCb"],
  ["impObsTextareaId", "montObsTextareaId"],
  ["impTimerState", "montTimerState"],
  ["impTimerEffectiveAccSec", "montTimerEffectiveAccSec"],
  ["impTimerDeadAccSec", "montTimerDeadAccSec"],
  ["impTimerLastResumeAtMs", "montTimerLastResumeAtMs"],
  ["impTimerPauseAtMs", "montTimerPauseAtMs"],
  ["impTimerPauses", "montTimerPauses"],
  ["impTimerStartedAtMs", "montTimerStartedAtMs"],
  ["impTurno", "montTurno"],
  ["impGrupo", "montGrupo"],
  ["impOperador", "montOperador"],
  ["impAyudante", "montAyudante"],
  ["impSupervisor", "montSupervisor"],
  ["impObservaciones", "montObservaciones"],
  ["impAcumuladoProducidoKg", "montAcumuladoProducidoKg"],
  ["impRegistrosTurnos", "montRegistrosTurnos"],
  ["impMermaKg", "montMermaKg"],
  ["impMetrajeProduccion", "montMetraje"],
  ["requestFinalizarAreaImpresion", "requestFinalizarAreaMontaje"],
  ["confirmFinalizarAreaImpresion", "confirmFinalizarAreaMontaje"],
  ["finalizarAreaImpresion", "finalizarAreaMontaje"],
  ["onFinalizarAreaImpresion", "onFinalizarAreaMontaje"],
  ["Área de impresión", "Área de montaje"],
  ["control de impresión", "control de montaje"],
  ["Control de impresión", "Control de montaje"],
  ["Impresión:", "Montaje:"],
  ["Impresión ", "Montaje "],
  ["impresión", "montaje"],
  ["Impresión", "Montaje"],
  ["origin_area: \"impresion\"", "origin_area: \"montaje\""],
  ["/impresion/temporizador", "/montaje/temporizador"],
  ["axones.printing.timer-preview", "axones.montaje.timer-preview"],
  ["printing-control", "orden-trabajo"],
  ["Iniciar cronómetro (Impresión)", "Iniciar cronómetro (Montaje)"],
  ["Reiniciar impresión", "Reiniciar montaje"],
  ["para Impresión", "para Montaje"],
  ["(Impresión)", "(Montaje)"],
  ["sumSalidaKg", "sumProduccionKg"],
  ["sumEntradaKg", "sumProduccionKg"],
]

for (const [a, b] of pairs) s = s.split(a).join(b)

// imports cleanup
s = s.replace(
  /import type \{ LaravelPaginated, MaterialRow \} from "@\/types\/api"\n/,
  "",
)
s = s.replace(
  /import WorkOrderMontajeOpsSection, \{[\s\S]*?BobinaLabelMeta,[\s\S]*?\} from "\.\/WorkOrderMontajeOpsSection"\n/,
  `import WorkOrderMontajeOpsSection, {
  type DraftPerson,
  type DraftPersonRole,
  stringsFromActivePersonnel,
} from "./WorkOrderMontajeOpsSection"
`,
)
s = s.replace(
  /import \{[\s\S]*?PRINTING_REJECT_REASONS,[\s\S]*?\} from "\.\/montaje-turnos"\n/,
  `import {
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
`,
)

s = s.replace(/type ProductionSummaryPayload[\s\S]*?type InventoryReturnCreated[\s\S]*?\n\n/, "")
s = s.replace(/type PrintingPauseEntry[\s\S]*?\n\n/, "type MontajePauseEntry = { at: string; reason: string; obs: string; duration_sec: number }\n\n")

// Remove bobina helpers
s = s.replace(/function getNumericSeries[\s\S]*?function formatTimerHms[\s\S]*?\n\}\n\n/, "")

// Remove production summary state and load block
s = s.replace(/const \[productionSummary, setProductionSummary\][\s\S]*?setProductionSummary\(null\)\n      \}/, "}")

// Remove historical block in metrics (from summaryPrinting through ultimoTurnoLabel assignment)
s = s.replace(
  /const summaryPrinting = productionSummary\?\.printing[\s\S]*?const ultimoTurnoLabel = hasHistoricalPrinting[\s\S]*?: formUltimoTurnoLabel\n/,
  `const jsonAccum = useMemo(
    () => accumulateMontajeFromJson(closedTurnos, activeTurno),
    [closedTurnos, activeTurno],
  )
  const producidoAcumuladoKg =
    readNumber(form.montAcumuladoProducidoKg) > 0
      ? readNumber(form.montAcumuladoProducidoKg)
      : jsonAccum.producidoKg
  const faltanteKg = Math.max(0, pedidoTotalKg - producidoAcumuladoKg)
  const turnosRegistrados = jsonAccum.turnosRegistrados
  const totalProduccionAcumulada = jsonAccum.producidoKg
  const totalMermaAcumulada =
    closedTurnos.reduce((acc, t) => acc + readNumber(t.mermaKg), 0) +
    (activeTurno ? readNumber(activeTurno.mermaKg) : 0)
  const ultimoTurnoLabel = hasActiveTurno ? "Turno en curso" : jsonAccum.ultimoCierreLabel
`,
)

// Remove duplicate jsonAccum if exists
s = s.replace(
  /const jsonAccum = useMemo\(\n    \(\) => accumulateMontajeFromJson\(closedTurnos, activeTurno\),\n    \[closedTurnos, activeTurno\],\n  \)\n\n  const patchActiveTurn/,
  "const patchActiveTurn",
)

// Replace bobina metrics with simple
s = s.replace(
  /const entradaBobinas[\s\S]*?const ultimoTurnoLabel = hasActiveTurno/,
  `const kgProduccionTurno = readNumber(form.montKgProduccion)
  const mermaTurno = readNumber(form.montMermaKg)
  const ultimoTurnoLabel = hasActiveTurno`,
)

s = s.replace(/const kgHora = effectiveSec > 0 \? \(totalSalida \/ \(effectiveSec \/ 3600\)\)/, "const kgHora = effectiveSec > 0 ? (kgProduccionTurno / (effectiveSec / 3600))")

// Remove warehouse state
s = s.replace(/const \[returnWarehouseOpen[\s\S]*?bobinaCode: "",\n  \}\)\n/, "")
s = s.replace(/const \[returnLoadingMaterialsGood[\s\S]*?setReturnMaterialOptionsBad\] = useState<MaterialRow\[\]\(\[\]\)\n/, "")
s = s.replace(/const devolucionesPendienteAlmacen[\s\S]*?form\.impDevolucionesAlmacenSnapRech,\n  \]\)\n/, "")

// pause reasons for montaje
s = s.replace(
  /const pauseReasons = \[[\s\S]*?"Otro",\n  \]/,
  `const pauseReasons = [
    "Ajuste de cilindros",
    "Cambio de cliché",
    "Falla mecánica",
    "Falla eléctrica",
    "Problema de registro",
    "Problema de calidad",
    "Falta de material",
    "Almuerzo/Descanso",
    "Otro",
  ]`,
)

// persist function - replace body
s = s.replace(
  /async function persistMontajeForm\([\s\S]*?\n  \)\n\n  \/\/ Wrapper estable/,
  `async function persistMontajeForm(srcBase?: Record<string, unknown>) {
    const src = srcBase ?? form
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return

    const act = parseMontajeTurnoActual(src[MON_ACTUAL_KEY])
    if (act) {
      const operador = act.operador.trim()
      const turno = act.turno
      const grupo = act.grupo
      if (!operador || !turno || !grupo) {
        toast.error("Montaje: complete turno, grupo y operador antes de guardar.")
        return
      }
    }

    const closedP = parseMontajeTurnos(src[MON_TURNOS_KEY])
    const actualP = parseMontajeTurnoActual(src[MON_ACTUAL_KEY])
    const accFromJson = accumulateMontajeFromJson(closedP, actualP)

    const normalizedForm: Record<string, unknown> = {
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
    }

    setSaving(true)
    try {
      await apiFetch(\`work-orders/\${workOrderId}/orden-trabajo\`, {
        method: "PUT",
        body: JSON.stringify({
          form: normalizedForm,
          origin_area: "montaje",
          notify_on_production_save: true,
        }),
      })
      mesMontajeToastSuccess("Control de montaje guardado.")
      window.dispatchEvent(
        new CustomEvent(MONTAJE_CONTROL_SAVED_EVENT, { detail: { workOrderId } }),
      )
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar control de montaje.")
    } finally {
      setSaving(false)
    }
  }

  // Wrapper estable`,
)

// Remove devolucion validation in cerrar/finalizar
s = s.replace(/const rechCierre[\s\S]*?toast\.error\("Devolución rechazada[\s\S]*?return\n    \}\n/g, "")
s = s.replace(/const rechFin[\s\S]*?toast\.error\("Devolución rechazada[\s\S]*?return\n      \}\n/g, "")

// empty shift close check
s = s.replace(
  /sumProduccionKg\(cur\) === 0 &&\n      sumProduccionKg\(cur\) === 0/,
  "sumProduccionKg(cur) === 0",
)
s = s.replace(/sumProduccionKg\(cur\) === 0 &&\n      sumProduccionKg\(cur\) === 0/, "sumProduccionKg(cur) === 0")

// Remove label editor and warehouse functions
s = s.replace(/function openLabelEditor[\s\S]*?function saveLabelEditor[\s\S]*?\n  \}\n\n/g, "")
s = s.replace(/function handleReturnWarehouseOpenChange[\s\S]*?async function submitReturn[\s\S]*?\n  \}\n\n/g, "")
s = s.replace(/function openDesperdicioPreview\(\) \{[\s\S]*?\n  \}\n\n/g, "")
s = s.replace(/function canPreviewDesperdicioReport[\s\S]*?onPreviewDesperdicioReport=\{openDesperdicioPreview\}\n/g, "")

// Replace WorkOrderMontajeOpsSection block
const opsMatch = s.match(/<WorkOrderMontajeOpsSection[\s\S]*?\/>\n/)
if (opsMatch) {
  const replacement = `<WorkOrderMontajeOpsSection
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
      />
`
  s = s.replace(opsMatch[0], replacement)
}

// create band status file
const band = path.join(process.cwd(), "src", "lib", "montaje-mes-band-status.ts")
if (!fs.existsSync(band)) {
  fs.writeFileSync(band, `export const MONTAJE_CONTROL_SAVED_EVENT = "axones-montaje-control-saved"\n`)
}

fs.writeFileSync(file, s)
console.log("patched", file.length)
