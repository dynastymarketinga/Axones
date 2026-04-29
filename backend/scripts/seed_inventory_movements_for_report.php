<?php

declare(strict_types=1);

use App\Enums\InventoryMovementType;
use App\Models\Material;
use App\Models\User;
use App\Services\InventoryLedgerService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Carbon;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

/** @var InventoryLedgerService $ledger */
$ledger = app(InventoryLedgerService::class);
$user = User::query()->orderBy('id')->first();
$materials = Material::query()->orderBy('id')->limit(6)->get();

if (! $user || $materials->isEmpty()) {
    fwrite(STDERR, "No hay usuario o materiales para generar datos demo.\n");
    exit(1);
}

$created = 0;
foreach ($materials as $i => $material) {
    $base = Carbon::now()->subDays(6 - $i);
    $ledger->apply(
        $material,
        InventoryMovementType::AdjustmentAdd,
        '25.000',
        $user,
        'inventory_adjustment',
        null,
        ['seed' => 'movements_report'],
        $base->copy()->setTime(8, 0),
    );
    $created++;

    $ledger->apply(
        $material,
        InventoryMovementType::In,
        '15.000',
        $user,
        'purchase_receipt',
        999000 + $i, // referencia no existente para mostrar "sin referencia válida"
        ['seed' => 'movements_report'],
        $base->copy()->setTime(10, 0),
    );
    $created++;

    $ledger->apply(
        $material,
        InventoryMovementType::Out,
        '9.000',
        $user,
        'material_request',
        888000 + $i, // referencia no existente para mostrar "sin referencia válida"
        ['seed' => 'movements_report'],
        $base->copy()->setTime(13, 30),
    );
    $created++;

    $ledger->apply(
        $material,
        InventoryMovementType::AdjustmentSub,
        '3.000',
        $user,
        'inventory_adjustment',
        null,
        ['seed' => 'movements_report'],
        $base->copy()->setTime(17, 10),
    );
    $created++;
}

echo "OK: movimientos demo creados = {$created}\n";
echo 'Usuario: '.$user->email.PHP_EOL;
echo 'Materiales tocados: '.$materials->count().PHP_EOL;
