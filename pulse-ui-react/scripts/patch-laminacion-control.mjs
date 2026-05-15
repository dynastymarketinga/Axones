import fs from "node:fs"
import path from "node:path"

const dir = path.join(process.cwd(), "src/pages/axones")

function patch(file, pairs) {
  const fp = path.join(dir, file)
  let s = fs.readFileSync(fp, "utf8")
  for (const [a, b] of pairs) s = s.split(a).join(b)
  fs.writeFileSync(fp, s)
}

patch("WorkOrderLaminacionControlPanel.tsx", [
  ['import { LAMINACION_CONTROL_SAVED_EVENT } from "@/lib/laminacion-mes-band-status"\n', ""],
  ["  LAM_OBS_KEY,\n", ""],
  ["  finalizeTurnTimerNow,", "  finalizeLaminacionTurnTimerNow,"],
  ["  readEstadoArea,", "  readLaminacionEstadoArea,"],
  [
    "  sumProduccionKg,",
    `  sumSalidaKgTurno,
  sumScrapKgTurno,
  LAM_BOBINAS_SLOTS,
  getMetaSeries,
  getNumericSeries,
  getSustratosLamRows,
  normalizeLaminacionFormForSave,
  normalizeBobinaLabelMeta,
  validateBobinaLabelSave,
  metaKeyForLabelMode,
  emptyBobinaLabelMeta,
  readLamNumber,
  sumSeriesKg,
  computeLamMermaRefil,
  type BobinaLabelMeta,
  type LamLabelEditorMode,`,
  ],
  ["readEstadoArea(", "readLaminacionEstadoArea("],
  ["finalizeTurnTimerNow(", "finalizeLaminacionTurnTimerNow("],
  ["sumProduccionKg(", "sumSalidaKgTurno("],
  ["const LOCAL_MONTAJE_DRAFT_PREFIX", "const LOCAL_LAMINACION_DRAFT_PREFIX"],
  ["LOCAL_MONTAJE_DRAFT_PREFIX", "LOCAL_LAMINACION_DRAFT_PREFIX"],
  ["clearLocalMontajeDrafts", "clearLocalLaminacionDrafts"],
  ["LocalMontajeDraft", "LocalLaminacionDraft"],
  [
    "const kgProduccionTurno = readNumber(form.lamKgProduccion)",
    `const totalSalidaTurno = activeTurno
    ? sumSalidaKgTurno(activeTurno)
    : sumSeriesKg(getNumericSeries(form, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS))`,
  ],
  ["kgProduccionTurno / (effectiveSec", "totalSalidaTurno / (effectiveSec"],
  [
    "kgProduccionTurno, form.lamMermaKg, form.lamMetraje",
    "totalSalidaTurno, form.lamScrapLaminadoKg, form.lamMetrajeProduccion",
  ],
  ["if (kgProduccionTurno > MAX_KG_PRODUCCION)", "if (totalSalidaTurno > MAX_KG_PRODUCCION)"],
  [
    "warnings.push(`Producción del turno elevada (${kgProduccionTurno.toFixed(2)} Kg). Verifique unidad y captura.`)",
    "warnings.push(`Salida del turno elevada (${totalSalidaTurno.toFixed(2)} Kg). Verifique unidad y captura.`)",
  ],
  [
    "const mermaTurno = readNumber(form.lamMermaKg)\n    if (mermaTurno > MAX_MERMA) {\n      warnings.push(`Merma del turno alta (${mermaTurno.toFixed(2)} Kg).`)",
    "const scrapTurno = activeTurno ? sumScrapKgTurno(activeTurno) : readLamNumber(form.lamScrapLaminadoKg)\n    if (scrapTurno > MAX_MERMA) {\n      warnings.push(`Scrap del turno alto (${scrapTurno.toFixed(2)} Kg).`)",
  ],
  ["const metraje = readNumber(form.lamMetraje)", "const metraje = readNumber(form.lamMetrajeProduccion)"],
  [
    `        lamKgProduccion: normalizeNumericString(actualP?.kgProduccion ?? src.lamKgProduccion),
        lamMermaKg: normalizeNumericString(actualP?.mermaKg ?? src.lamMermaKg),
        lamMetraje: normalizeNumericString(actualP?.metrajeLaminacion ?? src.lamMetraje),
`,
    "",
  ],
  [
    `        window.dispatchEvent(
          new CustomEvent(LAMINACION_CONTROL_SAVED_EVENT, { detail: { workOrderId } }),
        )`,
    "",
  ],
  [
    `  const totalMermaAcumulada =
    closedTurnos.reduce((a, t) => a + readNumber(t.mermaKg), 0) +
    (activeTurno ? readNumber(activeTurno.mermaKg) : 0)`,
    "  const totalScrapAcumulada = jsonAccum.scrapKg",
  ],
  ["Cargando control de laminacion", "Cargando control de laminación"],
  ["Laminacion: complete", "Laminación: complete"],
  ["Control de laminacion guardado", "Control de laminación guardado"],
  ["control de laminacion", "control de laminación"],
  ["panel de laminacion", "panel de laminación"],
  ["Iniciar cronómetro (Laminacion)", "Iniciar cronómetro (Laminación)"],
  ["Reiniciar laminacion (OT)", "Reiniciar laminación (OT)"],
  ["registrados en Laminacion", "registrados en Laminación"],
  ["Área de laminacion finalizada", "Área de laminación finalizada"],
  ["finalizar área de laminacion", "finalizar área de laminación"],
  ["Laminacion reiniciado", "Laminación reiniciado"],
  ["montObsTextareaId", "lamObsTextareaId"],
  ["form.montObservaciones", "form.lamObservaciones"],
  ['name="montObservaciones"', 'name="lamObservaciones"'],
  ['if (k.startsWith("montBlockDone."))', 'if (k.startsWith("lamBlockDone."))'],
])

patch("WorkOrderLaminacionOpsSection.tsx", [
  ["WorkOrderMontajeOpsSection", "WorkOrderLaminacionOpsSection"],
  ["montaje-turnos", "laminacion-turnos"],
  ["MON_PAUSE_REASONS", "LAM_PAUSE_REASONS"],
  ["sumProduccionKg", "sumSalidaKgTurno"],
  ["MontajeTurnoEntry", "LaminacionTurnoEntry"],
  ["MontajePauseEntry", "LaminacionPauseEntry"],
  ["personnelLinesFromMontajeTurno", "personnelLinesFromLaminacionTurno"],
  ["montTurno", "lamTurno"],
  ["montGrupo", "lamGrupo"],
  ["montOperador", "lamOperador"],
  ["montAyudante", "lamAyudante"],
  ["montSupervisor", "lamSupervisor"],
  ["onFinalizarAreaMontaje", "onFinalizarAreaLaminacion"],
  ["montDraftPersonName", "lamDraftPersonName"],
  ["montActivePersonName", "lamActivePersonName"],
  ["montKgProduccion", "lamSalidaKg"],
  ["montMermaKg", "lamScrapKg"],
  ["montMetraje", "lamMetrajeProduccion"],
  ["montPauseMotivo", "lamPauseMotivo"],
  ["montPauseObs", "lamPauseObs"],
  ["Área de montaje finalizada", "Área de laminación finalizada"],
  ["área de montaje", "área de laminación"],
  ["esta OT (Montaje)", "esta OT (Laminación)"],
  ["Metraje montaje", "Metraje producción"],
  ["Merma {sumMermaKg", "Salida {sumSalidaKgTurno"],
  ["sumMermaKg(t)", "sumScrapKgTurno(t)"],
  ["kgProduccionTurno", "totalSalidaTurno"],
  ["kgProduccionRaw", "totalSalidaTurno"],
  ["mermaRaw", "scrapLaminadoRaw"],
  ["totalMermaAcumulada", "totalScrapAcumulada"],
  ["onSetKgProduccion", "onSetMetraje"],
  ["onSetMerma", "onSetScrapLaminado"],
  ["Producción del turno", "Salida laminada del turno"],
  ["Kg producción", "Metraje producción"],
])

console.log("patch-laminacion-control: ok")
