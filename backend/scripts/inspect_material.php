<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$mid = (int) ($argv[1] ?? 0);
if ($mid < 1) {
    fwrite(STDERR, "Usage: php scripts/inspect_material.php <material_id>\n");
    exit(2);
}

$m = App\Models\Material::query()->findOrFail($mid);
echo json_encode([
    'id' => $m->id,
    'sku' => $m->sku,
    'name' => $m->name,
    'inventory_area' => $m->inventory_area,
    'unit' => $m->unit,
], JSON_PRETTY_PRINT) . PHP_EOL;

