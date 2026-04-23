<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$email = (string) ($argv[1] ?? '');
if ($email === '') {
    fwrite(STDERR, "Usage: php scripts/inspect_user.php <email>\n");
    exit(2);
}

$u = App\Models\User::query()->where('email', $email)->first();
if (! $u) {
    echo "NO_USER\n";
    exit(0);
}

echo $u->toJson(JSON_PRETTY_PRINT) . PHP_EOL;

