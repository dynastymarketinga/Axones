<?php

namespace App\Console\Commands;

use App\Services\AreaRequestService;
use Illuminate\Console\Command;

class ConsolidateAreaRequestsCommand extends Command
{
    protected $signature = 'axones:consolidate-area-requests';

    protected $description = 'Cierra solicitudes OT duplicadas por área, dejando solo la más reciente pendiente.';

    public function handle(AreaRequestService $areaRequests): int
    {
        $result = $areaRequests->consolidateDuplicateWorkOrderCoordination();

        $this->info(sprintf(
            'Grupos OT/área revisados: %d. Solicitudes antiguas marcadas completadas: %d.',
            $result['groups'],
            $result['closed'],
        ));

        return self::SUCCESS;
    }
}
