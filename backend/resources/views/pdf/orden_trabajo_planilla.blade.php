<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Orden de trabajo — {{ $order->code }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 8px; line-height: 1.05; color: #111; margin: 8px; }
        table.doc { width: 100%; border-collapse: collapse; margin-bottom: 0; table-layout: fixed; }
        table.doc > tbody > tr > td { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; }
        .logo-cell { width: 13%; font-size: 9px; font-weight: bold; text-align: center; vertical-align: middle; }
        .logo-cell--brand { padding: 3px 4px; background: #fff; }
        .logo-cell .logo-img { max-width: 100%; width: auto; height: auto; max-height: 45px; display: block; margin: 0 auto; }
        .logo-fallback { font-size: 9px; font-weight: bold; letter-spacing: 0.02em; }
        .doc-title { font-size: 11.5px; font-weight: bold; text-align: center; text-decoration: underline; text-transform: uppercase; }
        .section-bar { background: #d8d8d8; color: #111; font-weight: bold; font-size: 8.2px; text-transform: uppercase; padding: 1px 4px; letter-spacing: 0.01em; text-align: center; }
        .top-strip { background: #fff; color: #111; font-weight: bold; font-size: 7.8px; text-transform: uppercase; padding: 1px 4px; text-align: center; }
        .lbl { font-weight: bold; text-transform: uppercase; }
        .cell-pedido { font-size: 8px; }
        .pedido-row td { padding-top: 1px !important; padding-bottom: 1px !important; }
        .sub-row-muted { font-size: 7px; color: #222; padding: 1px 4px !important; border-top: 1px solid #000 !important; text-align: center; }
        table.meta { width: 100%; border-collapse: collapse; margin-bottom: 4px; table-layout: fixed; }
        table.meta td { border: 1px solid #000; padding: 1px 3px; vertical-align: middle; }
        table.meta .label { background: #fff; font-weight: bold; font-size: 7.4px; text-transform: uppercase; width: 18%; }
        table.grid { width: 100%; border-collapse: collapse; margin-bottom: 4px; table-layout: fixed; }
        table.grid th, table.grid td { border: 1px solid #000; padding: 1px 3px; vertical-align: middle; font-size: 7.3px; }
        table.grid th { background: #fff; font-weight: bold; text-align: center; text-transform: uppercase; }
        table.montaje-3 td { font-size: 7.3px; }
        table.montaje-3 .lab { font-weight: bold; text-transform: uppercase; width: 14%; background: #fff; }
        table.imp-3 td { font-size: 7.3px; }
        table.imp-3 .lab { font-weight: bold; text-transform: uppercase; width: 16%; background: #fff; }
        .fig-box { width: 10%; text-align: center; font-weight: bold; vertical-align: middle !important; font-size: 8px; }
        .ink-obs { vertical-align: top; min-height: 104px; font-size: 7.2px; width: 22%; padding: 8px 6px 2px 8px !important; }
        .tintas-pos { text-align: center; width: 6%; }
        .tintas-center { text-align: center; }
        .muted { color: #444; font-size: 6.7px; }
        .corte-col { width: 33.33%; font-size: 7.2px; vertical-align: top; padding-top: 2px !important; }
        .corte-col .lab { font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 1px; }
        .fig-diagram { border: 1px solid #333; min-height: 56px; text-align: center; padding: 3px; font-size: 6.8px; }
        .structure-big { font-size: 15px; font-weight: bold; text-align: center; letter-spacing: 0.02em; }
        .paper-label { font-weight: bold; text-transform: uppercase; text-align: right; }
        .paper-value { text-align: center; font-weight: bold; }
        .figure-title { font-weight: bold; text-transform: uppercase; text-align: center; }
        .cut-footer { font-size: 6.8px; white-space: nowrap; }
    </style>
</head>
<body>
@php
    $m = $m ?? [];
    $val = function (string $k) use ($m): string {
        if (! array_key_exists($k, $m) || $m[$k] === null) {
            return '—';
        }
        $s = trim((string) $m[$k]);

        return $s !== '' ? $s : '—';
    };
    $lineaCorte = strtolower($val('lineaCorte'));
    $lineaCorteLabel = match ($lineaCorte) {
        'si', 'sí' => 'SI',
        'no' => 'NO',
        default => $lineaCorte !== '—' ? strtoupper($val('lineaCorte')) : '—',
    };
    $fechaRaw = $m['fechaOrden'] ?? null;
    $fechaPedido = '—';
    if ($fechaRaw !== null && trim((string) $fechaRaw) !== '') {
        try {
            $fechaPedido = \Carbon\Carbon::parse((string) $fechaRaw)->format('j-n-Y');
        } catch (\Throwable) {
            $fechaPedido = trim((string) $fechaRaw);
        }
    }
    $maquinaTxt = $val('maquina');
    $planchasTxt = $val('planchasReferencia');
    $subtituloPedido = 'DATOS DEL PEDIDO';
    if ($maquinaTxt !== '—') {
        $subtituloPedido .= ' ('.$maquinaTxt.')';
    }
    $subtituloPedido .= ' PLANCHAS ';
    $subtituloPedido .= $planchasTxt !== '—' ? $planchasTxt : '—';
    $cap1 = isset($m['estructuraCapa1']) && trim((string) $m['estructuraCapa1']) !== '' ? trim((string) $m['estructuraCapa1']) : '';
    $estructuraPdf = $cap1 !== '' ? $cap1 : ($val('estructuraMaterial'));
    $sustratoImpLine = collect($sustratosImp ?? [])
        ->pluck('label')
        ->filter(fn ($l) => $l !== '—' && $l !== '')
        ->implode(', ');
    if ($sustratoImpLine === '') {
        $sustratoImpLine = '—';
    }
    $obsTintasLateral = $val('obsTintasLateral');
    if ($obsTintasLateral === '—') {
        $obsTintasLateral = $val('observacionesTintas');
    }
    $logoPath = public_path('brand/logo-axones-var-01.png');
    $logoDataUri = is_readable($logoPath)
        ? 'data:image/png;base64,'.base64_encode((string) file_get_contents($logoPath))
        : '';
@endphp

{{-- Encabezado: logo + título + banda pedido + fila única FECHA | N° ORDEN | PEDIDO (Kg.) --}}
<table class="doc">
    <tbody>
        <tr>
            <td class="logo-cell logo-cell--brand" rowspan="4">
                @if($logoDataUri !== '')
                    <img src="{{ $logoDataUri }}" alt="Inversiones Axones" class="logo-img" />
                @else
                    <span class="logo-fallback">AXONES</span>
                @endif
            </td>
            <td class="doc-title" colspan="3" style="padding:4px;">ORDEN DE TRABAJO</td>
        </tr>
        <tr>
            <td colspan="3" class="top-strip">{{ $subtituloPedido }}</td>
        </tr>
        <tr class="pedido-row">
            <td class="cell-pedido" style="text-align:center;"><span class="lbl">FECHA:</span> {{ $fechaPedido }}</td>
            <td class="cell-pedido" style="text-align:center;"><span class="lbl">N° ORDEN:</span> {{ $val('numeroOrden') }}</td>
            <td class="cell-pedido" style="text-align:center;"><span class="lbl">PEDIDO (Kg.):</span> {{ $val('pedidoKg') }}</td>
        </tr>
        <tr>
            <td colspan="3" class="sub-row-muted">
                <span class="lbl">Metros est.:</span> {{ $val('metrosEstimados') }}
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <span class="lbl">Pedido cliente (ref.):</span>
                {{ $val('client_order_code') !== '—' ? $val('client_order_code') : $val('client_order_reference') }}
            </td>
        </tr>
    </tbody>
</table>

{{-- DATOS DEL PRODUCTO (orden papel: cliente, producto, estructura; luego CPE / MPPS / COD en una línea) --}}
<table class="meta" style="margin-top:5px;">
    <tbody>
        <tr>
            <td colspan="4" class="top-strip">DATOS DEL PRODUCTO</td>
        </tr>
        <tr>
            <td class="label" style="text-align:center;">CLIENTE</td>
            <td colspan="3">{{ $val('cliente') }}@if($val('clienteRif') !== '—') — {{ $val('clienteRif') }}@endif</td>
        </tr>
        <tr>
            <td class="label" style="text-align:center;">PRODUCTO</td>
            <td colspan="3">{{ $val('producto') }}</td>
        </tr>
        <tr>
            <td class="label" style="text-align:center;">ESTRUCTURA DEL MATERIAL</td>
            <td colspan="3">{{ $estructuraPdf }}</td>
        </tr>
        <tr>
            <td class="label">C.P.E.</td>
            <td>{{ $val('cpe') }}</td>
            <td class="label">M.P.P.S.</td>
            <td>{{ $val('mpps') }}</td>
        </tr>
        <tr>
            <td class="label">COD. DE BARRA</td>
            <td colspan="3">{{ $val('codigoBarra') }}</td>
        </tr>
    </tbody>
</table>

{{-- AREA DE MONTAJE: rejilla 3 columnas x 3 filas (papel) --}}
<table class="meta montaje-3">
    <tbody>
        <tr>
            <td colspan="6" class="section-bar">AREA DE MONTAJE</td>
        </tr>
        <tr>
            <td class="lab">FRECUENCIA (mm)</td>
            <td>{{ $val('frecuencia') }}</td>
            <td class="lab">N° BANDAS</td>
            <td>{{ $val('numBandas') }}</td>
            <td class="lab">TIPO IMPRESIÓN</td>
            <td>{{ $val('tipoImpresionMontaje') !== '—' ? $val('tipoImpresionMontaje') : $val('tipoImpresion') }}</td>
        </tr>
        <tr>
            <td class="lab">ANCHO CORTE (mm)</td>
            <td>{{ $val('anchoCorteMontaje') }}</td>
            <td class="lab">N° REPETICIÓN O FRECUENCIA</td>
            <td>{{ $val('numRepeticion') }}</td>
            <td class="lab">DESARROLLO</td>
            <td>{{ $val('desarrollo') }}</td>
        </tr>
        <tr>
            <td class="lab">ANCHO MONTAJE (mm)</td>
            <td>{{ $val('anchoMontaje') }}</td>
            <td class="lab">FIGURA DEL EMBOBINADO IMPRESIÓN</td>
            <td>{{ $val('figuraEmbobinadoMontaje') }}</td>
            <td class="lab">N° COLORES</td>
            <td>{{ $val('numColores') }}</td>
        </tr>
        <tr>
            <td class="label">Observaciones montaje</td>
            <td colspan="5">{{ $val('obsMontaje') }}</td>
        </tr>
    </tbody>
</table>

{{-- AREA DE IMPRESIÓN --}}
<table class="meta imp-3">
    <tbody>
        <tr>
            <td colspan="7" class="section-bar">AREA DE IMPRESIÓN</td>
        </tr>
        <tr>
            <td class="lab">PIÑON (DIENTES)</td>
            <td>{{ $val('pinonImp') }}</td>
            <td class="lab">UBICACIÓN DE LA FOTOCELDA</td>
            <td>{{ $val('ubicFotoceldaImp') }}</td>
            <td class="lab">Kg INGRESADO</td>
            <td>{{ $val('kgIngresadoImp') }}</td>
            <td rowspan="3" class="fig-box">FIGURA EMB.:<br>{{ $val('figEmbImpDisplay') }}</td>
        </tr>
        <tr>
            <td class="lab">LINEA DE CORTE</td>
            <td>{{ $lineaCorteLabel }}</td>
            <td class="lab">GRAMAJE DE TINTA (g/m²)</td>
            <td>{{ $val('gramajeTintaGm2') }}</td>
            <td class="lab">Kg SALIDA</td>
            <td>{{ $val('kgSalidaImp') }}</td>
        </tr>
        <tr>
            <td class="lab">SUSTRATOS VIRGEN A USAR</td>
            <td colspan="3">{{ $sustratoImpLine }}</td>
            <td class="lab">MERMA</td>
            <td>{{ $val('mermaImp') }}</td>
        </tr>
        <tr>
            <td class="lab">METROS</td>
            <td colspan="6">{{ $val('metrosImp') }}</td>
        </tr>
    </tbody>
</table>

{{-- DESCRIPCIÓN DE TINTAS: columna % + observaciones laterales --}}
<table class="meta">
    <tbody>
        <tr>
            <td colspan="6" class="section-bar">DESCRIPCIÓN DE TINTAS</td>
        </tr>
    </tbody>
</table>
<table class="grid">
    <thead>
        <tr>
            <th style="width:6%;">POS.</th>
            <th style="width:28%;">COLOR</th>
            <th style="width:14%;">ANILOX</th>
            <th style="width:10%;">VISC (seg)</th>
            <th style="width:8%;">%</th>
            <th style="width:34%;">OBSERVACIONES</th>
        </tr>
    </thead>
    <tbody>
        @for($i = 1; $i <= 8; $i++)
            <tr>
                <td class="tintas-pos">{{ $i }}</td>
                <td>{{ $val('tintaColor'.$i) }}</td>
                <td class="tintas-center">{{ $val('tintaAnilox'.$i) }}</td>
                <td class="tintas-center">{{ $val('tintaVisc'.$i) }}</td>
                <td class="tintas-center">{{ $val('tintaPct'.$i) }}</td>
                @if($i === 1)
                    <td rowspan="8" class="ink-obs">
                        <span class="lbl">OBSERVACIONES:</span><br>
                        {{ $obsTintasLateral }}
                    </td>
                @endif
            </tr>
        @endfor
    </tbody>
</table>

{{-- AREA DE LAMINACIÓN --}}
<table class="meta">
    <tbody>
        <tr>
            <td colspan="6" class="section-bar">AREA DE LAMINACIÓN</td>
        </tr>
        <tr>
            <td class="paper-label" style="width:18%;">FIGURA EMBOBINADO:</td>
            <td class="paper-value" style="width:10%;">{{ $val('figuraEmbobinadoLam') }}</td>
            <td class="paper-label" colspan="2">MATERIALES</td>
            <td class="paper-label" style="width:12%;">KILOS (Kg)</td>
            <td class="paper-label" style="width:12%;">METROS (m)</td>
        </tr>
        <tr>
            <td class="paper-label">GRAMAJE ADHESIVO(g/m²):</td>
            <td class="paper-value">{{ $val('gramajeAdhesivo') }}</td>
            <td colspan="2" class="paper-label">ADHESIVO PARA LAMINACION</td>
            <td class="paper-value">{{ $val('kgAdhesivoLaminacion') }}</td>
            <td class="paper-value">N/A</td>
        </tr>
        <tr>
            <td class="paper-label">RELACIÓN DE MEZCLA ADH.:</td>
            <td class="paper-value">{{ $val('relacionMezcla') }}</td>
            <td colspan="2" class="paper-label">CATALIZADOR PARA LAMINACION</td>
            <td class="paper-value">{{ $val('kgCatalizadorLaminacion') }}</td>
            <td class="paper-value">N/A</td>
        </tr>
        <tr>
            <td class="paper-label">Kg INGRESADO:</td>
            <td class="paper-value">{{ $val('kgEntradaLam') }}</td>
            <td class="paper-label">Kg SALIDA:</td>
            <td class="paper-value">{{ $val('kgSalidaLam') }}</td>
            <td class="paper-value">{{ $sustratosLam[0]['kg'] ?? '—' }}</td>
            <td class="paper-value">{{ $sustratosLam[0]['metros'] ?? $val('metrajeLam') }}</td>
        </tr>
        <tr>
            <td class="paper-label">METRAJE:</td>
            <td class="paper-value">{{ $val('metrajeLam') }}</td>
            <td class="paper-label">MERMA:</td>
            <td class="paper-value">{{ $val('mermaLam') }}</td>
            <td class="paper-value">{{ $sustratosLam[1]['kg'] ?? '—' }}</td>
            <td class="paper-value">{{ $sustratosLam[1]['metros'] ?? $val('metrajeLam2') }}</td>
        </tr>
        <tr>
            <td colspan="2" class="paper-label">DESCRIPCIÓN MATERIA PRIMA VIRGEN:</td>
            <td colspan="4" rowspan="2" class="structure-big">{{ $val('descripcionMateriaPrimaVirgenLam') !== '—' ? $val('descripcionMateriaPrimaVirgenLam') : $estructuraPdf }}</td>
        </tr>
        <tr>
            <td class="paper-label">ANCHO DE IMPRESIÓN:</td>
            <td class="paper-value">{{ $val('anchoImpresionLam') }}</td>
        </tr>
    </tbody>
</table>

{{-- AREA DE CORTE / EMBALAJE --}}
<table class="meta">
    <tbody>
        <tr>
            <td colspan="7" class="section-bar">AREA DE CORTE / EMBALAJE</td>
        </tr>
        <tr>
            <td class="paper-label" style="width:20%;">ANCHO CORTE (mm):</td>
            <td class="paper-value" style="width:10%;">{{ $val('anchoCorteFinal') }}</td>
            <td class="paper-label" style="width:22%;">PESO BOBINA CORTADA (KG):</td>
            <td class="paper-value" style="width:11%;">{{ $val('pesoBobina') }}</td>
            <td colspan="3" class="figure-title">FIGURA EMBOBINADO</td>
        </tr>
        <tr>
            <td class="paper-label">UBICACIÓN DE LA FOTOCELDA:</td>
            <td class="paper-value">{{ $val('ubicFotoceldaCorte') }}</td>
            <td class="paper-label">METROS POR BOBINA (m):</td>
            <td class="paper-value">{{ $val('metrosBobina') }}</td>
            <td colspan="3" rowspan="5" style="text-align:center; vertical-align:middle;">
                <div class="fig-diagram">
                    <span style="font-size:12px;font-weight:bold;">{{ $val('figuraEmbobinadoCorte') !== '—' ? $val('figuraEmbobinadoCorte') : '1' }}</span><br>
                    <span class="muted">INVERSIONES<br>AXONES C.A.</span>
                </div>
            </td>
        </tr>
        <tr>
            <td class="paper-label">DISTANCIA FOTOCELDA AL BORDE(mm):</td>
            <td class="paper-value">{{ $val('distFotoceldaBorde') }}</td>
            <td class="paper-label">DIÁMETRO DE LA BOBINA (mm):</td>
            <td class="paper-value">{{ $val('diamBobina') }}</td>
        </tr>
        <tr>
            <td class="paper-label">DISTANCIA LADO FOTOCELDA AL BORDE (mm):</td>
            <td class="paper-value">{{ $val('distFiguraLadoFotocelda') }}</td>
            <td class="paper-label">ANCHO CORE (mm):</td>
            <td class="paper-value">{{ $val('anchoCore') }}</td>
        </tr>
        <tr>
            <td class="paper-label">DISTANCIA DE LA NO FOTOCELDA AL BORDE(mm):</td>
            <td class="paper-value">{{ $val('distFiguraLadoContrario') }}</td>
            <td class="paper-label">CANTIDAD DE CORES:</td>
            <td class="paper-value">{{ $val('cantCores') }}</td>
        </tr>
        <tr>
            <td class="paper-label">TIPO DE EMPALME:</td>
            <td class="paper-value">{{ $val('tipoEmpalme') }}</td>
            <td class="paper-label">DIÁMETRO DEL CORE (PLG):</td>
            <td class="paper-value">{{ $val('diamCorePlg') }}</td>
        </tr>
        <tr>
            <td class="paper-label">MÁXIMO DE EMPALMES:</td>
            <td class="paper-value">{{ $val('maxEmpates') }}</td>
            <td colspan="5" class="cut-footer">
                <span class="lbl">Kg ingresados:</span> {{ $val('kgIngresadosCorte') }}
                &nbsp;&nbsp;
                <span class="lbl">Kg Salida:</span> {{ $val('kgSalidaCorte') }}
                &nbsp;&nbsp;
                <span class="lbl">Kg merma:</span> {{ $val('kgMermaCorte') }}
                &nbsp;&nbsp;
                <span class="lbl">metraje:</span> {{ $val('metrajeCorte') }}
            </td>
        </tr>
    </tbody>
</table>

</body>
</html>
