<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$rid = (int) ($argv[1] ?? 0);
if ($rid < 1) {
    fwrite(STDERR, "Usage: php scripts/inspect_receipt_lines.php <purchase_receipt_id>\n");
    exit(2);
}

$lines = App\Models\PurchaseReceiptLine::query()
    ->where('purchase_receipt_id', $rid)
    ->get(['id', 'material_id', 'quantity', 'bobina_count', 'bobina_weight_kg'])
    ->toArray();

echo json_encode($lines, JSON_PRETTY_PRINT) . PHP_EOL;

