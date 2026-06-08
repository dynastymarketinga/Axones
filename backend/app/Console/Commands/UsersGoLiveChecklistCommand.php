<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class UsersGoLiveChecklistCommand extends Command
{
    protected $signature = 'axones:users:go-live-checklist';

    protected $description = 'Checklist operativo antes de entregar accesos en planta (Cuenta Axones).';

    public function handle(): int
    {
        $total = User::query()->count();
        $demoRemaining = User::query()->where('email', 'like', '%@axones.demo')->count();
        $localAccounts = User::query()
            ->where('email', 'like', '%@axones.local')
            ->orderBy('username')
            ->get(['id', 'name', 'email', 'username', 'role', 'active']);

        $this->info('=== Axones Cuenta — checklist go-live ===');
        $this->newLine();

        $this->line("Usuarios totales: {$total}");
        $this->line("Cuentas @axones.demo restantes: {$demoRemaining}");
        if ($demoRemaining > 0) {
            $this->warn('  → Ejecute: php artisan axones:users:drop-demo --force');
        } else {
            $this->info('  ✓ Sin cuentas demo');
        }

        $this->newLine();
        $this->line('Cuentas @axones.local (rote contraseña antes de entregar):');
        if ($localAccounts->isEmpty()) {
            $this->line('  (ninguna)');
        } else {
            foreach ($localAccounts as $user) {
                $status = ($user->active ?? true) ? 'activo' : 'inactivo';
                $this->line(sprintf(
                    '  - [%d] %s | %s | usuario: %s | rol: %s | %s',
                    $user->id,
                    $user->name,
                    $user->email,
                    $user->username ?? '—',
                    $user->role ?? 'general',
                    $status,
                ));
            }
        }

        $this->newLine();
        $this->line('Verificación manual recomendada:');
        $checks = [
            'php artisan migrate (user_admin_events, users.active)',
            'Login inventario / corte / tintas → menú acotado al rol',
            'Perfil → cambiar contraseña → re-login con clave nueva',
            'Jefe: crear/editar/desactivar usuario → Actividad reciente',
            'Login → solicitar restablecimiento → Solicitudes + campana',
            'APP_ENV=production en servidor (bloquea registro público)',
            'Calidad y Vigilancia muestran Próximamente (API comentada)',
        ];
        foreach ($checks as $i => $check) {
            $this->line('  '.($i + 1).'. '.$check);
        }

        $this->newLine();
        $this->comment('Rotación de claves: Usuarios → Editar → contraseña nueva por operador.');
        $this->comment('Renombrar display names (ej. Axones Corte → nombre real) vía la misma pantalla.');

        return self::SUCCESS;
    }
}
