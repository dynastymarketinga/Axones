<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$tables = [
    'area_requests',
    'bobinas',
    'client_order_lines',
    'client_orders',
    'corte_bobina_usages',
    'corte_time_segments',
    'delivery_note_lines',
    'delivery_notes',
    'gate_movements',
    'inventory_movements',
    'inventory_returns',
    'laminacion_bobina_usages',
    'laminacion_time_segments',
    'material_request_lines',
    'material_requests',
    'miscellaneous_receipt_attachments',
    'miscellaneous_receipts',
    'operational_alerts',
    'printing_bobina_usages',
    'printing_chemical_usages',
    'printing_ink_control_lines',
    'printing_time_segments',
    'purchase_receipt_lines',
    'purchase_receipts',
    'purchase_order_lines',
    'purchase_orders',
    'materials',
    'tinta_mixture_components',
    'tinta_mixtures',
    'work_order_quality_records',
    'work_order_corte_summaries',
    'work_order_laminacion_summaries',
    'work_order_montaje_summaries',
    'work_order_printing_summaries',
    'work_order_production_items',
    'work_order_lines',
    'work_order_technical_documents',
    'work_orders',
    'product_ink_material',
    'products',
    'suppliers',
    'clients',
    'vendors',
    'cache',
    'cache_locks',
    'jobs',
    'job_batches',
    'failed_jobs',
    'password_reset_tokens',
    'personal_access_tokens',
    'sessions',
];

DB::statement('SET FOREIGN_KEY_CHECKS=0');
foreach ($tables as $table) {
    DB::table($table)->truncate();
}
DB::statement('SET FOREIGN_KEY_CHECKS=1');

echo "OK: tablas limpiadas, users preservada.\n";
