<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; }
        .title { text-align: center; font-size: 16px; font-weight: bold; margin: 12px 0 8px; }
        .brand { text-align: center; font-size: 12px; font-weight: bold; margin-bottom: 4px; }
        .meta { width: 100%; margin-bottom: 12px; }
        .meta td { vertical-align: top; padding: 2px 0; }
        .meta .right { text-align: right; }
        .routing { margin: 10px 0; }
        table.grid { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table.grid th, table.grid td { border: 1px solid #333; padding: 6px; vertical-align: top; }
        table.grid th { background: #f0f0f0; font-weight: bold; text-align: center; }
        .pedido { width: 15%; text-align: center; }
        .producto { width: 50%; }
        .cliente { width: 35%; text-align: center; }
        .specs { font-size: 10px; color: #333; margin-top: 4px; }
        .obs { margin-top: 16px; }
        .obs-title { font-weight: bold; margin-bottom: 4px; }
        .obs-lines { border-bottom: 1px solid #999; min-height: 18px; margin-top: 6px; }
        .sign { margin-top: 28px; text-align: center; }
        .sign-name { font-weight: bold; margin-top: 24px; border-top: 1px solid #333; display: inline-block; padding-top: 4px; min-width: 200px; }
    </style>
</head>
<body>
    <div class="brand">IMPRESIONES AXONES 2008, C.A.</div>
    <div class="title">ORDEN DE PRODUCCIÓN</div>

    <table class="meta">
        <tr>
            <td>
                <strong>PARA:</strong> {{ $order->issued_to }}<br>
                <strong>DE:</strong> {{ $order->issued_from }}
            </td>
            <td class="right">
                <strong>Número:</strong> {{ $order->document_number ?? $order->code }}<br>
                <strong>Fecha:</strong> {{ $order->document_date ? $order->document_date->format('d/m/Y') : $order->created_at->format('d/m/Y') }}
            </td>
        </tr>
    </table>

    <table class="grid">
        <thead>
            <tr>
                <th class="pedido">PEDIDO</th>
                <th class="producto">PRODUCTO</th>
                <th class="cliente">CLIENTE</th>
            </tr>
        </thead>
        <tbody>
        @forelse($order->productionItems as $item)
            <tr>
                <td class="pedido">{{ rtrim(rtrim(number_format((float) $item->quantity, 3, ',', ''), '0'), ',') }} {{ $item->quantity_unit }}</td>
                <td class="producto">
                    {{ $item->product_description }}
                    @if($item->technical_specs)
                        <div class="specs">({{ $item->technical_specs }})</div>
                    @endif
                </td>
                @if($loop->first)
                <td class="cliente" rowspan="{{ $order->productionItems->count() }}">{{ $order->client?->name ?? '—' }}</td>
                @endif
            </tr>
        @empty
            <tr>
                <td class="pedido">—</td>
                <td class="producto">{{ $order->product?->name ?? '—' }}</td>
                <td class="cliente">{{ $order->client?->name ?? '—' }}</td>
            </tr>
        @endforelse
        </tbody>
    </table>

    <div class="obs">
        <div class="obs-title">OBSERVACIONES:</div>
        <div style="white-space: pre-wrap;">{{ $order->notes }}</div>
        <div class="obs-lines">&nbsp;</div>
        <div class="obs-lines">&nbsp;</div>
    </div>

    <div class="sign">
        <div class="sign-name">
            @if($order->authorized_by_name)
                {{ $order->authorized_by_name }}<br>
                <span style="font-weight: normal;">{{ $order->authorized_by_title }}</span>
            @else
                &nbsp;
            @endif
        </div>
    </div>
</body>
</html>
