<?php

/**
 * Vacía (TRUNCATE) datos operativos y maestros de negocio; conserva sesiones y autenticación.
 *
 * NO trunca: users, sessions, personal_access_tokens, migrations
 *
 * Uso (desde carpeta backend):
 *   php scripts/truncate_keep_users.php
 */

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$preserve = [
    'users',
    'sessions',
    'personal_access_tokens',
    'migrations',
];

$tables = [
    'area_requests',
    'bobinas',
    'cache',
    'cache_locks',
    'clients',
    'client_orders',
    'client_order_lines',
    'corte_bobina_usages',
    'corte_time_segments',
    'delivery_notes',
    'delivery_note_lines',
    'failed_jobs',
    'gate_movements',
    'inventory_movements',
    'inventory_returns',
    'jobs',
    'job_batches',
    'laminacion_bobina_usages',
    'laminacion_time_segments',
    'materials',
    'material_product',
    'material_requests',
    'material_request_lines',
    'miscellaneous_receipts',
    'miscellaneous_receipt_attachments',
    'montaje_material_usages',
    'montaje_time_segments',
    'operational_alerts',
    'password_reset_requests',
    'password_reset_tokens',
    'printing_bobina_usages',
    'printing_chemical_usages',
    'printing_ink_control_lines',
    'printing_time_segments',
    'products',
    'product_ink_material',
    'purchase_orders',
    'purchase_order_lines',
    'purchase_receipts',
    'purchase_receipt_lines',
    'suppliers',
    'tinta_mixtures',
    'tinta_mixture_components',
    'tinta_subareas',
    'vendors',
    'work_orders',
    'work_order_corte_summaries',
    'work_order_laminacion_summaries',
    'work_order_lines',
    'work_order_montaje_summaries',
    'work_order_printing_summaries',
    'work_order_production_items',
    'work_order_quality_records',
    'work_order_technical_documents',
];

DB::statement('SET FOREIGN_KEY_CHECKS=0');
foreach ($tables as $table) {
    DB::table($table)->truncate();
}
DB::statement('SET FOREIGN_KEY_CHECKS=1');

echo 'OK: tablas vaciadas. Conservadas: '.implode(', ', $preserve).".\n";
