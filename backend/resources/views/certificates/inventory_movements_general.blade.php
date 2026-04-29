<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Movimientos generales de inventario</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; }
        h1 { margin: 0 0 8px; font-size: 18px; }
        h2 { margin: 14px 0 6px; font-size: 13px; }
        .meta { margin-bottom: 10px; font-size: 10px; color: #333; }
        .kpi { display: inline-block; margin-right: 18px; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #d0d0d0; padding: 5px 4px; text-align: left; vertical-align: top; }
        th { background: #f5f5f5; }
        .num { text-align: right; white-space: nowrap; }
        .small { font-size: 10px; color: #333; }
    </style>
</head>
<body>
    <h1>Movimientos generales de inventario</h1>
    <div class="meta">
        <div><strong>Rango:</strong> {{ $report['from'] ?? '' }} a {{ $report['to'] ?? '' }}</div>
        <div><strong>Filtro tipo:</strong> {{ $report['filters']['movement_type'] ?? 'Todos' }}</div>
        <div><strong>Filtro área:</strong> {{ $report['filters']['inventory_area'] ?? 'Todas' }}</div>
        <div><strong>Filtro origen:</strong> {{ $report['filters']['reference_type'] ?? 'Todos' }}</div>
        <div><strong>Auditoría:</strong> {{ (($report['filters']['invalid_only'] ?? false) === true) ? 'Solo inválidos' : 'Todos' }}</div>
        <div><strong>Generado por:</strong> {{ $generatedBy }}</div>
        <div><strong>Generado en:</strong> {{ $generatedAt }}</div>
    </div>

    <div>
        <div class="kpi"><strong>Entradas:</strong> {{ $report['summary']['entries_total'] ?? '0.000' }}</div>
        <div class="kpi"><strong>Salidas:</strong> {{ $report['summary']['exits_total'] ?? '0.000' }}</div>
        <div class="kpi"><strong>Ajustes manuales:</strong> {{ $report['summary']['adjustment_total'] ?? '0.000' }}</div>
        <div class="kpi"><strong>% Ajustes:</strong> {{ $report['summary']['adjustment_percent'] ?? '0.00' }}%</div>
        <div class="kpi"><strong>Sin referencia válida:</strong> {{ $report['summary']['invalid_reference_count'] ?? 0 }}</div>
    </div>

    <h2>Entradas vs salidas por día</h2>
    <table>
        <thead>
            <tr>
                <th>Período</th>
                <th class="num">Entradas</th>
                <th class="num">Salidas</th>
            </tr>
        </thead>
        <tbody>
        @forelse(($report['entries_vs_exits_by_day'] ?? []) as $row)
            <tr>
                <td>{{ $row['period'] ?? '' }}</td>
                <td class="num">{{ $row['entries_qty'] ?? '0.000' }}</td>
                <td class="num">{{ $row['exits_qty'] ?? '0.000' }}</td>
            </tr>
        @empty
            <tr><td colspan="3">Sin datos.</td></tr>
        @endforelse
        </tbody>
    </table>

    <h2>Entradas vs salidas por semana</h2>
    <table>
        <thead>
            <tr>
                <th>Semana</th>
                <th class="num">Entradas</th>
                <th class="num">Salidas</th>
            </tr>
        </thead>
        <tbody>
        @forelse(($report['entries_vs_exits_by_week'] ?? []) as $row)
            <tr>
                <td>{{ $row['period'] ?? '' }}</td>
                <td class="num">{{ $row['entries_qty'] ?? '0.000' }}</td>
                <td class="num">{{ $row['exits_qty'] ?? '0.000' }}</td>
            </tr>
        @empty
            <tr><td colspan="3">Sin datos.</td></tr>
        @endforelse
        </tbody>
    </table>

    <h2>Top materiales más movidos</h2>
    <table>
        <thead>
            <tr>
                <th>SKU</th>
                <th>Material</th>
                <th>Área</th>
                <th class="num">Cantidad movida</th>
                <th class="num">N° Mov.</th>
            </tr>
        </thead>
        <tbody>
        @forelse(($report['top_materials'] ?? []) as $row)
            <tr>
                <td>{{ $row['sku'] ?? '' }}</td>
                <td>{{ $row['name'] ?? '' }}</td>
                <td>{{ $row['inventory_area'] ?? '' }}</td>
                <td class="num">{{ $row['total_qty'] ?? '0.000' }} {{ $row['unit'] ?? '' }}</td>
                <td class="num">{{ $row['movement_count'] ?? 0 }}</td>
            </tr>
        @empty
            <tr><td colspan="5">Sin datos.</td></tr>
        @endforelse
        </tbody>
    </table>

    <h2>Movimientos sin referencia válida</h2>
    <table>
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>SKU</th>
                <th>Material</th>
                <th>Referencia</th>
                <th class="num">Cantidad</th>
            </tr>
        </thead>
        <tbody>
        @forelse(($report['invalid_references'] ?? []) as $row)
            <tr>
                <td>{{ $row['occurred_at'] ?? '' }}</td>
                <td>{{ $row['movement_type'] ?? '' }}</td>
                <td>{{ $row['sku'] ?? '' }}</td>
                <td>{{ $row['name'] ?? '' }}</td>
                <td>{{ ($row['reference_type'] ?? 'null') }}{{ isset($row['reference_id']) ? ' #'.$row['reference_id'] : '' }}</td>
                <td class="num">{{ $row['quantity'] ?? '0.000' }}</td>
            </tr>
        @empty
            <tr><td colspan="6">Sin movimientos inválidos.</td></tr>
        @endforelse
        </tbody>
    </table>

    <h2>Detalle de movimientos (máx. 500)</h2>
    <table>
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Material</th>
                <th>Área</th>
                <th class="num">Cantidad</th>
                <th>Usuario</th>
                <th>Ref.</th>
            </tr>
        </thead>
        <tbody>
        @forelse(($report['movements'] ?? []) as $row)
            <tr>
                <td>{{ $row['occurred_at'] ?? '' }}</td>
                <td>{{ $row['movement_label'] ?? $row['movement_type'] ?? '' }}</td>
                <td>{{ $row['material_sku'] ?? '' }} {{ $row['material_name'] ?? '' }}</td>
                <td>{{ $row['inventory_area'] ?? '' }}</td>
                <td class="num">{{ $row['quantity'] ?? '0.000' }} {{ $row['unit'] ?? '' }}</td>
                <td>{{ $row['user_name'] ?? '' }}</td>
                <td class="small">{{ $row['reference'] ?? '' }}</td>
            </tr>
        @empty
            <tr><td colspan="7">Sin movimientos en el rango.</td></tr>
        @endforelse
        </tbody>
    </table>
</body>
</html>
