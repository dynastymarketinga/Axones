<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DropDemoUsersCommand extends Command
{
    protected $signature = 'axones:users:drop-demo
                            {--dry-run : Solo listar cuentas @axones.demo}
                            {--force : Omitir confirmación}';

    protected $description = 'Elimina usuarios @axones.demo (revoca tokens y sesiones antes).';

    public function handle(): int
    {
        $users = User::query()
            ->where('email', 'like', '%@axones.demo')
            ->orderBy('id')
            ->get();

        if ($users->isEmpty()) {
            $this->info('No hay usuarios @axones.demo para eliminar.');
            $this->line('Usuarios restantes: '.User::query()->count());

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $this->info('Cuentas @axones.demo que se eliminarían ('.$users->count().'):');
            foreach ($users as $user) {
                $this->line("  - [{$user->id}] {$user->name} ({$user->email})");
            }
            $this->newLine();
            $this->line('Usuarios que quedarían: '.(User::query()->count() - $users->count()));

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm(
            '¿Eliminar '.$users->count().' usuarios @axones.demo?',
            false,
        )) {
            $this->line('Cancelado.');

            return self::SUCCESS;
        }

        $deleted = 0;
        foreach ($users as $user) {
            DB::table('sessions')->where('user_id', $user->getKey())->delete();
            $user->tokens()->delete();
            $user->delete();
            $deleted++;
        }

        $remaining = User::query()->count();
        $this->info("Usuarios demo eliminados: {$deleted}");
        $this->line("Usuarios restantes: {$remaining}");
        $this->warn('Revise y rote contraseñas de cuentas @axones.local antes de entregar accesos en planta.');

        return self::SUCCESS;
    }
}
