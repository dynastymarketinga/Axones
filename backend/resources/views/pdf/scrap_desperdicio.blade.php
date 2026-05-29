<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reporte de desperdicio</title>
    <style>
      body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #111827; }
      .muted { color: #6b7280; }
      h1 { font-size: 17px; margin: 0 0 6px 0; }
      .meta { margin: 0 0 10px 0; line-height: 1.45; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #e5e7eb; padding: 5px 6px; vertical-align: top; }
      th { background: #f3f4f6; text-align: left; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .small { font-size: 9px; }
    </style>
  </head>
  <body>
    @php
      $fromIso = (string) ($report['from'] ?? '');
      $toIso = (string) ($report['to'] ?? '');
      $fromLabel = $fromIso ? \Carbon\Carbon::parse($fromIso)->format('d/m/Y') : '—';
      $toLabel = $toIso ? \Carbon\Carbon::parse($toIso)->format('d/m/Y') : '—';
      $layout = (string) ($report['layout'] ?? 'detail');
      $substrate = (string) ($report['substrate_group'] ?? 'all');
      $substrateLabel = match ($substrate) {
        'bopp' => 'BOPP',
        'polietileno' => 'Polietileno (PE)',
        'politerlero' => 'Polietileno (PE)',
        'poliestireno' => 'Poliestireno',
        'transparente' => 'Poliestireno',
        'all' => 'Todos los sustratos',
        default => 'Todos los sustratos',
      };
      $layoutLabel = match ($layout) {
        'by_area' => 'Resumen por áreas',
        'by_work_order' => 'Por orden de trabajo',
        'history_kg' => 'Historial kg (planilla)',
        default => 'Detalle por área',
      };
      $areaLabel = [
        'printing' => 'Impresión',
        'laminacion' => 'Laminación',
        'corte' => 'Corte',
        'montaje' => 'Montaje',
      ];
      $statusLabel = static function (?string $s): string {
        $k = strtolower(trim((string) $s));
        return match ($k) {
          'open' => 'Pendiente',
          'in_progress' => 'En proceso',
          'completed' => 'Completada',
          'cancelled' => 'Cancelada',
          default => $s !== null && $s !== '' ? $s : '—',
        };
      };
      $rows = (array) ($report['rows'] ?? []);
      $genAt = $report['generatedAt'] ?? now();
      $genAtLabel = $genAt instanceof \Carbon\CarbonInterface ? $genAt->format('d/m/Y H:i') : (string) $genAt;
    @endphp

    <h1>Reporte de desperdicio</h1>
    <div class="meta muted">
      Período: <strong>{{ $fromLabel }}</strong> — <strong>{{ $toLabel }}</strong><br />
      Vista: <strong>{{ $layoutLabel }}</strong> · Sustrato: <strong>{{ $substrateLabel }}</strong><br />
      Generado por: {{ $report['generatedBy'] ?? '—' }} · {{ $genAtLabel }}
    </div>

    @if ($layout === 'by_area')
      <table>
        <thead>
          <tr>
            <th>Área</th>
            <th class="num">Registros</th>
            <th class="num">Promedio %</th>
            <th class="num">Máx. %</th>
            <th class="num">Mín. %</th>
          </tr>
        </thead>
        <tbody>
          @forelse ($rows as $r)
            <tr>
              <td>{{ $areaLabel[(string) ($r['area'] ?? '')] ?? ($r['area'] ?? '—') }}</td>
              <td class="num">{{ $r['row_count'] ?? '—' }}</td>
              <td class="num">{{ $r['avg_scrap_percent'] ?? '—' }}</td>
              <td class="num">{{ $r['max_scrap_percent'] ?? '—' }}</td>
              <td class="num">{{ $r['min_scrap_percent'] ?? '—' }}</td>
            </tr>
          @empty
            <tr><td colspan="5" class="muted">Sin datos.</td></tr>
          @endforelse
        </tbody>
      </table>
    @elseif ($layout === 'by_work_order')
      <table class="small">
        <thead>
          <tr>
            <th>Código OT</th>
            <th>Cliente</th>
            <th>Producto</th>
            <th>Estatus</th>
            <th class="num">% Impresión</th>
            <th class="num">% Corte</th>
            <th class="num">% Laminación</th>
            <th class="num">% Montaje</th>
          </tr>
        </thead>
        <tbody>
          @forelse ($rows as $r)
            <tr>
              <td>{{ $r['work_order_code'] ?? '—' }}</td>
              <td>{{ $r['client_name'] ?? '—' }}</td>
              <td>{{ $r['product_name'] ?? '—' }}</td>
              <td>{{ $statusLabel($r['work_order_status'] ?? null) }}</td>
              <td class="num">{{ $r['printing_scrap_percent'] ?? '—' }}</td>
              <td class="num">{{ $r['corte_scrap_percent'] ?? '—' }}</td>
              <td class="num">{{ $r['laminacion_scrap_percent'] ?? '—' }}</td>
              <td class="num">{{ $r['montaje_scrap_percent'] ?? '—' }}</td>
            </tr>
          @empty
            <tr><td colspan="8" class="muted">Sin datos.</td></tr>
          @endforelse
        </tbody>
      </table>
    @elseif ($layout === 'history_kg')
      <table class="small">
        <thead>
          <tr>
            <th>Código OT</th>
            <th>Cliente</th>
            <th>Producto</th>
            <th>Sustrato (corte)</th>
            <th>Estatus</th>
            <th class="num">Imp. transp. (kg)</th>
            <th class="num">Imp. impreso (kg)</th>
            <th class="num">Lam. transp. (kg)</th>
            <th class="num">Lam. impreso (kg)</th>
            <th class="num">Laminado (kg)</th>
            <th class="num">Refile (kg)</th>
            <th class="num">Impreso corte (kg)</th>
            <th class="num">Mal corte (kg)</th>
            <th class="num">% Impresión</th>
            <th class="num">% Laminación</th>
            <th class="num">% Corte</th>
            <th class="num">% Montaje</th>
          </tr>
        </thead>
        <tbody>
          @forelse ($rows as $r)
            <tr>
              <td>{{ $r['work_order_code'] ?? '—' }}</td>
              <td>{{ $r['client_name'] ?? '—' }}</td>
              <td>{{ $r['product_name'] ?? '—' }}</td>
              <td>{{ isset($r['corte_desperdicio_sustrato']) && (string) $r['corte_desperdicio_sustrato'] !== '' ? strtoupper((string) $r['corte_desperdicio_sustrato']) : 'AUTO' }}</td>
              <td>{{ $statusLabel($r['work_order_status'] ?? null) }}</td>
              <td class="num">{{ $r['imp_scrap_transparente_kg'] ?? '—' }}</td>
              <td class="num">{{ $r['imp_scrap_impreso_kg'] ?? '—' }}</td>
              <td class="num">{{ $r['lam_scrap_transparente_kg'] ?? '—' }}</td>
              <td class="num">{{ $r['lam_scrap_impreso_kg'] ?? '—' }}</td>
              <td class="num">{{ $r['lam_scrap_laminado_kg'] ?? '—' }}</td>
              <td class="num">{{ $r['cor_scrap_refile_kg'] ?? '—' }}</td>
              <td class="num">{{ $r['cor_scrap_impreso_kg'] ?? '—' }}</td>
              <td class="num">{{ $r['cor_scrap_mal_corte_kg'] ?? '—' }}</td>
              <td class="num">{{ $r['printing_scrap_percent'] ?? '—' }}</td>
              <td class="num">{{ $r['laminacion_scrap_percent'] ?? '—' }}</td>
              <td class="num">{{ $r['corte_scrap_percent'] ?? '—' }}</td>
              <td class="num">{{ $r['montaje_scrap_percent'] ?? '—' }}</td>
            </tr>
          @empty
            <tr><td colspan="17" class="muted">Sin datos.</td></tr>
          @endforelse
        </tbody>
      </table>
    @else
      <table>
        <thead>
          <tr>
            <th>Código OT</th>
            <th>Cliente</th>
            <th>Producto</th>
            <th>Estatus</th>
            <th>Área</th>
            <th class="num">% scrap</th>
          </tr>
        </thead>
        <tbody>
          @forelse ($rows as $r)
            <tr>
              <td>{{ $r['work_order_code'] ?? '—' }}</td>
              <td>{{ $r['client_name'] ?? '—' }}</td>
              <td>{{ $r['product_name'] ?? '—' }}</td>
              <td>{{ $statusLabel($r['work_order_status'] ?? null) }}</td>
              <td>{{ $areaLabel[(string) ($r['area'] ?? '')] ?? ($r['area'] ?? '—') }}</td>
              <td class="num">{{ $r['scrap_percent'] ?? '—' }}</td>
            </tr>
          @empty
            <tr><td colspan="6" class="muted">Sin datos.</td></tr>
          @endforelse
        </tbody>
      </table>
    @endif
  </body>
</html>
