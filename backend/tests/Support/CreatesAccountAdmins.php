<?php

namespace Tests\Support;

use App\Models\User;
use App\Support\AxonesUserCredentials;

trait CreatesAccountAdmins
{
    protected function createVictor(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'boss',
            'username' => 'Desarrollador',
            'email' => AxonesUserCredentials::VICTOR_EMAIL,
        ], $attributes));
    }

    protected function createValeria(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'admin',
            'username' => 'admin',
            'email' => 'admin@axones.com',
        ], $attributes));
    }
}
