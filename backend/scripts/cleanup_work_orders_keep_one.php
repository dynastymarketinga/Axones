<?php

declare(strict_types=1);

/**
 * One-off cleanup: delete all work_orders except the given code.
 * Run from backend: php scripts/cleanup_work_orders_keep_one.php OT-2026-00021
 */

use App\Models\WorkOrder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

$keepCode = $argv[1] ?? null;
if (! $keepCode) {
    fwrite(STDERR, "Usage: php scripts/cleanup_work_orders_keep_one.php OT-YYYY-NNNNN\n");
    exit(1);
}

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$keep = WorkOrder::query()->where('code', $keepCode)->first();
if (! $keep) {
    fwrite(STDERR, "No existe la OT conservada: {$keepCode}\n");
    exit(2);
}

$keepId = (int) $keep->getKey();

echo 'KEEP id='.$keepId.' code='.$keep->code.PHP_EOL;
echo 'work_orders before='.WorkOrder::query()->count().PHP_EOL;

DB::transaction(function () use ($keepId): void {
    DB::table('material_request_lines')->whereIn('material_request_id', function ($q) use ($keepId): void {
        $q->select('id')->from('material_requests')->where('work_order_id', '<>', $keepId);
    })->delete();

    DB::table('material_requests')->where('work_order_id', '<>', $keepId)->delete();

    DB::table('inventory_returns')
        ->whereNotNull('work_order_id')
        ->where('work_order_id', '<>', $keepId)
        ->update(['work_order_id' => null]);

    WorkOrder::query()->where('id', '<>', $keepId)->delete();
});

echo 'work_orders after='.WorkOrder::query()->count().PHP_EOL;
echo json_encode(WorkOrder::query()->select('id', 'code')->get()->toArray(), JSON_UNESCAPED_UNICODE).PHP_EOL;
