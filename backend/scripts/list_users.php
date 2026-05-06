<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$users = App\Models\User::query()
    ->select(['id', 'name', 'email', 'username', 'role', 'created_at', 'updated_at'])
    ->orderBy('role')
    ->orderBy('id')
    ->get();

echo 'COUNT=' . $users->count() . PHP_EOL;
foreach ($users as $u) {
    echo implode("\t", [
        (string) $u->id,
        (string) $u->role,
        (string) $u->username,
        (string) $u->email,
        (string) $u->name,
    ]) . PHP_EOL;
}

