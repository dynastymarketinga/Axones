<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bobinas rechazadas</title>
    <style>
      body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 10px; color: #111827; }
      .header { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      .header td { border: 0; vertical-align: middle; }
      .brand-logo { width: 88px; height: auto; }
      .brand-fallback {
        display: inline-block;
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-weight: 700;
        font-size: 11px;
      }
      .company { font-size: 11px; color: #475569; margin-top: 2px; }
      h1 { margin: 0 0 4px 0; font-size: 18px; color: #be123c; }
      .muted { color: #6b7280; }
      .meta { margin-bottom: 10px; line-height: 1.45; }
      .kpis { margin: 8px 0 10px 0; }
      .chip {
        display: inline-block;
        margin-right: 8px;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid #fecdd3;
        background: #fff1f2;
        color: #9f1239;
        font-size: 10px;
        font-weight: 700;
      }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td {
        border: 1px solid #e5e7eb;
        padding: 4px 5px;
        vertical-align: top;
        word-wrap: break-word;
      }
      th { background: #fdf2f8; color: #881337; font-weight: 700; text-align: left; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .empty { text-align: center; color: #6b7280; padding: 10px; }
      .w-code { width: 8%; }
      .w-short { width: 8%; }
      .w-mid { width: 10%; }
      .w-wide { width: 16%; }
      .w-obsv { width: 14%; }
      .footer-box {
        margin-top: 14px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 8px;
        background: #fafafa;
      }
      .footer-title {
        margin: 0 0 4px 0;
        font-size: 10px;
        color: #374151;
        font-weight: 700;
      }
      .footer-note {
        margin: 0;
        min-height: 28px;
        color: #6b7280;
      }
      .signatures {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      .signatures td {
        border: 0;
        width: 33.33%;
        text-align: center;
        padding: 0 8px;
      }
      .signature-line {
        border-top: 1px solid #9ca3af;
        margin-top: 16px;
        padding-top: 4px;
        font-size: 9px;
        color: #4b5563;
      }
    </style>
  </head>
  <body>
    @php
      $logoDataUri = (string) ($logoDataUri ?? '');
      $fromIso = (string) ($report['from'] ?? '');
      $toIso = (string) ($report['to'] ?? '');
      $fromLabel = $fromIso ? \Carbon\Carbon::parse($fromIso)->format('d/m/Y') : '—';
      $toLabel = $toIso ? \Carbon\Carbon::parse($toIso)->format('d/m/Y') : '—';
      $rows = (array) ($report['rows'] ?? []);
      $totalKg = 0.0;
      foreach ($rows as $r) {
        $totalKg += (float) ($r['peso_kg'] ?? 0);
      }
      $supplierLabel = trim((string) ($supplierName ?? ''));
      $supplierLabel = $supplierLabel !== '' ? $supplierLabel : 'Todos';
      $genAt = $generatedAt ?? now();
      $genAtLabel = $genAt instanceof \Carbon\CarbonInterface ? $genAt->format('d/m/Y H:i') : (string) $genAt;
    @endphp

    <table class="header">
      <tr>
        <td style="width: 96px;">
          @if($logoDataUri !== '')
            <img src="{{ $logoDataUri }}" alt="Axones" class="brand-logo" />
          @else
            <span class="brand-fallback">AXONES</span>
          @endif
        </td>
        <td>
          <h1>Bobinas rechazadas</h1>
          <div class="company">Inversiones Axones 2008, C.A.</div>
        </td>
      </tr>
    </table>

    <div class="meta muted">
      Período: <strong>{{ $fromLabel }}</strong> — <strong>{{ $toLabel }}</strong><br />
      Proveedor: <strong>{{ $supplierLabel }}</strong><br />
      Generado por: {{ $generatedBy ?? '—' }} · {{ $genAtLabel }}
    </div>

    <div class="kpis">
      <span class="chip">{{ count($rows) }} bobina(s)</span>
      <span class="chip">Total {{ number_format($totalKg, 3, '.', '') }} kg</span>
    </div>

    <table>
      <thead>
        <tr>
          <th class="w-code">Número</th>
          <th class="w-short">Proveedor</th>
          <th class="w-short">Operador</th>
          <th class="w-short">Material</th>
          <th class="num w-short">Peso (Kg)</th>
          <th class="w-wide">Motivo</th>
          <th class="w-obsv">Observación</th>
          <th class="w-mid">Fecha bobina</th>
          <th class="w-mid">Fecha registro</th>
          <th class="w-mid">OT</th>
        </tr>
      </thead>
      <tbody>
        @forelse ($rows as $r)
          <tr>
            <td>{{ $r['numero_bobina'] ?? '—' }}</td>
            <td>{{ $r['proveedor'] ?? '—' }}</td>
            <td>{{ $r['operador'] ?? '—' }}</td>
            <td>{{ $r['material'] ?? '—' }}</td>
            <td class="num">{{ $r['peso_kg'] ?? '0.000' }}</td>
            <td>{{ $r['motivo'] ?? '—' }}</td>
            <td>{{ $r['observacion'] ?? '—' }}</td>
            <td>{{ $r['fecha_bobina'] ?? '—' }}</td>
            <td>{{ $r['fecha_registro'] ?? '—' }}</td>
            <td>{{ $r['work_order_code'] ?? '—' }}</td>
          </tr>
        @empty
          <tr>
            <td colspan="10" class="empty">Sin bobinas rechazadas para los filtros seleccionados.</td>
          </tr>
        @endforelse
      </tbody>
    </table>

    <div class="footer-box">
      <p class="footer-title">Observaciones</p>
      <p class="footer-note">Sin observaciones adicionales.</p>

      <table class="signatures">
        <tr>
          <td><div class="signature-line">Elaborado por</div></td>
          <td><div class="signature-line">Revisado por</div></td>
          <td><div class="signature-line">Aprobado por</div></td>
        </tr>
      </table>
    </div>
  </body>
</html>
