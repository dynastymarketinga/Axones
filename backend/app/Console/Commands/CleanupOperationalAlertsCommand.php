<?php

namespace App\Console\Commands;

use App\Enums\OperationalAlertType;
use App\Models\OperationalAlert;
use Illuminate\Console\Command;

class CleanupOperationalAlertsCommand extends Command
{
    protected $signature = 'axones:cleanup-operational-alerts
                            {--dry-run : Solo muestra cuántas filas se eliminarían}
                            {--full-reset : Elimina TODAS las alertas (incluidas de material/desperdicio)}';

    protected $description = 'Elimina alertas históricas de OT/producción; conserva desperdicio, escasez OT y stock bajo.';

    public function handle(): int
    {
        $materialTypes = OperationalAlertType::materialOperationalValues();

        $query = OperationalAlert::query();

        if ($this->option('full-reset')) {
            $label = 'todas las alertas operativas';
        } else {
            $query->whereNotIn('alert_type', $materialTypes);
            $label = 'alertas que no son de desperdicio/escasez/stock bajo';
        }

        $count = (clone $query)->count();

        if ($count === 0) {
            $this->info('No hay alertas para limpiar.');

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $this->warn("[dry-run] Se eliminarían {$count} filas ({$label}).");

            return self::SUCCESS;
        }

        $deleted = $query->delete();

        $this->info("Eliminadas {$deleted} filas ({$label}).");
        $this->line('Tipos conservados: '.implode(', ', $materialTypes));

        return self::SUCCESS;
    }
}
