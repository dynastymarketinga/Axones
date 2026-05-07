<?php

declare(strict_types=1);

/**
 * Script one-shot: recalcula el status de TODAS las purchase_orders bajo la
 * nueva regla "Completada via despacho".
 *
 * Uso (desde la raíz del backend):
 *   php scripts/recompute_purchase_order_statuses.php
 *
 * Salida: cuántas filas cambiaron y cuántas se quedaron iguales.
 *
 * Idempotente: puede correrse las veces que se quiera sin efectos secundarios
 * destructivos. No toca columnas distintas a `status` ni borra cierres
 * manuales (manually_closed_at se respeta).
 */
require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

/** @var App\Services\PurchaseOrderClosingService $service */
$service = $app->make(App\Services\PurchaseOrderClosingService::class);

$start = microtime(true);
$summary = $service->recomputeAll();
$elapsedMs = (int) round((microtime(true) - $start) * 1000);

$output = [
    'updated' => $summary['updated'],
    'unchanged' => $summary['unchanged'],
    'total' => $summary['updated'] + $summary['unchanged'],
    'elapsed_ms' => $elapsedMs,
];

echo json_encode($output, JSON_PRETTY_PRINT).PHP_EOL;
