<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'username',
        'password',
        'role',
        'active',
        'avatar_path',
    ];

    /**
     * Buscar exclusivamente por nombre de usuario único.
     */
    public static function findByLogin(string $login): ?self
    {
        $login = trim($login);
        if ($login === '') {
            return null;
        }

        return static::query()->where('username', $login)->first();
    }

    /**
     * Quién puede aceptar devoluciones (POST /inventory-returns/{id}/accept).
     * Si `axones.inventory_returns.accept_roles` está vacío o ausente, cualquier usuario autenticado.
     *
     * @see config/axones.php
     */
    public function canAcceptInventoryReturns(): bool
    {
        $raw = config('axones.inventory_returns.accept_roles');
        if ($raw === null || trim((string) $raw) === '') {
            return true;
        }

        $allowed = array_values(array_filter(array_map(
            static fn (string $s): string => strtolower(trim($s)),
            explode(',', (string) $raw),
        ), static fn (string $s): bool => $s !== ''));

        if ($allowed === []) {
            return true;
        }

        $role = strtolower(trim((string) ($this->role ?? '')));

        return in_array($role, $allowed, true);
    }

    public function avatarUrl(): ?string
    {
        $path = trim((string) ($this->avatar_path ?? ''));
        if ($path === '') {
            return null;
        }

        $disk = Storage::disk('public');
        if (! $disk->exists($path)) {
            return null;
        }

        // Ruta relativa: mismo origen que el SPA (Vite proxy /storage en dev).
        return '/storage/'.ltrim(str_replace('\\', '/', $path), '/');
    }

    /**
     * @return array<string, mixed>
     */
    public function toAuthArray(): array
    {
        return [
            'id' => $this->getKey(),
            'name' => $this->name,
            'email' => $this->email,
            'username' => $this->username,
            'role' => $this->role ?? 'general',
            'avatar_url' => $this->avatarUrl(),
        ];
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'active' => 'boolean',
        ];
    }
}
