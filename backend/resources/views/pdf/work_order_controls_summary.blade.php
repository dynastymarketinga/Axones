<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Resumen de órdenes de trabajo</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; margin: 16px; }
        h1 { margin: 0 0 6px; font-size: 18px; }
        h2 { margin: 14px 0 6px; font-size: 13px; }
        h3 { margin: 10px 0 4px; font-size: 11px; color: #334155; }
        .meta { margin-bottom: 10px; font-size: 10px; color: #333; }
        .meta div { margin-bottom: 1px; }
        .kpis { margin: 6px 0 12px; }
        .kpi { display: inline-block; margin-right: 14px; margin-bottom: 4px; padding: 4px 8px; border: 1px solid #d0d0d0; background: #f9f9f9; border-radius: 3px; }
        .kpi strong { display: inline-block; margin-right: 4px; }
        .kpi-prod strong { color: #047857; }
        .kpi-down strong { color: #b91c1c; }
        .kpi-mount strong { color: #92400e; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #d0d0d0; padding: 4px 4px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; font-weight: bold; }
        .num { text-align: right; white-space: nowrap; }
        .center { text-align: center; }
        tfoot td { background: #f5f5f5; font-weight: bold; }
        .small { font-size: 10px; color: #555; }
        .empty { color: #64748b; font-style: italic; }
    </style>
</head>
@php
    $fmtSec = function ($s) {
        $s = max(0, (int) ($s ?? 0));
        $h = intdiv($s, 3600);
        $m = intdiv($s % 3600, 60);
        $sec = $s % 60;
        return sprintf('%02d:%02d:%02d', $h, $m, $sec);
    };
    $wo = $report['work_order'] ?? [];
    $times = $report['times'] ?? [];
    $timesByArea = $times['by_area'] ?? [];
    $timeTotals = $times['totals'] ?? [];
    $consumables = $report['consumables']['by_area'] ?? [];
    $ps = $report['production_summary'] ?? [];
    $virgin = $ps['virgin_material'] ?? [];
    $listo = $ps['material_listo'] ?? [];
    $scrap = $ps['scrap'] ?? [];
    $montaje = $ps['montaje_consumo'] ?? [];
    $tintas = $ps['tintas'] ?? [];
    $lamQ = $ps['laminacion_quimicos'] ?? [];
@endphp
<body>
    <h1>Resumen de órdenes de trabajo</h1>
    <div class="meta">
        <div><strong>Orden de trabajo:</strong> {{ $wo['code'] ?? '—' }} (ID #{{ $wo['id'] ?? '—' }})</div>
        <div><strong>Cliente:</strong> {{ $wo['client_name'] ?? '—' }}</div>
        <div><strong>Producto:</strong> {{ $wo['product_name'] ?? '—' }}</div>
        <div><strong>Pedido cliente:</strong> {{ $wo['client_order_code'] ?? '—' }}</div>
        <div><strong>Estado:</strong> {{ $wo['status'] ?? '—' }}</div>
        <div><strong>Generado por:</strong> {{ $generatedBy ?? 'Usuario' }}</div>
        <div><strong>Generado en:</strong> {{ $generatedAt ?? now() }}</div>
    </div>

    <h2>Material virgen consumible</h2>
    <table>
        <tbody>
            <tr>
                <td>Impresión — total entrada (suma controles)</td>
                <td class="num">{{ $virgin['printing_total_entrada_kg'] ?? '0.000' }} kg</td>
            </tr>
            <tr>
                <td>Laminación — material virgen (suma controles)</td>
                <td class="num">{{ $virgin['laminacion_total_virgen_kg'] ?? '0.000' }} kg</td>
            </tr>
        </tbody>
    </table>

    <h2>Material listo</h2>
    <table>
        <thead>
            <tr>
                <th>Concepto</th>
                <th class="num">Valor</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Impreso — Nº bobinas salida</td>
                <td class="num">{{ $listo['impreso']['num_bobinas'] ?? 0 }}</td>
            </tr>
            <tr>
                <td>Impreso — peso total salida</td>
                <td class="num">{{ $listo['impreso']['peso_total_kg'] ?? '0.000' }} kg</td>
            </tr>
            <tr>
                <td>Laminado — peso total salida</td>
                <td class="num">{{ $listo['laminado']['peso_total_salida_kg'] ?? '0.000' }} kg</td>
            </tr>
            <tr>
                <td>Laminado — Nº bobinas</td>
                <td class="num">{{ $listo['laminado']['num_bobinas'] ?? 0 }}</td>
            </tr>
            <tr>
                <td>Corte — kg salida (suma controles)</td>
                <td class="num">{{ $listo['corte_kg_salida'] ?? '0.000' }} kg</td>
            </tr>
            <tr>
                <td><strong>Total listo para despachar (solo corte)</strong></td>
                <td class="num"><strong>{{ $listo['total_listo_despacho_kg'] ?? '0.000' }} kg</strong></td>
            </tr>
            <tr>
                <td><strong>Resumen general (impreso + laminado + corte)</strong></td>
                <td class="num"><strong>{{ $listo['total_general_kg'] ?? '0.000' }} kg</strong></td>
            </tr>
        </tbody>
    </table>

    <h2>Desperdicio (impresión, laminación y corte)</h2>
    <table>
        <thead>
            <tr>
                <th>Área</th>
                <th>Detalle</th>
                <th class="num">Kg</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Impresión</td>
                <td>Transparente / Impreso</td>
                <td class="num">{{ $scrap['printing']['transparente_kg'] ?? '0.000' }} / {{ $scrap['printing']['impreso_kg'] ?? '0.000' }}</td>
            </tr>
            <tr>
                <td>Laminación</td>
                <td>Transparente / Impreso / Laminado</td>
                <td class="num">{{ $scrap['laminacion']['transparente_kg'] ?? '0.000' }} / {{ $scrap['laminacion']['impreso_kg'] ?? '0.000' }} / {{ $scrap['laminacion']['laminado_kg'] ?? '0.000' }}</td>
            </tr>
            <tr>
                <td>Corte</td>
                <td>Refile / Impreso / Mal corte</td>
                <td class="num">{{ $scrap['corte']['refile_kg'] ?? '0.000' }} / {{ $scrap['corte']['impreso_kg'] ?? '0.000' }} / {{ $scrap['corte']['mal_corte_kg'] ?? '0.000' }}</td>
            </tr>
        </tbody>
        <tfoot>
            <tr>
                <td colspan="2">Total desperdicio</td>
                <td class="num">{{ $scrap['grand_total_kg'] ?? '0.000' }} kg</td>
            </tr>
        </tfoot>
    </table>

    <h2>Consumo de montaje</h2>
    @if(! empty($montaje['lines']))
        <table>
            <thead>
                <tr>
                    <th>Sticky back</th>
                    <th>Código</th>
                    <th>Color</th>
                    <th class="num">Cantidad</th>
                </tr>
            </thead>
            <tbody>
                @foreach($montaje['lines'] as $row)
                    <tr>
                        <td>{{ $row['sticky_back'] ?? '—' }}</td>
                        <td>{{ $row['codigo'] ?? '—' }}</td>
                        <td>{{ $row['color'] ?? '—' }}</td>
                        <td class="num">{{ $row['cantidad'] ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @else
        <p class="empty">Sin materiales registrados en montaje.</p>
    @endif

    <h2>Total tintas usadas</h2>
    <table>
        <tbody>
            <tr><td>Total original</td><td class="num">{{ $tintas['total_original_kg'] ?? '0.000' }} kg</td></tr>
            <tr><td>Total solventadas</td><td class="num">{{ $tintas['total_solventadas_kg'] ?? '0.000' }} kg</td></tr>
            <tr><td>Total consumo neto</td><td class="num">{{ $tintas['total_consumed_kg'] ?? '0.000' }} kg</td></tr>
            <tr><td>Alcohol</td><td class="num">{{ $tintas['alcohol_kg'] ?? '0.000' }} kg</td></tr>
            <tr><td>Metoxil</td><td class="num">{{ $tintas['metoxil_kg'] ?? '0.000' }} kg</td></tr>
            <tr><td>NPA</td><td class="num">{{ $tintas['npa_kg'] ?? '0.000' }} kg</td></tr>
        </tbody>
    </table>

    <h2>Consumibles químicos — laminación</h2>
    <table>
        <tbody>
            <tr><td>Adhesivo consumido</td><td class="num">{{ $lamQ['adhesivo_consumido_kg'] ?? '0.000' }} kg</td></tr>
            <tr><td>Catalizador consumido</td><td class="num">{{ $lamQ['catalizador_consumido_kg'] ?? '0.000' }} kg</td></tr>
            <tr><td>Acetato consumido</td><td class="num">{{ $lamQ['acetato_consumido_lt'] ?? '0.000' }} Lt</td></tr>
        </tbody>
    </table>

    <h2>Tiempos (Impresión + Laminación + Corte)</h2>
    <p class="small">Totales de segmentos cerrados del cronómetro de producción en las tres áreas de control.</p>

    <div class="kpis">
        <span class="kpi kpi-prod"><strong>Tiempo efectivo:</strong> {{ $fmtSec($timeTotals['production_seconds'] ?? 0) }}</span>
        <span class="kpi kpi-down"><strong>Tiempo muerto:</strong> {{ $fmtSec($timeTotals['downtime_seconds'] ?? 0) }}</span>
        <span class="kpi kpi-mount"><strong>Montaje y arranque:</strong> {{ $fmtSec($timeTotals['mount_seconds'] ?? 0) }}</span>
        <span class="kpi"><strong>Total:</strong> {{ $fmtSec($timeTotals['total_seconds'] ?? 0) }}</span>
        <span class="kpi"><strong>% efectivo:</strong> {{ $timeTotals['effective_percent'] ?? '0.00' }}%</span>
    </div>

    <table>
        <thead>
            <tr>
                <th>Área</th>
                <th class="num">Tiempo efectivo</th>
                <th class="num">Tiempo muerto</th>
                <th class="num">Montaje y arranque</th>
                <th class="num">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($timesByArea as $row)
                <tr>
                    <td>{{ $row['area_label'] ?? $row['area'] ?? '' }}</td>
                    <td class="num">{{ $fmtSec($row['production_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($row['downtime_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($row['mount_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($row['total_seconds'] ?? 0) }}</td>
                </tr>
            @endforeach
        </tbody>
        @if(! empty($timesByArea))
            <tfoot>
                <tr>
                    <td>Total (3 áreas)</td>
                    <td class="num">{{ $fmtSec($timeTotals['production_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($timeTotals['downtime_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($timeTotals['mount_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($timeTotals['total_seconds'] ?? 0) }}</td>
                </tr>
            </tfoot>
        @endif
    </table>

    <h2>Consumibles por área de control</h2>
    <p class="small">Resumen de bobinas, tintas/químicos (impresión) y solvente (laminación) registrados en los controles de producción.</p>

    @foreach(['printing' => 'Impresión', 'laminacion' => 'Laminación', 'corte' => 'Corte'] as $areaKey => $areaTitle)
        @php $block = $consumables[$areaKey] ?? []; @endphp
        <h3>{{ $areaTitle }}</h3>

        <strong>Bobinas / sustrato</strong>
        @if(! empty($block['bobina_usages']))
            <table>
                <thead>
                    <tr>
                        <th>SKU</th>
                        <th>Material</th>
                        <th class="num">Usado (kg)</th>
                        <th class="num">Terminado (kg)</th>
                        <th>Bobina</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($block['bobina_usages'] as $row)
                        <tr>
                            <td>{{ $row['sku'] ?? '—' }}</td>
                            <td>{{ $row['name'] ?? '—' }}</td>
                            <td class="num">{{ $row['quantity_used_kg'] ?? '0.000' }}</td>
                            <td class="num">{{ $row['quantity_finished_kg'] ?? '0.000' }}</td>
                            <td>{{ $row['bobina_id'] ?? '—' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <p class="empty">Sin registros de bobina.</p>
        @endif

        @if($areaKey === 'printing')
            <strong>Control de tintas</strong>
            @if(! empty($block['ink_control_lines']))
                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Tinta</th>
                            <th class="num">Original</th>
                            <th class="num">Solventada</th>
                            <th class="num">Devolución</th>
                            <th class="num">Consumo neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($block['ink_control_lines'] as $row)
                            <tr>
                                <td>{{ $row['sku'] ?? '—' }}</td>
                                <td>{{ $row['name'] ?? '—' }}</td>
                                <td class="num">{{ $row['quantity_original_kg'] ?? '0.000' }}</td>
                                <td class="num">{{ $row['quantity_solventada_kg'] ?? '0.000' }}</td>
                                <td class="num">{{ $row['quantity_return_kg'] ?? '0.000' }}</td>
                                <td class="num">{{ $row['quantity_consumed_kg'] ?? '0.000' }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @else
                <p class="empty">Sin líneas de tinta.</p>
            @endif

            <strong>Químicos</strong>
            @if(! empty($block['chemical_usages']))
                <table>
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th class="num">Cargado</th>
                            <th class="num">Devolución</th>
                            <th class="num">Consumo neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($block['chemical_usages'] as $row)
                            <tr>
                                <td>{{ ucfirst($row['chemical_type'] ?? '') }}</td>
                                <td class="num">{{ $row['quantity_loaded_kg'] ?? '0.000' }}</td>
                                <td class="num">{{ $row['quantity_return_kg'] ?? '0.000' }}</td>
                                <td class="num">{{ $row['quantity_consumed_kg'] ?? '0.000' }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @else
                <p class="empty">Sin químicos registrados.</p>
            @endif
        @endif

        @if($areaKey === 'laminacion')
            <strong>Solvente</strong>
            <table>
                <tbody>
                    <tr>
                        <td>Cantidad (kg)</td>
                        <td class="num">{{ $block['solvent_quantity_kg'] ?? '0.000' }}</td>
                    </tr>
                    @if(! empty($block['solvent_notes']))
                        <tr>
                            <td>Notas</td>
                            <td>{{ $block['solvent_notes'] }}</td>
                        </tr>
                    @endif
                </tbody>
            </table>
        @endif
    @endforeach

    <p class="small">
        Los tiempos suman segmentos cerrados del cronómetro en Impresión, Laminación y Corte.
        Los consumibles reflejan lo capturado en cada control de producción de la OT (no incluye Montaje ni Tintas como área separada).
    </p>
</body>
</html>
