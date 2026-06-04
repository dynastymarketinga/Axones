<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reporte general de tiempos por área</title>
    <style>
      body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #111827; }
      .muted { color: #6b7280; }
      h1 { font-size: 18px; margin: 0 0 6px 0; }
      .meta { margin: 0 0 12px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; }
      th { background: #f3f4f6; text-align: left; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .group-row td { background: #fafafa; font-weight: 700; }
    </style>
  </head>
  <body>
    @php
      $fromIso = (string) ($report['from'] ?? '');
      $toIso = (string) ($report['to'] ?? '');
      $fromLabel = $fromIso ? \Carbon\Carbon::parse($fromIso)->format('d/m/Y') : '—';
      $toLabel = $toIso ? \Carbon\Carbon::parse($toIso)->format('d/m/Y') : '—';

      $areaLabel = [
        'printing' => 'Impresión',
        'laminacion' => 'Laminación',
        'corte' => 'Corte',
        'montaje' => 'Montaje',
      ];
      $segLabel = [
        'mount' => 'Montaje',
        'demount' => 'Desmontaje',
        'production' => 'Producción',
        'downtime' => 'Paradas',
      ];
      $segKey = [
        'mount' => 'mount_sec',
        'demount' => 'demount_sec',
        'production' => 'prod_sec',
        'downtime' => 'down_sec',
      ];
      $toHms = function (int $sec): string {
        $sec = max(0, (int) $sec);
        $h = intdiv($sec, 3600);
        $m = intdiv($sec % 3600, 60);
        $s = $sec % 60;
        return sprintf('%02d:%02d:%02d', $h, $m, $s);
      };

      $rows = (array) ($report['rows'] ?? []);
      $agg = [];
      foreach ($rows as $r) {
        $area = (string) ($r['area'] ?? '');
        $machine = (string) ($r['machine_code'] ?? '');
        $type = (string) ($r['segment_type'] ?? '');
        $sec = (int) ($r['total_seconds'] ?? 0);
        $cnt = (int) ($r['segment_count'] ?? 0);
        $k = $area.'|'.$machine;
        if (!isset($agg[$k])) {
          $agg[$k] = [
            'area' => $area,
            'machine_code' => $machine,
            'mount_sec' => 0,
            'demount_sec' => 0,
            'prod_sec' => 0,
            'down_sec' => 0,
            'segment_count' => 0,
          ];
        }
        $agg[$k]['segment_count'] += $cnt;
        if ($type === 'mount') $agg[$k]['mount_sec'] += $sec;
        if ($type === 'demount') $agg[$k]['demount_sec'] += $sec;
        if ($type === 'production') $agg[$k]['prod_sec'] += $sec;
        if ($type === 'downtime') $agg[$k]['down_sec'] += $sec;
      }

      // Orden estable por área y máquina
      $areaOrder = ['montaje' => 0, 'printing' => 1, 'laminacion' => 2, 'corte' => 3];
      $items = array_values($agg);
      usort($items, function ($a, $b) use ($areaOrder) {
        $ao = $areaOrder[$a['area']] ?? 99;
        $bo = $areaOrder[$b['area']] ?? 99;
        if ($ao !== $bo) return $ao <=> $bo;
        return strcmp((string) $a['machine_code'], (string) $b['machine_code']);
      });

      $totalsByArea = [];
      $grand = ['mount_sec' => 0, 'demount_sec' => 0, 'prod_sec' => 0, 'down_sec' => 0, 'segment_count' => 0];
      foreach ($items as $it) {
        $a = (string) $it['area'];
        if (!isset($totalsByArea[$a])) {
          $totalsByArea[$a] = ['mount_sec' => 0, 'demount_sec' => 0, 'prod_sec' => 0, 'down_sec' => 0, 'segment_count' => 0];
        }
        foreach (['mount_sec', 'demount_sec', 'prod_sec', 'down_sec', 'segment_count'] as $k2) {
          $totalsByArea[$a][$k2] += (int) $it[$k2];
          $grand[$k2] += (int) $it[$k2];
        }
      }
    @endphp

    <h1>Reporte general de tiempos por área</h1>
    <p class="meta muted">
      Rango: <strong>{{ $fromLabel }}</strong> → <strong>{{ $toLabel }}</strong>
      · Generado por: <strong>{{ $generatedBy ?? '—' }}</strong>
      · {{ ($generatedAt ?? now())->format('d/m/Y H:i') }}
    </p>

    <table>
      <thead>
        <tr>
          <th>Área</th>
          <th>Máquina</th>
          <th class="num">Montaje</th>
          <th class="num">Desmontaje</th>
          <th class="num">Producción</th>
          <th class="num">Paradas</th>
          <th class="num">Total</th>
          <th class="num"># Segmentos</th>
        </tr>
      </thead>
      <tbody>
        @php $currentArea = null; @endphp
        @forelse ($items as $it)
          @php
            $a = (string) $it['area'];
            if ($currentArea !== $a) {
              $currentArea = $a;
              $t = $totalsByArea[$a] ?? ['mount_sec' => 0, 'demount_sec' => 0, 'prod_sec' => 0, 'down_sec' => 0, 'segment_count' => 0];
              $tTotal = (int) $t['mount_sec'] + (int) $t['demount_sec'] + (int) $t['prod_sec'] + (int) $t['down_sec'];
            }
            $rowTotal = (int) $it['mount_sec'] + (int) $it['demount_sec'] + (int) $it['prod_sec'] + (int) $it['down_sec'];
          @endphp

          @if ($loop->first || (string) $it['area'] !== (string) ($items[$loop->index - 1]['area'] ?? ''))
            <tr class="group-row">
              <td colspan="2">{{ $areaLabel[$currentArea] ?? $currentArea }}</td>
              <td class="num">{{ $toHms((int) $t['mount_sec']) }}</td>
              <td class="num">{{ $toHms((int) $t['demount_sec']) }}</td>
              <td class="num">{{ $toHms((int) $t['prod_sec']) }}</td>
              <td class="num">{{ $toHms((int) $t['down_sec']) }}</td>
              <td class="num">{{ $toHms($tTotal) }}</td>
              <td class="num">{{ number_format((int) $t['segment_count']) }}</td>
            </tr>
          @endif

          <tr>
            <td>{{ $areaLabel[$it['area']] ?? $it['area'] }}</td>
            <td>{{ $it['machine_code'] !== '' ? $it['machine_code'] : '—' }}</td>
            <td class="num">{{ $toHms((int) $it['mount_sec']) }}</td>
            <td class="num">{{ $toHms((int) $it['demount_sec']) }}</td>
            <td class="num">{{ $toHms((int) $it['prod_sec']) }}</td>
            <td class="num">{{ $toHms((int) $it['down_sec']) }}</td>
            <td class="num">{{ $toHms($rowTotal) }}</td>
            <td class="num">{{ number_format((int) $it['segment_count']) }}</td>
          </tr>
        @empty
          <tr>
            <td colspan="8" class="muted">Sin segmentos cerrados en el rango seleccionado.</td>
          </tr>
        @endforelse

        @php $gTotal = (int) $grand['mount_sec'] + (int) $grand['demount_sec'] + (int) $grand['prod_sec'] + (int) $grand['down_sec']; @endphp
        <tr class="group-row">
          <td colspan="2">TOTAL GENERAL</td>
          <td class="num">{{ $toHms((int) $grand['mount_sec']) }}</td>
          <td class="num">{{ $toHms((int) $grand['demount_sec']) }}</td>
          <td class="num">{{ $toHms((int) $grand['prod_sec']) }}</td>
          <td class="num">{{ $toHms((int) $grand['down_sec']) }}</td>
          <td class="num">{{ $toHms($gTotal) }}</td>
          <td class="num">{{ number_format((int) $grand['segment_count']) }}</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>

