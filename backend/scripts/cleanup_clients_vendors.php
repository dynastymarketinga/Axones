<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

/**
 * Limpieza total de vendors + clients y todo lo que dependa por FK.
 *
 * - Lista nombres antes
 * - Detecta tablas que referencian (directa o indirectamente) a `clients` o `vendors`
 * - Trunca esas tablas y reinicia AUTO_INCREMENT
 * - Confirma vacío al final
 *
 * Uso:
 *   php scripts/cleanup_clients_vendors.php
 */

function listNames(string $title): void
{
    echo "\n=== {$title} ===\n";

    echo "VENDORS:\n";
    /** @var \Illuminate\Support\Collection<int, \App\Models\Vendor> $vendors */
    $vendors = \App\Models\Vendor::query()->orderBy('id')->get(['id', 'name']);
    echo 'COUNT=' . $vendors->count() . "\n";
    foreach ($vendors as $v) {
        echo $v->id . " - " . $v->name . "\n";
    }

    echo "\nCLIENTS:\n";
    /** @var \Illuminate\Support\Collection<int, \App\Models\Client> $clients */
    $clients = \App\Models\Client::query()->orderBy('id')->get(['id', 'name']);
    echo 'COUNT=' . $clients->count() . "\n";
    foreach ($clients as $c) {
        echo $c->id . " - " . $c->name . "\n";
    }
}

/**
 * @return string[]
 */
function findReferencingTables(string $schema, array $referencedTables): array
{
    if (count($referencedTables) === 0) return [];

    $placeholders = implode(',', array_fill(0, count($referencedTables), '?'));
    $sql = "
        SELECT DISTINCT TABLE_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND REFERENCED_TABLE_NAME IN ($placeholders)
    ";

    $rows = DB::select($sql, array_merge([$schema], array_values($referencedTables)));

    $out = [];
    foreach ($rows as $r) {
        $t = (string) ($r->TABLE_NAME ?? '');
        if ($t !== '') $out[] = $t;
    }
    sort($out);
    return $out;
}

/**
 * Closure transitiva de dependencias por FK (tablas que referencian directa/indirectamente).
 *
 * @param string[] $roots
 * @return string[]
 */
function collectDependentTables(string $schema, array $roots): array
{
    $seen = [];
    $queue = array_values(array_unique($roots));

    while ($queue) {
        $current = array_pop($queue);
        if (isset($seen[$current])) continue;
        $seen[$current] = true;

        $refs = findReferencingTables($schema, [$current]);
        foreach ($refs as $t) {
            if (!isset($seen[$t])) $queue[] = $t;
        }
    }

    $tables = array_keys($seen);
    sort($tables);
    return $tables;
}

$schema = DB::getDatabaseName();

listNames('ANTES (sin limpiar)');

$roots = ['clients', 'vendors'];
$tables = collectDependentTables($schema, $roots);

// Excluir tablas que nunca queremos tocar.
$deny = array_fill_keys([
    'migrations',
    'users',
    'sessions',
    'personal_access_tokens',
    'password_reset_tokens',
    'failed_jobs',
    'jobs',
    'job_batches',
    'cache',
    'cache_locks',
], true);

$toTruncate = array_values(array_filter($tables, static function (string $t) use ($deny): bool {
    return !isset($deny[$t]);
}));

echo "\nTablas a truncar (dependientes de clients/vendors):\n";
foreach ($toTruncate as $t) {
    echo "- {$t}\n";
}

DB::statement('SET FOREIGN_KEY_CHECKS=0');
foreach ($toTruncate as $t) {
    DB::table($t)->truncate();
}
// Asegurar también los roots, por si quedaron fuera por algún motivo.
DB::table('clients')->truncate();
DB::table('vendors')->truncate();

// Reiniciar autoincrement
DB::statement('ALTER TABLE clients AUTO_INCREMENT = 1');
DB::statement('ALTER TABLE vendors AUTO_INCREMENT = 1');
DB::statement('SET FOREIGN_KEY_CHECKS=1');

listNames('DESPUÉS (limpio)');

echo "\nOK: limpieza completada.\n";

