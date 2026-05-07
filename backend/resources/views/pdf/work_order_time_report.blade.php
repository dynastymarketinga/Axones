<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Reporte de tiempos de producción</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; margin: 16px; }
        h1 { margin: 0 0 6px; font-size: 18px; }
        h2 { margin: 14px 0 6px; font-size: 13px; }
        .meta { margin-bottom: 10px; font-size: 10px; color: #333; }
        .meta div { margin-bottom: 1px; }
        .kpis { margin: 6px 0 12px; }
        .kpi { display: inline-block; margin-right: 18px; margin-bottom: 4px; padding: 4px 8px; border: 1px solid #d0d0d0; background: #f9f9f9; border-radius: 3px; }
        .kpi strong { display: inline-block; margin-right: 4px; }
        .kpi-prod strong { color: #047857; }
        .kpi-down strong { color: #b91c1c; }
        .kpi-mount strong { color: #92400e; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { border: 1px solid #d0d0d0; padding: 5px 4px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; font-weight: bold; }
        .num { text-align: right; white-space: nowrap; }
        .center { text-align: center; }
        tfoot td { background: #f5f5f5; font-weight: bold; }
        .small { font-size: 10px; color: #555; }
        .area-cell { text-transform: capitalize; }
        .reason-cell { white-space: normal; }
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
    $fmtDate = function ($iso) {
        if ($iso === null || $iso === '') return '—';
        try {
            return \Carbon\Carbon::parse($iso)->format('d/m/Y H:i');
        } catch (\Throwable) {
            return (string) $iso;
        }
    };
    $rangeFromLabel = $fmtDate($report['from'] ?? null);
    $rangeToLabel = $fmtDate($report['to'] ?? null);
    $wo = $report['work_order'] ?? null;
    $totals = $report['totals'] ?? [];
    $summary = $report['summary'] ?? [];
    $downtimes = $report['downtimes'] ?? [];
@endphp
<body>
    <h1>Reporte de tiempos de producción</h1>
    <div class="meta">
        <div><strong>Rango:</strong> {{ $rangeFromLabel }} — {{ $rangeToLabel }}</div>
        @if($wo)
            <div><strong>Orden de trabajo:</strong> {{ $wo['code'] ?? '—' }} (ID #{{ $wo['id'] ?? '—' }})</div>
            <div><strong>Cliente:</strong> {{ $wo['client_name'] ?? '—' }}</div>
            <div><strong>Producto:</strong> {{ $wo['product_name'] ?? '—' }}</div>
            <div><strong>Estado:</strong> {{ $wo['status'] ?? '—' }}</div>
        @else
            <div><strong>Alcance:</strong> Todas las órdenes de trabajo en el rango</div>
        @endif
        <div><strong>Generado por:</strong> {{ $generatedBy ?? 'Usuario' }}</div>
        <div><strong>Generado en:</strong> {{ $generatedAt ?? now() }}</div>
    </div>

    <div class="kpis">
        <span class="kpi kpi-prod"><strong>Tiempo efectivo:</strong> {{ $fmtSec($totals['production_seconds'] ?? 0) }}</span>
        <span class="kpi kpi-down"><strong>Tiempo muerto:</strong> {{ $fmtSec($totals['downtime_seconds'] ?? 0) }}</span>
        <span class="kpi kpi-mount"><strong>Montaje:</strong> {{ $fmtSec($totals['mount_seconds'] ?? 0) }}</span>
        <span class="kpi"><strong>Total:</strong> {{ $fmtSec($totals['total_seconds'] ?? 0) }}</span>
        <span class="kpi"><strong>% efectivo:</strong> {{ $totals['effective_percent'] ?? '0.00' }}%</span>
    </div>

    <h2>Resumen por área</h2>
    <table>
        <thead>
            <tr>
                <th>Área</th>
                <th class="num">Tiempo efectivo</th>
                <th class="num">Tiempo muerto</th>
                <th class="num">Montaje</th>
                <th class="num">Total</th>
                <th class="num">% efectivo</th>
                <th class="num">N° paradas</th>
                <th class="num">N° turnos</th>
            </tr>
        </thead>
        <tbody>
            @forelse($summary as $row)
                <tr>
                    <td class="area-cell">{{ $row['area'] ?? '' }}</td>
                    <td class="num">{{ $fmtSec($row['production_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($row['downtime_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($row['mount_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($row['total_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $row['effective_percent'] ?? '0.00' }}%</td>
                    <td class="num">{{ $row['downtime_count'] ?? 0 }}</td>
                    <td class="num">{{ $row['production_count'] ?? 0 }}</td>
                </tr>
            @empty
                <tr><td colspan="8" class="center">Sin tiempos registrados en el rango.</td></tr>
            @endforelse
        </tbody>
        @if(! empty($summary))
            <tfoot>
                <tr>
                    <td>Total</td>
                    <td class="num">{{ $fmtSec($totals['production_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($totals['downtime_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($totals['mount_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $fmtSec($totals['total_seconds'] ?? 0) }}</td>
                    <td class="num">{{ $totals['effective_percent'] ?? '0.00' }}%</td>
                    <td class="num">{{ count($downtimes) }}</td>
                    <td></td>
                </tr>
            </tfoot>
        @endif
    </table>

    <h2>Detalle de tiempos muertos (paradas)</h2>
    <table>
        <thead>
            <tr>
                <th>OT</th>
                <th>Área</th>
                <th>Máquina</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th class="num">Duración</th>
                <th>Motivo / Observación</th>
                <th>Operador</th>
            </tr>
        </thead>
        <tbody>
            @forelse($downtimes as $row)
                <tr>
                    <td>{{ $row['work_order_code'] ?? ('#'.($row['work_order_id'] ?? '—')) }}</td>
                    <td class="area-cell">{{ $row['area'] ?? '' }}</td>
                    <td>{{ $row['machine_code'] ?? '' }}</td>
                    <td>{{ $fmtDate($row['started_at'] ?? null) }}</td>
                    <td>{{ $fmtDate($row['ended_at'] ?? null) }}</td>
                    <td class="num">{{ $fmtSec($row['duration_seconds'] ?? 0) }}</td>
                    <td class="reason-cell">{{ $row['reason'] !== '' ? $row['reason'] : '—' }}</td>
                    <td>{{ $row['user_name'] ?? '—' }}</td>
                </tr>
            @empty
                <tr><td colspan="8" class="center">Sin paradas registradas en el rango.</td></tr>
            @endforelse
        </tbody>
    </table>

    <p class="small">
        Los tiempos efectivo y muerto provienen de los segmentos cerrados (con hora de inicio y fin)
        del temporizador de producción de cada área. Las observaciones de cada parada se capturan en el panel
        del operador al pausar el turno.
    </p>
</body>
</html>
