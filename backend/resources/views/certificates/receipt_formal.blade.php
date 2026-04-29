<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Recepción de material #{{ $receipt->id }}</title>
    <style>
        @page { size: A4 portrait; margin: 18mm; }
        body { font-family: DejaVu Sans, Arial, sans-serif; color: #111; font-size: 12px; }
        .header { border-bottom: 1px solid #222; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 18px; font-weight: 700; margin: 0; }
        .subtitle { font-size: 11px; margin-top: 2px; color: #333; }
        .doc-title { margin: 14px 0 10px; text-align: center; font-size: 16px; font-weight: 700; letter-spacing: .4px; }
        .meta-grid { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .meta-grid td { padding: 4px 6px; border: 1px solid #bbb; vertical-align: top; }
        .label { font-size: 10px; color: #444; font-weight: 700; text-transform: uppercase; }
        .value { font-size: 12px; margin-top: 2px; }
        table.lines { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table.lines th, table.lines td { border: 1px solid #444; padding: 6px; font-size: 11px; }
        table.lines th { background: #f1f1f1; text-transform: uppercase; font-size: 10px; }
        .notes { margin-top: 12px; }
        .notes-box { border: 1px solid #bbb; min-height: 48px; padding: 8px; }
        .signatures { margin-top: 26px; width: 100%; table-layout: fixed; }
        .signatures td { width: 33.33%; text-align: center; vertical-align: top; padding: 0 8px; }
        .sign-line { border-top: 1px solid #222; margin-top: 40px; padding-top: 4px; font-size: 11px; }
        .footer { margin-top: 16px; font-size: 10px; color: #444; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">INVERSIONES AXONES 2008 C.A.</h1>
        <div class="subtitle">RIF: J-400813417 · Calle Parcelamiento Industrial Guere, Turmero, Edo. Aragua</div>
        <div class="subtitle">Reporte documental de recepción de material</div>
    </div>

    <div class="doc-title">RECEPCIÓN DE MATERIAL</div>

    <table class="meta-grid">
        <tr>
            <td>
                <div class="label">N° Recepción</div>
                <div class="value">REC-{{ str_pad((string) $receipt->id, 6, '0', STR_PAD_LEFT) }}</div>
            </td>
            <td>
                <div class="label">Fecha recepción</div>
                <div class="value">{{ $receipt->received_at ? \Carbon\Carbon::parse($receipt->received_at)->format('d/m/Y H:i') : '—' }}</div>
            </td>
            <td>
                <div class="label">N° OC (referencia)</div>
                <div class="value">{{ $receipt->purchase_order_reference ?: '—' }}</div>
            </td>
        </tr>
        <tr>
            <td>
                <div class="label">Proveedor</div>
                <div class="value">{{ $receipt->supplier?->name ?: ($receipt->supplier_name ?: '—') }}</div>
            </td>
            <td>
                <div class="label">N° Factura</div>
                <div class="value">{{ $receipt->invoice_number ?: '—' }}</div>
            </td>
            <td>
                <div class="label">Registrado por</div>
                <div class="value">{{ $receipt->user?->name ?: ($generatedBy ?? 'Usuario no identificado') }}</div>
            </td>
        </tr>
    </table>

    <table class="lines">
        <thead>
            <tr>
                <th style="width:5%;">#</th>
                <th style="width:18%;">SKU</th>
                <th>Descripción</th>
                <th style="width:11%;">Tipo</th>
                <th style="width:10%;">Cantidad</th>
                <th style="width:8%;">Unidad</th>
                <th style="width:8%;">Micras</th>
                <th style="width:8%;">Ancho</th>
            </tr>
        </thead>
        <tbody>
            @forelse($receipt->lines as $index => $line)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $line->material?->sku ?: '—' }}</td>
                    <td>{{ $line->material?->name ?: '—' }}</td>
                    <td>{{ $line->item_type ?: '—' }}</td>
                    <td>{{ $line->quantity ?? '—' }}</td>
                    <td>{{ $line->unit ?: '—' }}</td>
                    <td>{{ $line->micras ?? '—' }}</td>
                    <td>{{ $line->ancho_mm ?? '—' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="8">Sin líneas registradas para esta recepción.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="notes">
        <div class="label">Observaciones</div>
        <div class="notes-box">{{ $receipt->notes ?: 'Sin observaciones.' }}</div>
    </div>

    <table class="signatures">
        <tr>
            <td><div class="sign-line">Elaborado por</div></td>
            <td><div class="sign-line">Revisado por</div></td>
            <td><div class="sign-line">Recibido por</div></td>
        </tr>
    </table>

    <div class="footer">
        Generado el {{ isset($generatedAt) ? $generatedAt->format('d/m/Y h:i A') : now()->format('d/m/Y h:i A') }}
        · Sistema Axones
    </div>
</body>
</html>
