<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Certificado de calidad — {{ $workOrder->code }}</title>
    <style>
        body { font-family: DejaVu Sans, Arial, sans-serif; margin: 2rem; }
        h1 { font-size: 1.25rem; }
        table { border-collapse: collapse; margin-top: 1rem; }
        th, td { border: 1px solid #333; padding: 0.5rem 0.75rem; text-align: left; }
    </style>
</head>
<body>
    <h1>Certificado de calidad</h1>
    <p><strong>Orden de trabajo:</strong> {{ $workOrder->code }}</p>
    @if($workOrder->client)
        <p><strong>Cliente:</strong> {{ $workOrder->client->name }}</p>
    @endif
    @if($workOrder->product)
        <p><strong>Producto:</strong> {{ $workOrder->product->name }} @if($workOrder->product->cpe) (CPE: {{ $workOrder->product->cpe }}) @endif</p>
    @endif
    @if($record)
        <p><strong>Resultado:</strong> {{ $outcomeLabel ?? 'Pendiente' }}</p>
        @if($record->notes)
            <p><strong>Observaciones:</strong> {{ $record->notes }}</p>
        @endif
        @if($record->recorder)
            <p><strong>Registrado por:</strong> {{ $record->recorder->name }}</p>
        @endif
    @else
        <p>Sin registro de calidad — complete el registro en el sistema.</p>
    @endif
    <p><strong>Fecha de generación:</strong> {{ isset($generatedAt) ? $generatedAt->format('d/m/Y h:i A') : now()->format('d/m/Y h:i A') }}</p>
    <p><strong>Generado por:</strong> {{ $generatedBy ?? 'Usuario no identificado' }}</p>
    <p style="margin-top:2rem;font-size:0.85rem;color:#555;">Documento generado por Sistema Axones.</p>
</body>
</html>
