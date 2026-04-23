<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$rows = App\Models\WorkOrder::query()
    ->selectRaw("coalesce(board_stage, '(null)') as board_stage, count(*) as c")
    ->groupBy('board_stage')
    ->orderBy('board_stage')
    ->get()
    ->toArray();

echo json_encode($rows, JSON_PRETTY_PRINT) . PHP_EOL;

