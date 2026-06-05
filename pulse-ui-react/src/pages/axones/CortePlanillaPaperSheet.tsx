import type { CortePlanillaSheet } from "@/lib/corte-planilla-preview"
import { PALETA_COLS } from "@/lib/corte-planilla-preview"
import { AxonesBrandMark } from "@/components/axones/AxonesBrandMark"
import "./printing-planilla-paper.css"

const ENTRADA_SLOTS = 14

function fmtKgDisplay(n: number, decimals = 2): string {
  if (n <= 0) return ""
  return n.toFixed(decimals).replace(".", ",")
}

function fmtKgTotal(n: number): string {
  if (n <= 0) return ""
  return `${n.toFixed(2).replace(".", ",")} KG.`
}

function turnoMark(sheet: CortePlanillaSheet, key: "D" | "1" | "2" | "3"): boolean {
  if (key === "D") return sheet.turno_diurno
  if (sheet.turno_grupo === key) return true
  if (key === "2" && sheet.turno_nocturno && !sheet.turno_grupo) return true
  return false
}

function SectionSubmeta({ sheet }: { sheet: CortePlanillaSheet }) {
  return (
    <table className="pp-block-meta">
      <tbody>
        <tr>
          <th>N°. de pesaje</th>
          <td className="pp-field-line">{sheet.num_pesaje || ""}</td>
          <th>Apertura</th>
          <td className="pp-field-line">{sheet.apertura || ""}</td>
          <th>Cierre</th>
          <td className="pp-field-line">{sheet.cierre || ""}</td>
        </tr>
        <tr>
          <th>N° de orden de trabajo</th>
          <td colSpan={2} className="pp-field-line">
            {sheet.work_order_code}
          </td>
          <th>Producto</th>
          <td colSpan={2} className="pp-field-line">
            {sheet.product || ""}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

type Props = {
  sheet: CortePlanillaSheet
  sheetIndex: number
  sheetTotal: number
}

export function CortePlanillaPaperSheet({ sheet, sheetIndex, sheetTotal }: Props) {
  const entradaCells = Array.from({ length: ENTRADA_SLOTS }, (_, i) => sheet.entrada_bobinas[i] ?? "")

  return (
    <article className="printing-planilla-paper-page" aria-label={`Planilla corte turno ${sheetIndex + 1}`}>
      {sheetTotal > 1 ? (
        <div className="pp-sheet-badge">
          Turno {sheetIndex + 1} de {sheetTotal} · {sheet.turno_label}
        </div>
      ) : null}

      <header className="pp-doc-header">
        <div className="pp-doc-logo-wrap">
          <AxonesBrandMark
            className="pp-doc-logo-mark size-auto h-9 w-[76px]"
            imgClassName="max-h-9 object-contain object-left"
          />
          <p className="pp-doc-logo-caption">Inversiones Axones 2008, c.a</p>
        </div>
        <div className="pp-doc-center">
          <p className="pp-doc-company">Inversiones Axones 2008, c.a</p>
          <h1 className="pp-doc-title">Control de producción corte</h1>
        </div>
      </header>

      <div className="pp-head-block">
        <div className="pp-head-main">
          <table className="pp-head-table">
            <tbody>
              <tr>
                <th className="pp-head-label">Turno</th>
                <td className="pp-head-turno">
                  {(["D", "1", "2", "3"] as const).map((k, i) => (
                    <span key={k} className="pp-turno-opt">
                      {i === 2 ? "/" : ""}
                      <span className={`pp-turno-box${turnoMark(sheet, k) ? " is-marked" : ""}`}>{k}</span>
                      .-
                    </span>
                  ))}
                </td>
                <th className="pp-head-label">Producto</th>
                <td colSpan={3} className="pp-field-line pp-head-producto">
                  {sheet.product || ""}
                </td>
              </tr>
              <tr>
                <th className="pp-head-label">Máquina</th>
                <td colSpan={2} className="pp-field-line">
                  <span className="pp-inline-fixed">Permaco</span>
                  <span className="pp-inline-val">{sheet.maquina_numero || ""}</span>
                </td>
                <th className="pp-head-label">Fecha</th>
                <td className="pp-head-fecha pp-field-line">
                  <span>{sheet.fecha_d || ""}</span>
                  <span className="pp-fecha-sep">,</span>
                  <span>{sheet.fecha_m || ""}</span>
                  <span className="pp-fecha-sep">,</span>
                  <span>{sheet.fecha_a || ""}</span>
                </td>
              </tr>
              <tr>
                <th className="pp-head-label">Hora de inicio</th>
                <td className="pp-field-line">{sheet.hora_inicio || ""}</td>
                <th className="pp-head-label">Hora de arranq.</th>
                <td className="pp-field-line">{sheet.hora_arranque || ""}</td>
                <th className="pp-head-label">Hora final</th>
                <td className="pp-field-line">{sheet.hora_final || ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <aside className="pp-head-sidebar">
          <div className="pp-sidebar-row">
            <span className="pp-sidebar-label">Orden de trabajo</span>
            <span className="pp-sidebar-value pp-field-line">{sheet.work_order_code}</span>
          </div>
          <div className="pp-sidebar-row">
            <span className="pp-sidebar-label">Operador</span>
            <span className="pp-sidebar-value pp-field-line">{sheet.operador || ""}</span>
          </div>
          <div className="pp-sidebar-row">
            <span className="pp-sidebar-label">Ayudante</span>
            <span className="pp-sidebar-value pp-field-line">{sheet.ayudante || ""}</span>
          </div>
          <div className="pp-sidebar-row">
            <span className="pp-sidebar-label">Máquina</span>
            <span className="pp-sidebar-value pp-field-line">{sheet.maquina_sidebar || ""}</span>
          </div>
          <div className="pp-sidebar-row">
            <span className="pp-sidebar-label">Supervisor</span>
            <span className="pp-sidebar-value pp-field-line">{sheet.supervisor || ""}</span>
          </div>
        </aside>
      </div>

      <div className="pp-section-title">Ingreso de bobinas madres (láminas)</div>
      <div className="pp-ingreso-wrap">
        <div className="pp-ingreso-grid">
          {entradaCells.map((val, idx) => (
            <div key={`in-${idx}`} className="pp-ingreso-cell">
              <span className="pp-ingreso-num">{idx + 1}.-</span>
              <span className="pp-ingreso-val">{val}</span>
            </div>
          ))}
        </div>
        <div className="pp-ingreso-total">
          <span>TOTAL:</span>
          <span className="pp-total-box">{fmtKgTotal(sheet.total_entrada_kg)}</span>
        </div>
      </div>

      <div className="pp-mid">
        <div className="pp-mid-col">
          <div className="pp-mid-hdr">Resumen de pesaje</div>
          <SectionSubmeta sheet={sheet} />
          <table className="pp-corte-paleta-table w-full">
            <thead>
              <tr>
                <th className="pp-proc">Proceso</th>
                {Array.from({ length: PALETA_COLS }, (_, i) => (
                  <th key={`col-${i}`}>{i + 1}</th>
                ))}
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sheet.paleta_grid.map((row, rowIdx) => (
                <tr key={`row-${rowIdx}`}>
                  <td className="pp-proc">PRODUCTO TERMINADO</td>
                  {row.map((val, colIdx) => (
                    <td key={`cell-${rowIdx}-${colIdx}`}>{val}</td>
                  ))}
                  <td>{sheet.paleta_row_totals[rowIdx] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pp-pesaje-total">
            <span>TOTAL:</span>
            <span className="pp-total-box">{fmtKgTotal(sheet.total_salida_kg)}</span>
          </div>
          <div className="pp-scrap-block">
            <div className="pp-scrap-title">Scrap</div>
            <div className="pp-scrap-rows">
              <div className="pp-scrap-item">
                <span className="pp-scrap-label">Refile:</span>
                <span className="pp-scrap-value pp-field-line">
                  {sheet.scrap_refile_kg > 0 ? `${fmtKgDisplay(sheet.scrap_refile_kg)} kg` : ""}
                </span>
              </div>
              <div className="pp-scrap-item">
                <span className="pp-scrap-label">Impreso:</span>
                <span className="pp-scrap-value pp-field-line">
                  {sheet.scrap_impreso_kg > 0 ? `${fmtKgDisplay(sheet.scrap_impreso_kg)} kg` : ""}
                </span>
              </div>
              <div className="pp-scrap-item">
                <span className="pp-scrap-label">Laminado:</span>
                <span className="pp-scrap-value pp-field-line">
                  {sheet.scrap_laminado_kg > 0 ? `${fmtKgDisplay(sheet.scrap_laminado_kg)} kg` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pp-mid-col">
          <div className="pp-mid-hdr">Resumen de paradas</div>
          <SectionSubmeta sheet={sheet} />
          <table className="pp-paradas-summary">
            <thead>
              <tr>
                <th>N° bobinas</th>
                <th>Peso total</th>
                <th>Merma</th>
                <th>Metraje</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{sheet.num_bobinas || ""}</td>
                <td>{sheet.total_salida_kg > 0 ? `${fmtKgDisplay(sheet.total_salida_kg)} Kg.` : ""}</td>
                <td>{sheet.merma_kg > 0 ? `${fmtKgDisplay(sheet.merma_kg)} Kg.` : ""}</td>
                <td>{sheet.metraje_m > 0 ? `${Math.round(sheet.metraje_m)} m` : ""}</td>
              </tr>
            </tbody>
          </table>
          <div className="pp-paradas-lines">
            <p className="pp-paradas-lines-title">Tiempos y motivos de paradas:</p>
            {sheet.paradas_lines.length === 0 ? (
              Array.from({ length: 10 }, (_, i) => <div key={`empty-${i}`} className="pp-paradas-line" />)
            ) : (
              sheet.paradas_lines.map((line, i) => (
                <div key={`p-${i}`} className="pp-paradas-line">
                  {line}
                </div>
              ))
            )}
          </div>
          <div className="pp-times-block">
            <div className="pp-times-title">Tiempos:</div>
            <div className="pp-times-row">
              <div className="pp-time-item">
                <div className="pp-time-label">Muerto</div>
                <div className="pp-time-value pp-field-line">{sheet.tiempo_muerto || ""}</div>
              </div>
              <div className="pp-time-item">
                <div className="pp-time-label">Efectivo</div>
                <div className="pp-time-value pp-field-line">{sheet.tiempo_efectivo || ""}</div>
              </div>
            </div>
            <div className="pp-preparacion">
              <span className="pp-preparacion-label">Preparación:</span>
              <span className="pp-preparacion-value pp-field-line">{sheet.tiempo_preparacion || ""}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
