<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Inventario por area - stock final del dia</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        h1 { margin: 0 0 8px; font-size: 18px; }
        .meta { margin-bottom: 12px; font-size: 11px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #d0d0d0; padding: 6px 5px; text-align: left; }
        th { background: #f5f5f5; }
        .num { text-align: right; white-space: nowrap; }
        .totals th { background: #ececec; }
    </style>
</head>
<body>
    <h1>Inventario por area - stock final del dia</h1>
    <div class="meta">
        <div><strong>Fecha reporte:</strong> {{ $report['report_date'] ?? '' }}</div>
        <div><strong>Area:</strong> {{ $report['area_label'] ?? 'Todas las areas' }}</div>
        <div><strong>Generado por:</strong> {{ $generatedBy }}</div>
        <div><strong>Generado en:</strong> {{ $generatedAt }}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Area</th>
                <th class="num">Micras (u)</th>
                <th class="num">Ancho (mm)</th>
                <th>Unidad</th>
                <th class="num">Stock final dia</th>
            </tr>
        </thead>
        <tbody>
        @forelse(($report['rows'] ?? []) as $row)
            <tr>
                <td>{{ $row['sku'] ?? '' }}</td>
                <td>{{ $row['name'] ?? '' }}</td>
                <td>{{ $row['inventory_area'] ?? '' }}</td>
                <td class="num">{{ $row['micras'] ?? '-' }}</td>
                <td class="num">{{ $row['ancho'] ?? '-' }}</td>
                <td>{{ $row['unit'] ?? '' }}</td>
                <td class="num">{{ $row['stock_final_dia'] ?? '0.000' }}</td>
            </tr>
        @empty
            <tr>
                <td colspan="7">Sin datos para la fecha/area seleccionada.</td>
            </tr>
        @endforelse
        </tbody>
        <tfoot class="totals">
            <tr>
                <th colspan="6">Totales</th>
                <th class="num">{{ $report['totals']['stock_final_dia'] ?? '0.000' }}</th>
            </tr>
        </tfoot>
    </table>
</body>
</html>
