<?php

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = App\Models\User::query()->where('active', true)->first();

if ($user === null) {
    fwrite(STDERR, "No active user found.\n");
    exit(1);
}

$token = $user->createToken('test-assistant')->plainTextToken;

echo json_encode([
    'username' => $user->username,
    'role' => $user->role,
    'token' => $token,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n";
